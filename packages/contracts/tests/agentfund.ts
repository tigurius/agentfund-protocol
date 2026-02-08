import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Agentfund } from "../target/types/agentfund";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

describe("agentfund", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Agentfund as Program<Agentfund>;

  let treasuryPDA: PublicKey;
  let treasuryBump: number;

  before(async () => {
    // Derive treasury PDA
    [treasuryPDA, treasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("initialize_treasury", () => {
    it("should initialize a treasury account", async () => {
      const tx = await program.methods
        .initializeTreasury(treasuryBump)
        .accounts({
          treasury: treasuryPDA,
          owner: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize treasury tx:", tx);

      const treasury = await program.account.treasury.fetch(treasuryPDA);
      expect(treasury.owner.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(treasury.totalReceived.toNumber()).to.equal(0);
      expect(treasury.pendingInvoices.toNumber()).to.equal(0);
    });
  });

  describe("create_invoice", () => {
    it("should create an invoice", async () => {
      const invoiceId = Keypair.generate().publicKey.toBuffer();
      const [invoicePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("invoice"), invoiceId],
        program.programId
      );

      const amount = new anchor.BN(0.001 * LAMPORTS_PER_SOL);
      const memo = "Test invoice";
      const expiresAt = new anchor.BN(
        Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      );

      const tx = await program.methods
        .createInvoice(
          Array.from(invoiceId) as number[],
          amount,
          memo,
          expiresAt
        )
        .accounts({
          invoice: invoicePDA,
          treasury: treasuryPDA,
          recipient: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Create invoice tx:", tx);

      const invoice = await program.account.invoice.fetch(invoicePDA);
      expect(invoice.amount.toNumber()).to.equal(amount.toNumber());
      expect(invoice.memo).to.equal(memo);
      expect(invoice.status).to.deep.equal({ pending: {} });
    });
  });

  describe("pay_invoice", () => {
    it("should pay an invoice", async () => {
      // Create invoice first
      const invoiceId = Keypair.generate().publicKey.toBuffer();
      const [invoicePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("invoice"), invoiceId],
        program.programId
      );

      const amount = new anchor.BN(0.001 * LAMPORTS_PER_SOL);
      const expiresAt = new anchor.BN(
        Math.floor(Date.now() / 1000) + 3600
      );

      await program.methods
        .createInvoice(
          Array.from(invoiceId) as number[],
          amount,
          "Payment test",
          expiresAt
        )
        .accounts({
          invoice: invoicePDA,
          treasury: treasuryPDA,
          recipient: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Pay the invoice
      const payer = Keypair.generate();

      // Airdrop to payer
      const airdropSig = await provider.connection.requestAirdrop(
        payer.publicKey,
        0.1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const recipientBalanceBefore = await provider.connection.getBalance(
        provider.wallet.publicKey
      );

      const tx = await program.methods
        .payInvoice()
        .accounts({
          invoice: invoicePDA,
          treasury: treasuryPDA,
          payer: payer.publicKey,
          recipient: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      console.log("Pay invoice tx:", tx);

      const invoice = await program.account.invoice.fetch(invoicePDA);
      expect(invoice.status).to.deep.equal({ paid: {} });
      expect(invoice.payer?.toString()).to.equal(payer.publicKey.toString());

      const recipientBalanceAfter = await provider.connection.getBalance(
        provider.wallet.publicKey
      );
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(
        amount.toNumber()
      );
    });
  });

  describe("settle_batch", () => {
    it("should settle a batch of payments", async () => {
      const batchId = Keypair.generate().publicKey.toBuffer();
      const [batchPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("batch"), batchId],
        program.programId
      );

      const invoiceIds = [
        Keypair.generate().publicKey.toBuffer(),
        Keypair.generate().publicKey.toBuffer(),
        Keypair.generate().publicKey.toBuffer(),
      ];

      const totalAmount = new anchor.BN(0.003 * LAMPORTS_PER_SOL);

      const settler = Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        settler.publicKey,
        0.1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const tx = await program.methods
        .settleBatch(
          Array.from(batchId) as number[],
          invoiceIds.map((id) => Array.from(id) as number[]),
          totalAmount
        )
        .accounts({
          batch: batchPDA,
          treasury: treasuryPDA,
          settler: settler.publicKey,
          recipient: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([settler])
        .rpc();

      console.log("Settle batch tx:", tx);

      const batch = await program.account.batchSettlement.fetch(batchPDA);
      expect(batch.invoiceCount).to.equal(3);
      expect(batch.totalAmount.toNumber()).to.equal(totalAmount.toNumber());
    });
  });

  describe("payment_channels", () => {
    it("should open a payment channel", async () => {
      const channelId = Keypair.generate().publicKey.toBuffer();
      const [channelPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("channel"), channelId],
        program.programId
      );
      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), channelId],
        program.programId
      );

      const partyB = Keypair.generate().publicKey;
      const deposit = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .openChannel(Array.from(channelId) as number[], deposit)
        .accounts({
          channel: channelPDA,
          channelEscrow: escrowPDA,
          partyA: provider.wallet.publicKey,
          partyB: partyB,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Open channel tx:", tx);

      const channel = await program.account.paymentChannel.fetch(channelPDA);
      expect(channel.partyA.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(channel.partyB.toString()).to.equal(partyB.toString());
      expect(channel.depositA.toNumber()).to.equal(deposit.toNumber());
      expect(channel.status).to.deep.equal({ open: {} });
    });
  });
});

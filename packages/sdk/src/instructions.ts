/**
 * Instruction builders for AgentFund program
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import * as borsh from 'borsh';
import { AGENTFUND_PROGRAM_ID } from './constants';
import {
  getTreasuryPDA,
  getInvoicePDA,
  getBatchPDA,
  getChannelPDA,
  getChannelEscrowPDA,
} from './pda';

// Instruction discriminators (first 8 bytes of sha256 hash of instruction name)
const DISCRIMINATORS = {
  initializeTreasury: Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
  createInvoice: Buffer.from([0, 0, 0, 0, 0, 0, 0, 2]),
  payInvoice: Buffer.from([0, 0, 0, 0, 0, 0, 0, 3]),
  settleBatch: Buffer.from([0, 0, 0, 0, 0, 0, 0, 4]),
  openChannel: Buffer.from([0, 0, 0, 0, 0, 0, 0, 5]),
  closeChannel: Buffer.from([0, 0, 0, 0, 0, 0, 0, 6]),
};

/**
 * Create instruction to initialize a treasury
 */
export function createInitializeTreasuryInstruction(
  owner: PublicKey
): TransactionInstruction {
  const [treasuryPDA, bump] = getTreasuryPDA(owner);

  const data = Buffer.concat([
    DISCRIMINATORS.initializeTreasury,
    Buffer.from([bump]),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to create an invoice
 */
export function createCreateInvoiceInstruction(
  recipient: PublicKey,
  invoiceId: Buffer,
  amount: bigint,
  memo: string,
  expiresAt: bigint
): TransactionInstruction {
  const [invoicePDA] = getInvoicePDA(invoiceId);
  const [treasuryPDA] = getTreasuryPDA(recipient);

  // Serialize instruction data
  const memoBytes = Buffer.from(memo);
  const data = Buffer.concat([
    DISCRIMINATORS.createInvoice,
    invoiceId,
    Buffer.from(new BigUint64Array([amount]).buffer),
    Buffer.from(new Uint32Array([memoBytes.length]).buffer),
    memoBytes,
    Buffer.from(new BigInt64Array([expiresAt]).buffer),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: invoicePDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to pay an invoice
 */
export function createPayInvoiceInstruction(
  payer: PublicKey,
  recipient: PublicKey,
  invoiceId: Buffer
): TransactionInstruction {
  const [invoicePDA] = getInvoicePDA(invoiceId);
  const [treasuryPDA] = getTreasuryPDA(recipient);

  return new TransactionInstruction({
    keys: [
      { pubkey: invoicePDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data: DISCRIMINATORS.payInvoice,
  });
}

/**
 * Create instruction to settle a batch of payments
 */
export function createSettleBatchInstruction(
  settler: PublicKey,
  recipient: PublicKey,
  batchId: Buffer,
  invoiceIds: Buffer[],
  totalAmount: bigint
): TransactionInstruction {
  const [batchPDA] = getBatchPDA(batchId);
  const [treasuryPDA] = getTreasuryPDA(recipient);

  // Serialize invoice IDs
  const invoiceIdsData = Buffer.concat([
    Buffer.from(new Uint32Array([invoiceIds.length]).buffer),
    ...invoiceIds,
  ]);

  const data = Buffer.concat([
    DISCRIMINATORS.settleBatch,
    batchId,
    invoiceIdsData,
    Buffer.from(new BigUint64Array([totalAmount]).buffer),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: batchPDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: settler, isSigner: true, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to open a payment channel
 */
export function createOpenChannelInstruction(
  partyA: PublicKey,
  partyB: PublicKey,
  channelId: Buffer,
  deposit: bigint
): TransactionInstruction {
  const [channelPDA] = getChannelPDA(channelId);
  const [escrowPDA] = getChannelEscrowPDA(channelId);

  const data = Buffer.concat([
    DISCRIMINATORS.openChannel,
    channelId,
    Buffer.from(new BigUint64Array([deposit]).buffer),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: channelPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: partyA, isSigner: true, isWritable: true },
      { pubkey: partyB, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data,
  });
}

/**
 * Create instruction to close a payment channel
 */
export function createCloseChannelInstruction(
  closer: PublicKey,
  partyA: PublicKey,
  partyB: PublicKey,
  channelId: Buffer,
  finalBalanceA: bigint,
  finalBalanceB: bigint,
  nonce: bigint
): TransactionInstruction {
  const [channelPDA] = getChannelPDA(channelId);
  const [escrowPDA] = getChannelEscrowPDA(channelId);

  const data = Buffer.concat([
    DISCRIMINATORS.closeChannel,
    Buffer.from(new BigUint64Array([finalBalanceA]).buffer),
    Buffer.from(new BigUint64Array([finalBalanceB]).buffer),
    Buffer.from(new BigUint64Array([nonce]).buffer),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: channelPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: closer, isSigner: true, isWritable: true },
      { pubkey: partyA, isSigner: false, isWritable: true },
      { pubkey: partyB, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: AGENTFUND_PROGRAM_ID,
    data,
  });
}

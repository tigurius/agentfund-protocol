/**
 * Multi-token payment support
 * 
 * Accept payments in any SPL token and auto-convert to SOL
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  getAccount, 
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { JupiterIntegration, TOKENS } from './jupiter';
import { Invoice } from './types';

export interface TokenPaymentConfig {
  /** Accepted token mints */
  acceptedTokens: PublicKey[];
  /** Auto-convert to SOL */
  autoConvertToSOL: boolean;
  /** Minimum SOL equivalent to accept */
  minSOLEquivalent?: number;
  /** Maximum slippage for conversions (bps) */
  maxSlippageBps?: number;
}

export interface TokenInvoice extends Invoice {
  /** Accepted tokens for this invoice */
  acceptedTokens: PublicKey[];
  /** Required amount per token (calculated at creation) */
  tokenAmounts: Map<string, number>;
}

export class MultiTokenPayments {
  private connection: Connection;
  private wallet: Keypair | PublicKey;
  private jupiter: JupiterIntegration;
  private config: TokenPaymentConfig;

  constructor(
    connection: Connection,
    wallet: Keypair | PublicKey,
    config?: Partial<TokenPaymentConfig>
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.jupiter = new JupiterIntegration(connection);
    this.config = {
      acceptedTokens: [TOKENS.SOL, TOKENS.USDC, TOKENS.USDT],
      autoConvertToSOL: true,
      minSOLEquivalent: 0.0001,
      maxSlippageBps: 100, // 1%
      ...config,
    };
  }

  /**
   * Create an invoice that accepts multiple tokens
   */
  async createMultiTokenInvoice(params: {
    amountSOL: number;
    memo?: string;
    expiresIn?: string;
    acceptedTokens?: PublicKey[];
  }): Promise<TokenInvoice> {
    const tokens = params.acceptedTokens || this.config.acceptedTokens;
    const tokenAmounts = new Map<string, number>();

    // Calculate equivalent amounts for each token
    for (const token of tokens) {
      if (token.equals(TOKENS.SOL)) {
        tokenAmounts.set(token.toString(), params.amountSOL);
      } else {
        // Get quote from Jupiter
        try {
          const quote = await this.jupiter.getQuote({
            inputMint: token,
            outputMint: TOKENS.SOL,
            amount: params.amountSOL,
          });
          
          // We need to pay enough tokens to get amountSOL out
          // So we need to find how many tokens give us amountSOL
          const reverseQuote = await this.jupiter.getQuote({
            inputMint: TOKENS.SOL,
            outputMint: token,
            amount: params.amountSOL,
          });
          
          tokenAmounts.set(
            token.toString(),
            parseInt(reverseQuote.outputAmount) / 1e6 // Assuming 6 decimals for stables
          );
        } catch (err) {
          console.warn(`Failed to get quote for ${token.toString()}`);
        }
      }
    }

    const expiresAt = this.parseExpiry(params.expiresIn || '1h');

    return {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient: this.getPublicKey(),
      amount: params.amountSOL,
      memo: params.memo,
      expiresAt,
      status: 'pending' as any,
      createdAt: new Date(),
      acceptedTokens: tokens,
      tokenAmounts,
    };
  }

  /**
   * Check token balance for a wallet
   */
  async getTokenBalance(
    wallet: PublicKey,
    tokenMint: PublicKey
  ): Promise<number> {
    if (tokenMint.equals(TOKENS.SOL)) {
      const balance = await this.connection.getBalance(wallet);
      return balance / 1e9;
    }

    try {
      const ata = await getAssociatedTokenAddress(tokenMint, wallet);
      const account = await getAccount(this.connection, ata);
      return Number(account.amount) / 1e6; // Assuming 6 decimals
    } catch {
      return 0;
    }
  }

  /**
   * Verify token payment for an invoice
   */
  async verifyTokenPayment(
    invoice: TokenInvoice,
    payer: PublicKey,
    tokenMint: PublicKey
  ): Promise<{
    paid: boolean;
    receivedAmount?: number;
    token?: string;
  }> {
    const expectedAmount = invoice.tokenAmounts.get(tokenMint.toString());
    if (!expectedAmount) {
      return { paid: false };
    }

    // Check our token balance
    const balance = await this.getTokenBalance(this.getPublicKey(), tokenMint);
    
    // For simplicity, check if we received the expected amount
    // In production, you'd track specific transactions
    if (balance >= expectedAmount) {
      return {
        paid: true,
        receivedAmount: expectedAmount,
        token: tokenMint.toString(),
      };
    }

    return { paid: false };
  }

  /**
   * Convert received tokens to SOL
   */
  async convertToSOL(
    tokenMint: PublicKey,
    amount: number,
    signTransaction: (tx: any) => Promise<any>
  ): Promise<{ solAmount: number; txSignature: string }> {
    if (tokenMint.equals(TOKENS.SOL)) {
      return { solAmount: amount, txSignature: '' };
    }

    const result = await this.jupiter.convertToSOL({
      tokenMint,
      amount,
      userPublicKey: this.getPublicKey(),
      signTransaction,
    });

    return {
      solAmount: result.outputAmount,
      txSignature: result.txSignature,
    };
  }

  /**
   * Get payment options for an invoice
   */
  getPaymentOptions(invoice: TokenInvoice): {
    token: string;
    symbol: string;
    amount: number;
    wallet: string;
  }[] {
    const options: any[] = [];
    const recipient = this.getPublicKey().toString();

    for (const [mint, amount] of invoice.tokenAmounts) {
      const symbol = this.getTokenSymbol(mint);
      options.push({
        token: mint,
        symbol,
        amount,
        wallet: recipient,
      });
    }

    return options;
  }

  private getTokenSymbol(mint: string): string {
    if (mint === TOKENS.SOL.toString()) return 'SOL';
    if (mint === TOKENS.USDC.toString()) return 'USDC';
    if (mint === TOKENS.USDT.toString()) return 'USDT';
    if (mint === TOKENS.BONK.toString()) return 'BONK';
    if (mint === TOKENS.JUP.toString()) return 'JUP';
    return mint.slice(0, 8) + '...';
  }

  private getPublicKey(): PublicKey {
    if (this.wallet instanceof PublicKey) {
      return this.wallet;
    }
    return this.wallet.publicKey;
  }

  private parseExpiry(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)(h|m|d)$/);
    if (!match) throw new Error('Invalid duration format');
    
    const [, value, unit] = match;
    const ms = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }[unit]!;

    return new Date(now.getTime() + parseInt(value) * ms);
  }
}

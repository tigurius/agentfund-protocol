/**
 * Main AgentFund class
 * Entry point for all agent funding operations
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Invoice, PaymentStatus, BatchSettlement } from './types';
import { SelfFunding } from './self-funding';
import { Micropayments } from './micropayments';

export interface AgentFundConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** Agent's wallet keypair or public key */
  wallet: Keypair | PublicKey;
  /** Optional: Custom program IDs */
  programIds?: {
    micropayments?: PublicKey;
    treasury?: PublicKey;
  };
}

export class AgentFund {
  private connection: Connection;
  private wallet: Keypair | PublicKey;
  public selfFunding: SelfFunding;
  public micropayments: Micropayments;

  constructor(config: AgentFundConfig) {
    this.connection = new Connection(config.rpcUrl);
    this.wallet = config.wallet;
    this.selfFunding = new SelfFunding(this.connection, this.wallet);
    this.micropayments = new Micropayments(this.connection, this.wallet);
  }

  /**
   * Create a payment invoice
   * Other agents can pay this invoice to request services
   */
  async createInvoice(params: {
    amount: number;
    memo?: string;
    expiresIn?: string;
    token?: PublicKey;
  }): Promise<Invoice> {
    const expiresAt = this.parseExpiry(params.expiresIn || '1h');
    
    const invoice: Invoice = {
      id: this.generateId(),
      recipient: this.getPublicKey(),
      amount: params.amount,
      token: params.token,
      memo: params.memo,
      expiresAt,
      status: PaymentStatus.PENDING,
      createdAt: new Date()
    };

    // Store invoice (in production: persist to storage)
    await this.micropayments.registerInvoice(invoice);

    return invoice;
  }

  /**
   * Verify if a payment has been received
   */
  async verifyPayment(invoiceId: string): Promise<boolean> {
    return this.micropayments.checkPayment(invoiceId);
  }

  /**
   * Settle a batch of micropayments
   * Aggregates multiple small payments into one on-chain transaction
   */
  async settleBatch(): Promise<BatchSettlement> {
    return this.micropayments.settlePending();
  }

  /**
   * Get current balance (SOL + tokens)
   */
  async getBalance(): Promise<{ sol: number; tokens: Map<string, number> }> {
    const pubkey = this.getPublicKey();
    const solBalance = await this.connection.getBalance(pubkey);
    
    // Fetch SPL token balances
    const tokens = new Map<string, number>();
    
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        pubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );
      
      for (const { account } of tokenAccounts.value) {
        const parsed = account.data.parsed;
        if (parsed?.info?.mint && parsed?.info?.tokenAmount?.uiAmount) {
          tokens.set(parsed.info.mint, parsed.info.tokenAmount.uiAmount);
        }
      }
    } catch {
      // Token fetch failed, return empty map
    }

    return {
      sol: solBalance / 1e9,
      tokens
    };
  }

  /**
   * List all invoices (pending, paid, expired)
   */
  async listInvoices(): Promise<Invoice[]> {
    return this.micropayments.listInvoices();
  }

  /**
   * Get pending payments ready for settlement
   */
  async getPendingPayments(): Promise<Invoice[]> {
    return this.micropayments.getPendingPayments();
  }

  /**
   * Get settlement history
   */
  async getSettlementHistory(): Promise<BatchSettlement[]> {
    return this.micropayments.getSettlementHistory();
  }

  // Helper methods
  private getPublicKey(): PublicKey {
    if (this.wallet instanceof PublicKey) {
      return this.wallet;
    }
    return this.wallet.publicKey;
  }

  private generateId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseExpiry(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)(h|m|d)$/);
    if (!match) throw new Error('Invalid duration format');
    
    const [, value, unit] = match;
    const ms = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    }[unit]!;

    return new Date(now.getTime() + parseInt(value) * ms);
  }
}

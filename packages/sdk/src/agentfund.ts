/**
 * @fileoverview Main AgentFund SDK entry point.
 * 
 * The AgentFund class is the primary interface for all agent funding operations.
 * It provides a unified API for treasury management, invoice creation,
 * payment verification, and batch settlements.
 * 
 * @module agentfund
 * @author SatsAgent
 * @license MIT
 * 
 * @example
 * ```typescript
 * import { AgentFund } from '@agentfund/sdk';
 * import { Keypair } from '@solana/web3.js';
 * 
 * const agentfund = new AgentFund({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   wallet: Keypair.generate()
 * });
 * 
 * // Create an invoice for your service
 * const invoice = await agentfund.createInvoice({
 *   amount: 0.01,  // SOL
 *   memo: 'Sentiment analysis API call'
 * });
 * 
 * // Later, verify payment
 * const paid = await agentfund.verifyPayment(invoice.id);
 * if (paid) {
 *   // Deliver service
 * }
 * ```
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Invoice, PaymentStatus, BatchSettlement } from './types';
import { SelfFunding } from './self-funding';
import { Micropayments } from './micropayments';

/**
 * Configuration options for the AgentFund SDK.
 * 
 * @interface AgentFundConfig
 * @property {string} rpcUrl - Solana RPC endpoint URL
 * @property {Keypair | PublicKey} wallet - Agent's wallet (Keypair for full access, PublicKey for read-only)
 * @property {Object} [programIds] - Optional custom program IDs for self-hosted deployments
 */
export interface AgentFundConfig {
  /** 
   * Solana RPC endpoint URL.
   * Recommended: Use dedicated RPC providers like Helius, Triton, or QuickNode.
   * @example 'https://api.mainnet-beta.solana.com'
   * @example 'https://api.devnet.solana.com'
   */
  rpcUrl: string;
  
  /** 
   * Agent's wallet keypair or public key.
   * - Keypair: Full access (create invoices, settle payments)
   * - PublicKey: Read-only access (check balances, verify payments)
   */
  wallet: Keypair | PublicKey;
  
  /** 
   * Optional custom program IDs for self-hosted deployments.
   * Default: Uses the official AgentFund program IDs.
   */
  programIds?: {
    /** Micropayments program ID */
    micropayments?: PublicKey;
    /** Treasury program ID */
    treasury?: PublicKey;
  };
}

/**
 * Balance result including SOL and SPL tokens.
 * 
 * @interface BalanceResult
 */
export interface BalanceResult {
  /** SOL balance in human-readable format */
  sol: number;
  /** Map of token mint address to balance */
  tokens: Map<string, number>;
}

/**
 * Invoice creation parameters.
 * 
 * @interface CreateInvoiceParams
 */
export interface CreateInvoiceParams {
  /** Amount in SOL (or token decimals if token specified) */
  amount: number;
  /** Human-readable description of what the payment is for */
  memo?: string;
  /** 
   * Invoice expiration duration.
   * Format: `{number}{unit}` where unit is `m` (minutes), `h` (hours), or `d` (days)
   * @default '1h'
   * @example '30m' - 30 minutes
   * @example '24h' - 24 hours
   * @example '7d' - 7 days
   */
  expiresIn?: string;
  /** SPL token mint address. If not specified, invoice is for SOL. */
  token?: PublicKey;
}

/**
 * Main AgentFund SDK class.
 * 
 * AgentFund is the entry point for all agent funding operations. It integrates
 * self-funding mechanisms, micropayments, and treasury management into a
 * unified, easy-to-use API.
 * 
 * ## Core Features
 * 
 * - **Invoice Management**: Create, track, and verify payment invoices
 * - **Micropayment Batching**: Aggregate small payments for efficient settlement
 * - **Balance Tracking**: Monitor SOL and SPL token balances
 * - **Self-Funding**: Access token launch and fee collection tools
 * 
 * ## Architecture
 * 
 * ```
 * AgentFund
 * ├── selfFunding    → Token launch, fee collection
 * └── micropayments  → Invoice tracking, batch settlement
 * ```
 * 
 * @class AgentFund
 * 
 * @example
 * ```typescript
 * // Service provider setup
 * const agentfund = new AgentFund({
 *   rpcUrl: process.env.SOLANA_RPC_URL,
 *   wallet: loadKeypair()
 * });
 * 
 * // Create invoice for service
 * const invoice = await agentfund.createInvoice({
 *   amount: 0.001,
 *   memo: 'API call - /analyze endpoint'
 * });
 * 
 * // Return invoice to client
 * return { invoice, endpoint: '/analyze' };
 * 
 * // In webhook or polling:
 * const paid = await agentfund.verifyPayment(invoice.id);
 * ```
 */
export class AgentFund {
  private connection: Connection;
  private wallet: Keypair | PublicKey;
  
  /**
   * Self-funding module for token launches and fee collection.
   * @public
   */
  public selfFunding: SelfFunding;
  
  /**
   * Micropayments module for invoice tracking and batch settlements.
   * @public
   */
  public micropayments: Micropayments;

  /**
   * Creates a new AgentFund instance.
   * 
   * @param {AgentFundConfig} config - Configuration options
   * 
   * @example
   * ```typescript
   * // Devnet setup
   * const agentfund = new AgentFund({
   *   rpcUrl: 'https://api.devnet.solana.com',
   *   wallet: Keypair.generate()
   * });
   * 
   * // Mainnet with custom RPC
   * const agentfund = new AgentFund({
   *   rpcUrl: 'https://rpc.helius.xyz/?api-key=xxx',
   *   wallet: loadKeypair()
   * });
   * ```
   */
  constructor(config: AgentFundConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.wallet = config.wallet;
    this.selfFunding = new SelfFunding(this.connection, this.wallet);
    this.micropayments = new Micropayments(this.connection, this.wallet);
  }

  /**
   * Creates a payment invoice for a service.
   * 
   * Invoices are the primary mechanism for agent-to-agent payments.
   * The invoice can be returned to clients in API responses (402 Payment Required)
   * or shared directly for P2P payments.
   * 
   * @param {CreateInvoiceParams} params - Invoice parameters
   * @returns {Promise<Invoice>} The created invoice
   * 
   * @example
   * ```typescript
   * // Basic invoice
   * const invoice = await agentfund.createInvoice({
   *   amount: 0.01,
   *   memo: 'Premium feature access'
   * });
   * 
   * // Invoice with short expiry
   * const urgentInvoice = await agentfund.createInvoice({
   *   amount: 0.005,
   *   memo: 'Time-sensitive data',
   *   expiresIn: '5m'
   * });
   * 
   * // SPL token invoice
   * const usdcInvoice = await agentfund.createInvoice({
   *   amount: 1.00,
   *   token: USDC_MINT,
   *   memo: 'API subscription'
   * });
   * ```
   */
  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
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

    // Register invoice for tracking
    await this.micropayments.registerInvoice(invoice);

    return invoice;
  }

  /**
   * Verifies if a payment has been received for an invoice.
   * 
   * Checks both on-chain transfers and payment channel state.
   * This is the primary method for implementing pay-for-service flows.
   * 
   * @param {string} invoiceId - The invoice ID to verify
   * @returns {Promise<boolean>} True if payment received, false otherwise
   * 
   * @example
   * ```typescript
   * // Basic verification
   * const paid = await agentfund.verifyPayment(invoice.id);
   * if (paid) {
   *   return { success: true, data: serviceResult };
   * } else {
   *   return { error: 'Payment not received', invoice };
   * }
   * 
   * // Polling verification
   * async function waitForPayment(invoiceId: string, maxAttempts = 30) {
   *   for (let i = 0; i < maxAttempts; i++) {
   *     if (await agentfund.verifyPayment(invoiceId)) {
   *       return true;
   *     }
   *     await sleep(1000);
   *   }
   *   return false;
   * }
   * ```
   */
  async verifyPayment(invoiceId: string): Promise<boolean> {
    return this.micropayments.checkPayment(invoiceId);
  }

  /**
   * Settles a batch of received micropayments.
   * 
   * Aggregates multiple small payments into a single on-chain transaction,
   * dramatically reducing per-payment gas costs. Ideal for services with
   * many small transactions.
   * 
   * @returns {Promise<BatchSettlement>} Settlement result with transaction details
   * @throws {Error} If no pending payments to settle
   * 
   * @example
   * ```typescript
   * // Settle when you have accumulated payments
   * const pending = await agentfund.getPendingPayments();
   * if (pending.length >= 10) {  // Wait for 10 payments
   *   const settlement = await agentfund.settleBatch();
   *   console.log(`Settled ${settlement.invoices.length} invoices`);
   *   console.log(`Total: ${settlement.totalAmount} SOL`);
   * }
   * ```
   */
  async settleBatch(): Promise<BatchSettlement> {
    return this.micropayments.settlePending();
  }

  /**
   * Gets the current balance in SOL and SPL tokens.
   * 
   * @returns {Promise<BalanceResult>} Balance information
   * 
   * @example
   * ```typescript
   * const balance = await agentfund.getBalance();
   * console.log('SOL balance:', balance.sol);
   * 
   * // Check specific token
   * const usdcBalance = balance.tokens.get(USDC_MINT.toString());
   * console.log('USDC balance:', usdcBalance || 0);
   * ```
   */
  async getBalance(): Promise<BalanceResult> {
    const pubkey = this.getPublicKey();
    const solBalance = await this.connection.getBalance(pubkey);
    
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
   * Lists all tracked invoices.
   * 
   * Returns invoices in all states: pending, received, settled, expired.
   * 
   * @returns {Promise<Invoice[]>} Array of all invoices
   * 
   * @example
   * ```typescript
   * const invoices = await agentfund.listInvoices();
   * 
   * // Group by status
   * const byStatus = invoices.reduce((acc, inv) => {
   *   acc[inv.status] = (acc[inv.status] || []).concat(inv);
   *   return acc;
   * }, {});
   * 
   * console.log('Pending:', byStatus.pending?.length || 0);
   * console.log('Received:', byStatus.received?.length || 0);
   * ```
   */
  async listInvoices(): Promise<Invoice[]> {
    return this.micropayments.listInvoices();
  }

  /**
   * Gets payments that are received but not yet settled.
   * 
   * These payments are ready to be included in a batch settlement.
   * 
   * @returns {Promise<Invoice[]>} Array of pending payments
   * 
   * @example
   * ```typescript
   * const pending = await agentfund.getPendingPayments();
   * const totalPending = pending.reduce((sum, inv) => sum + inv.amount, 0);
   * console.log(`${pending.length} payments pending (${totalPending} SOL)`);
   * ```
   */
  async getPendingPayments(): Promise<Invoice[]> {
    return this.micropayments.getPendingPayments();
  }

  /**
   * Gets the history of all batch settlements.
   * 
   * @returns {Promise<BatchSettlement[]>} Array of settlement records
   * 
   * @example
   * ```typescript
   * const history = await agentfund.getSettlementHistory();
   * const totalSettled = history.reduce((sum, s) => sum + s.totalAmount, 0);
   * console.log('Total settled:', totalSettled, 'SOL');
   * console.log('Batches:', history.length);
   * ```
   */
  async getSettlementHistory(): Promise<BatchSettlement[]> {
    return this.micropayments.getSettlementHistory();
  }

  /**
   * Gets the Solana connection instance.
   * 
   * Useful for advanced operations requiring direct RPC access.
   * 
   * @returns {Connection} The Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Gets the wallet public key.
   * 
   * @returns {PublicKey} The wallet's public key
   * @private
   */
  private getPublicKey(): PublicKey {
    if (this.wallet instanceof PublicKey) {
      return this.wallet;
    }
    return this.wallet.publicKey;
  }

  /**
   * Generates a unique invoice ID.
   * 
   * @returns {string} Unique invoice ID
   * @private
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `inv_${timestamp}_${random}`;
  }

  /**
   * Parses a duration string into a Date.
   * 
   * @param {string} duration - Duration string (e.g., '1h', '30m', '7d')
   * @returns {Date} Expiration date
   * @throws {Error} If duration format is invalid
   * @private
   */
  private parseExpiry(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)(h|m|d)$/);
    if (!match) {
      throw new Error(
        `Invalid duration format: "${duration}". ` +
        'Use format: {number}{unit} where unit is m (minutes), h (hours), or d (days)'
      );
    }
    
    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return new Date(now.getTime() + parseInt(value) * multipliers[unit]);
  }
}

/**
 * Creates a new AgentFund instance with the given configuration.
 * 
 * Convenience function equivalent to `new AgentFund(config)`.
 * 
 * @param {AgentFundConfig} config - Configuration options
 * @returns {AgentFund} New AgentFund instance
 * 
 * @example
 * ```typescript
 * import { createAgentFund } from '@agentfund/sdk';
 * 
 * const agentfund = createAgentFund({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   wallet: keypair
 * });
 * ```
 */
export function createAgentFund(config: AgentFundConfig): AgentFund {
  return new AgentFund(config);
}

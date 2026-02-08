/**
 * Micropayments Module
 * Sub-cent transactions without gas eating the value
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { Invoice, PaymentStatus, BatchSettlement } from './types';

export class Micropayments {
  private connection: Connection;
  private wallet: Keypair | PublicKey;
  private pendingInvoices: Map<string, Invoice> = new Map();
  private receivedPayments: Map<string, number> = new Map();
  private settlementHistory: BatchSettlement[] = [];

  constructor(connection: Connection, wallet: Keypair | PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Register an invoice for tracking
   */
  async registerInvoice(invoice: Invoice): Promise<void> {
    this.pendingInvoices.set(invoice.id, invoice);
  }

  /**
   * Check if a payment has been received
   * Monitors on-chain transfers and payment channel state
   */
  async checkPayment(invoiceId: string): Promise<boolean> {
    const invoice = this.pendingInvoices.get(invoiceId);
    if (!invoice) return false;

    // Check if expired
    if (new Date() > invoice.expiresAt) {
      invoice.status = PaymentStatus.EXPIRED;
      return false;
    }

    // Check for direct on-chain payment
    const recipient = invoice.recipient;
    try {
      const signatures = await this.connection.getSignaturesForAddress(recipient, { limit: 20 });
      for (const sig of signatures) {
        const tx = await this.connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (tx?.meta?.postBalances && tx?.meta?.preBalances) {
          const recipientIdx = tx.transaction.message.accountKeys.findIndex(
            (k: any) => k.pubkey?.toString() === recipient.toString()
          );
          if (recipientIdx >= 0) {
            const received = (tx.meta.postBalances[recipientIdx] - tx.meta.preBalances[recipientIdx]) / 1e9;
            if (received >= invoice.amount) {
              invoice.status = PaymentStatus.RECEIVED;
              invoice.paidAt = new Date(tx.blockTime! * 1000);
              this.receivedPayments.set(invoiceId, received);
              return true;
            }
          }
        }
      }
    } catch {
      // On-chain check failed, fall through to local state
    }

    // Check local recorded payments (for off-chain channels)
    const received = this.receivedPayments.get(invoiceId);
    if (received && received >= invoice.amount) {
      invoice.status = PaymentStatus.RECEIVED;
      return true;
    }

    return false;
  }

  /**
   * List all tracked invoices
   */
  listInvoices(): Invoice[] {
    return Array.from(this.pendingInvoices.values());
  }

  /**
   * Get invoices that are paid and ready for batch settlement
   */
  getPendingPayments(): Invoice[] {
    return Array.from(this.pendingInvoices.values())
      .filter(inv => inv.status === PaymentStatus.RECEIVED);
  }

  /**
   * Get settlement history
   */
  getSettlementHistory(): BatchSettlement[] {
    return [...this.settlementHistory];
  }

  /**
   * Record a received payment (for payment channels)
   */
  async recordPayment(invoiceId: string, amount: number): Promise<void> {
    const current = this.receivedPayments.get(invoiceId) || 0;
    this.receivedPayments.set(invoiceId, current + amount);
  }

  /**
   * Settle all pending micropayments in a batch
   * Aggregates multiple small payments into one transaction
   */
  async settlePending(): Promise<BatchSettlement> {
    const pendingIds: string[] = [];
    let totalAmount = 0;

    for (const [id, invoice] of this.pendingInvoices) {
      if (invoice.status === PaymentStatus.RECEIVED) {
        pendingIds.push(id);
        totalAmount += invoice.amount;
      }
    }

    if (pendingIds.length === 0) {
      throw new Error('No pending payments to settle');
    }

    const settlement: BatchSettlement = {
      id: `batch_${Date.now()}`,
      invoices: pendingIds,
      totalAmount,
      status: 'pending',
      scheduledAt: new Date()
    };

    // Mark invoices as settling
    for (const id of pendingIds) {
      const invoice = this.pendingInvoices.get(id);
      if (invoice) {
        invoice.status = PaymentStatus.SETTLED;
      }
    }

    // In production: Create aggregated on-chain settlement transaction
    // For now, mark as settled (actual on-chain logic in Anchor program)
    settlement.status = 'settled';
    settlement.settledAt = new Date();
    
    // Record in history
    this.settlementHistory.push(settlement);

    return settlement;
  }

  /**
   * Open a payment channel with another agent
   * Enables instant off-chain micropayments
   * 
   * @note Phase 2 feature - Coming in v0.2.0
   * For now, use invoice-based payments with batch settlement
   */
  async openChannel(_counterparty: PublicKey, _deposit: number): Promise<{
    channelId: string;
    depositTx: string;
  }> {
    throw new Error(
      'Payment channels are a Phase 2 feature (v0.2.0). ' +
      'For now, use invoice-based payments with batch settlement.'
    );
  }

  /**
   * Send a micropayment through an open channel
   * 
   * @note Phase 2 feature - Coming in v0.2.0
   */
  async sendChannelPayment(_channelId: string, _amount: number): Promise<void> {
    throw new Error('Payment channels are a Phase 2 feature (v0.2.0).');
  }

  /**
   * Close a payment channel and settle on-chain
   * 
   * @note Phase 2 feature - Coming in v0.2.0
   */
  async closeChannel(_channelId: string): Promise<string> {
    throw new Error('Payment channels are a Phase 2 feature (v0.2.0).');
  }
}

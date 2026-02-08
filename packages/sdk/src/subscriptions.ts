/**
 * Subscription management for recurring payments
 */

import { PublicKey } from '@solana/web3.js';
import { Invoice, PaymentStatus } from './types';

export interface Subscription {
  id: string;
  /** Subscriber (payer) */
  subscriber: PublicKey;
  /** Service provider (recipient) */
  provider: PublicKey;
  /** Amount per period in SOL */
  amount: number;
  /** Billing interval */
  interval: SubscriptionInterval;
  /** Optional token (defaults to SOL) */
  token?: PublicKey;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Next billing date */
  nextBillingAt: Date;
  /** Last successful payment */
  lastPaymentAt?: Date;
  /** Number of successful payments */
  paymentCount: number;
  /** Metadata */
  metadata?: Record<string, any>;
}

export type SubscriptionInterval = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'past_due';

export interface CreateSubscriptionParams {
  subscriber: PublicKey;
  provider: PublicKey;
  amount: number;
  interval: SubscriptionInterval;
  token?: PublicKey;
  startAt?: Date;
  metadata?: Record<string, any>;
}

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private invoiceCreator: (sub: Subscription) => Promise<Invoice>;

  constructor(
    invoiceCreator: (sub: Subscription) => Promise<Invoice>
  ) {
    this.invoiceCreator = invoiceCreator;
  }

  /**
   * Create a new subscription
   */
  create(params: CreateSubscriptionParams): Subscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const subscription: Subscription = {
      id,
      subscriber: params.subscriber,
      provider: params.provider,
      amount: params.amount,
      interval: params.interval,
      token: params.token,
      status: 'active',
      createdAt: now,
      nextBillingAt: params.startAt || now,
      paymentCount: 0,
      metadata: params.metadata,
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  /**
   * Get subscription by ID
   */
  get(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * List subscriptions
   */
  list(filter?: {
    subscriber?: PublicKey;
    provider?: PublicKey;
    status?: SubscriptionStatus;
  }): Subscription[] {
    let subs = Array.from(this.subscriptions.values());

    if (filter?.subscriber) {
      subs = subs.filter(s => s.subscriber.equals(filter.subscriber!));
    }
    if (filter?.provider) {
      subs = subs.filter(s => s.provider.equals(filter.provider!));
    }
    if (filter?.status) {
      subs = subs.filter(s => s.status === filter.status);
    }

    return subs;
  }

  /**
   * Pause a subscription
   */
  pause(id: string): Subscription {
    const sub = this.subscriptions.get(id);
    if (!sub) throw new Error('Subscription not found');

    sub.status = 'paused';
    return sub;
  }

  /**
   * Resume a paused subscription
   */
  resume(id: string): Subscription {
    const sub = this.subscriptions.get(id);
    if (!sub) throw new Error('Subscription not found');

    if (sub.status !== 'paused') {
      throw new Error('Subscription is not paused');
    }

    sub.status = 'active';
    sub.nextBillingAt = new Date();
    return sub;
  }

  /**
   * Cancel a subscription
   */
  cancel(id: string): Subscription {
    const sub = this.subscriptions.get(id);
    if (!sub) throw new Error('Subscription not found');

    sub.status = 'cancelled';
    return sub;
  }

  /**
   * Process due subscriptions
   * Returns invoices for subscriptions that need payment
   */
  async processDue(): Promise<{ subscription: Subscription; invoice: Invoice }[]> {
    const now = new Date();
    const results: { subscription: Subscription; invoice: Invoice }[] = [];

    for (const sub of this.subscriptions.values()) {
      if (sub.status !== 'active') continue;
      if (sub.nextBillingAt > now) continue;

      try {
        // Create invoice for this billing period
        const invoice = await this.invoiceCreator(sub);

        // Update subscription
        sub.nextBillingAt = this.getNextBillingDate(sub);
        sub.paymentCount += 1;
        sub.lastPaymentAt = now;

        results.push({ subscription: sub, invoice });
      } catch (err) {
        console.error(`Failed to process subscription ${sub.id}:`, err);
        sub.status = 'past_due';
      }
    }

    return results;
  }

  /**
   * Calculate next billing date
   */
  private getNextBillingDate(sub: Subscription): Date {
    const current = sub.nextBillingAt;
    const next = new Date(current);

    switch (sub.interval) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    total: number;
    active: number;
    paused: number;
    cancelled: number;
    pastDue: number;
    mrr: number; // Monthly recurring revenue in SOL
  } {
    const subs = Array.from(this.subscriptions.values());

    const mrr = subs
      .filter(s => s.status === 'active')
      .reduce((sum, s) => {
        const multiplier = {
          hourly: 720, // ~30 days * 24 hours
          daily: 30,
          weekly: 4.33,
          monthly: 1,
        }[s.interval];
        return sum + s.amount * multiplier;
      }, 0);

    return {
      total: subs.length,
      active: subs.filter(s => s.status === 'active').length,
      paused: subs.filter(s => s.status === 'paused').length,
      cancelled: subs.filter(s => s.status === 'cancelled').length,
      pastDue: subs.filter(s => s.status === 'past_due').length,
      mrr,
    };
  }
}

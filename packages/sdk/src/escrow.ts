/**
 * @fileoverview Escrow system for complex multi-party agent payments.
 * 
 * Provides conditional escrow accounts with arbiter-based dispute resolution.
 * Supports time-locks, multi-sig release, oracle conditions, and automatic expiry.
 * 
 * @module escrow
 * @author SatsAgent
 * @license MIT
 */

import { PublicKey } from '@solana/web3.js';

export interface EscrowCondition {
  type: 'time' | 'signature' | 'oracle' | 'custom';
  params: Record<string, any>;
}

export interface Escrow {
  id: string;
  /** Depositor (buyer) */
  depositor: PublicKey;
  /** Beneficiary (seller) */
  beneficiary: PublicKey;
  /** Optional arbiter for disputes */
  arbiter?: PublicKey;
  /** Amount in escrow (SOL) */
  amount: number;
  /** Token mint (optional) */
  token?: PublicKey;
  /** Release conditions */
  conditions: EscrowCondition[];
  /** Escrow status */
  status: EscrowStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration (auto-refund after) */
  expiresAt?: Date;
  /** Description */
  description?: string;
}

export type EscrowStatus =
  | 'pending'      // Created, awaiting deposit
  | 'funded'       // Deposit received
  | 'released'     // Funds released to beneficiary
  | 'refunded'     // Funds returned to depositor
  | 'disputed'     // Under dispute resolution
  | 'expired';     // Expired without completion

export interface CreateEscrowParams {
  depositor: PublicKey;
  beneficiary: PublicKey;
  amount: number;
  arbiter?: PublicKey;
  token?: PublicKey;
  conditions?: EscrowCondition[];
  expiresIn?: string;
  description?: string;
}

export class EscrowManager {
  private escrows: Map<string, Escrow> = new Map();

  /**
   * Create a new escrow
   */
  create(params: CreateEscrowParams): Escrow {
    const id = `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const escrow: Escrow = {
      id,
      depositor: params.depositor,
      beneficiary: params.beneficiary,
      arbiter: params.arbiter,
      amount: params.amount,
      token: params.token,
      conditions: params.conditions || [],
      status: 'pending',
      createdAt: now,
      expiresAt: params.expiresIn ? this.parseExpiry(params.expiresIn) : undefined,
      description: params.description,
    };

    this.escrows.set(id, escrow);
    return escrow;
  }

  /**
   * Get escrow by ID
   */
  get(id: string): Escrow | undefined {
    return this.escrows.get(id);
  }

  /**
   * List escrows
   */
  list(filter?: {
    depositor?: PublicKey;
    beneficiary?: PublicKey;
    status?: EscrowStatus;
  }): Escrow[] {
    let escrows = Array.from(this.escrows.values());

    if (filter?.depositor) {
      escrows = escrows.filter(e => e.depositor.equals(filter.depositor!));
    }
    if (filter?.beneficiary) {
      escrows = escrows.filter(e => e.beneficiary.equals(filter.beneficiary!));
    }
    if (filter?.status) {
      escrows = escrows.filter(e => e.status === filter.status);
    }

    return escrows;
  }

  /**
   * Mark escrow as funded
   */
  fund(id: string): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'pending') {
      throw new Error('Escrow is not pending');
    }

    escrow.status = 'funded';
    return escrow;
  }

  /**
   * Release funds to beneficiary
   */
  release(id: string, signer: PublicKey): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'funded') {
      throw new Error('Escrow is not funded');
    }

    // Check if signer can release
    const canRelease = 
      signer.equals(escrow.depositor) ||
      (escrow.arbiter && signer.equals(escrow.arbiter));

    if (!canRelease) {
      throw new Error('Unauthorized to release escrow');
    }

    escrow.status = 'released';
    return escrow;
  }

  /**
   * Refund to depositor
   */
  refund(id: string, signer: PublicKey): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'funded') {
      throw new Error('Escrow is not funded');
    }

    // Check if signer can refund
    const canRefund =
      signer.equals(escrow.beneficiary) ||
      (escrow.arbiter && signer.equals(escrow.arbiter));

    if (!canRefund) {
      throw new Error('Unauthorized to refund escrow');
    }

    escrow.status = 'refunded';
    return escrow;
  }

  /**
   * Initiate dispute
   */
  dispute(id: string, signer: PublicKey): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'funded') {
      throw new Error('Escrow is not funded');
    }
    if (!escrow.arbiter) {
      throw new Error('Escrow has no arbiter for disputes');
    }

    // Either party can initiate dispute
    const canDispute =
      signer.equals(escrow.depositor) ||
      signer.equals(escrow.beneficiary);

    if (!canDispute) {
      throw new Error('Unauthorized to dispute escrow');
    }

    escrow.status = 'disputed';
    return escrow;
  }

  /**
   * Resolve dispute (arbiter only)
   */
  resolveDispute(
    id: string,
    arbiter: PublicKey,
    resolution: 'release' | 'refund' | 'split',
    splitRatio?: number
  ): Escrow {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.status !== 'disputed') {
      throw new Error('Escrow is not in dispute');
    }
    if (!escrow.arbiter || !arbiter.equals(escrow.arbiter)) {
      throw new Error('Only arbiter can resolve disputes');
    }

    // In production: execute the resolution on-chain
    escrow.status = resolution === 'release' ? 'released' : 'refunded';
    return escrow;
  }

  /**
   * Check and expire old escrows
   */
  processExpired(): Escrow[] {
    const now = new Date();
    const expired: Escrow[] = [];

    for (const escrow of this.escrows.values()) {
      if (
        escrow.expiresAt &&
        escrow.expiresAt < now &&
        ['pending', 'funded'].includes(escrow.status)
      ) {
        escrow.status = 'expired';
        expired.push(escrow);
      }
    }

    return expired;
  }

  /**
   * Check if conditions are met
   */
  async checkConditions(id: string): Promise<{
    allMet: boolean;
    results: { condition: EscrowCondition; met: boolean }[];
  }> {
    const escrow = this.escrows.get(id);
    if (!escrow) throw new Error('Escrow not found');

    const results: { condition: EscrowCondition; met: boolean }[] = [];

    for (const condition of escrow.conditions) {
      let met = false;

      switch (condition.type) {
        case 'time':
          // Time-based condition: params.after (timestamp)
          met = Date.now() >= condition.params.after;
          break;

        case 'signature':
          // Signature condition: params.signatures (array of required pubkeys)
          // Would check on-chain in production
          met = false;
          break;

        case 'oracle':
          // Oracle condition: params.oracle, params.expectedValue
          // Would query oracle in production
          met = false;
          break;

        case 'custom':
          // Custom condition: evaluate params.expression
          met = false;
          break;
      }

      results.push({ condition, met });
    }

    const allMet = results.length === 0 || results.every(r => r.met);
    return { allMet, results };
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

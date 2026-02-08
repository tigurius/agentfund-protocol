/**
 * Agent reputation system
 * 
 * Track payment history and build trust scores
 */

import { PublicKey } from '@solana/web3.js';

export interface AgentReputation {
  /** Agent's public key */
  agent: PublicKey;
  /** Total transactions (as payer) */
  paymentsMade: number;
  /** Total transactions (as recipient) */
  paymentsReceived: number;
  /** Total volume as payer (SOL) */
  volumePaid: number;
  /** Total volume as recipient (SOL) */
  volumeReceived: number;
  /** Successful payments (no disputes) */
  successfulPayments: number;
  /** Failed/disputed payments */
  failedPayments: number;
  /** Average payment size */
  avgPaymentSize: number;
  /** Trust score (0-100) */
  trustScore: number;
  /** First seen timestamp */
  firstSeen: Date;
  /** Last activity timestamp */
  lastActive: Date;
  /** Verification status */
  verified: boolean;
  /** Tags/badges */
  badges: string[];
}

export interface ReputationEvent {
  type: 'payment_sent' | 'payment_received' | 'payment_failed' | 'dispute';
  agent: PublicKey;
  counterparty: PublicKey;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ReputationSystem {
  private reputations: Map<string, AgentReputation> = new Map();
  private events: ReputationEvent[] = [];

  /**
   * Get or create reputation for an agent
   */
  getOrCreate(agent: PublicKey): AgentReputation {
    const key = agent.toString();
    
    if (!this.reputations.has(key)) {
      const now = new Date();
      this.reputations.set(key, {
        agent,
        paymentsMade: 0,
        paymentsReceived: 0,
        volumePaid: 0,
        volumeReceived: 0,
        successfulPayments: 0,
        failedPayments: 0,
        avgPaymentSize: 0,
        trustScore: 50, // Start neutral
        firstSeen: now,
        lastActive: now,
        verified: false,
        badges: [],
      });
    }

    return this.reputations.get(key)!;
  }

  /**
   * Record a successful payment
   */
  recordPayment(params: {
    payer: PublicKey;
    recipient: PublicKey;
    amount: number;
  }): void {
    const { payer, recipient, amount } = params;
    const now = new Date();

    // Update payer reputation
    const payerRep = this.getOrCreate(payer);
    payerRep.paymentsMade += 1;
    payerRep.volumePaid += amount;
    payerRep.successfulPayments += 1;
    payerRep.lastActive = now;
    payerRep.avgPaymentSize = payerRep.volumePaid / payerRep.paymentsMade;
    this.recalculateTrustScore(payerRep);

    // Update recipient reputation
    const recipientRep = this.getOrCreate(recipient);
    recipientRep.paymentsReceived += 1;
    recipientRep.volumeReceived += amount;
    recipientRep.successfulPayments += 1;
    recipientRep.lastActive = now;
    this.recalculateTrustScore(recipientRep);

    // Record event
    this.events.push({
      type: 'payment_sent',
      agent: payer,
      counterparty: recipient,
      amount,
      timestamp: now,
    });

    // Check for badges
    this.checkBadges(payerRep);
    this.checkBadges(recipientRep);
  }

  /**
   * Record a failed payment
   */
  recordFailure(params: {
    agent: PublicKey;
    counterparty: PublicKey;
    amount: number;
    reason: string;
  }): void {
    const { agent, counterparty, amount, reason } = params;
    const now = new Date();

    const rep = this.getOrCreate(agent);
    rep.failedPayments += 1;
    rep.lastActive = now;
    this.recalculateTrustScore(rep);

    this.events.push({
      type: 'payment_failed',
      agent,
      counterparty,
      amount,
      timestamp: now,
      metadata: { reason },
    });
  }

  /**
   * Record a dispute
   */
  recordDispute(params: {
    agent: PublicKey;
    counterparty: PublicKey;
    amount: number;
  }): void {
    const { agent, counterparty, amount } = params;
    const now = new Date();

    // Both parties get a dispute mark
    for (const pubkey of [agent, counterparty]) {
      const rep = this.getOrCreate(pubkey);
      rep.failedPayments += 1;
      rep.lastActive = now;
      this.recalculateTrustScore(rep);
    }

    this.events.push({
      type: 'dispute',
      agent,
      counterparty,
      amount,
      timestamp: now,
    });
  }

  /**
   * Calculate trust score
   */
  private recalculateTrustScore(rep: AgentReputation): void {
    // Base score starts at 50
    let score = 50;

    // Successful payments increase score
    const totalPayments = rep.successfulPayments + rep.failedPayments;
    if (totalPayments > 0) {
      const successRate = rep.successfulPayments / totalPayments;
      score += successRate * 30; // Up to +30 for perfect record
    }

    // Volume adds credibility (log scale)
    const totalVolume = rep.volumePaid + rep.volumeReceived;
    if (totalVolume > 0) {
      const volumeBonus = Math.min(Math.log10(totalVolume * 1000) * 3, 15);
      score += volumeBonus; // Up to +15 for high volume
    }

    // Activity recency
    const daysSinceActive = 
      (Date.now() - rep.lastActive.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 7) {
      score += 5; // Active in last week
    } else if (daysSinceActive > 30) {
      score -= 5; // Inactive penalty
    }

    // Verification bonus
    if (rep.verified) {
      score += 10;
    }

    // Clamp to 0-100
    rep.trustScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Check and award badges
   */
  private checkBadges(rep: AgentReputation): void {
    const badges = rep.badges;

    // First payment
    if (rep.paymentsMade >= 1 && !badges.includes('first_payment')) {
      badges.push('first_payment');
    }

    // Power payer (100+ payments)
    if (rep.paymentsMade >= 100 && !badges.includes('power_payer')) {
      badges.push('power_payer');
    }

    // Whale (1000+ SOL volume)
    const totalVolume = rep.volumePaid + rep.volumeReceived;
    if (totalVolume >= 1000 && !badges.includes('whale')) {
      badges.push('whale');
    }

    // Perfect record (50+ payments, no failures)
    if (
      rep.successfulPayments >= 50 &&
      rep.failedPayments === 0 &&
      !badges.includes('perfect_record')
    ) {
      badges.push('perfect_record');
    }

    // Veteran (30+ days active)
    const daysActive = 
      (Date.now() - rep.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
    if (daysActive >= 30 && !badges.includes('veteran')) {
      badges.push('veteran');
    }
  }

  /**
   * Get trust level label
   */
  getTrustLevel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'High';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 25) return 'Low';
    return 'Very Low';
  }

  /**
   * Verify an agent (admin function)
   */
  verify(agent: PublicKey): AgentReputation {
    const rep = this.getOrCreate(agent);
    rep.verified = true;
    if (!rep.badges.includes('verified')) {
      rep.badges.push('verified');
    }
    this.recalculateTrustScore(rep);
    return rep;
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit = 10): AgentReputation[] {
    return Array.from(this.reputations.values())
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, limit);
  }

  /**
   * Get recent events for an agent
   */
  getEvents(agent: PublicKey, limit = 50): ReputationEvent[] {
    return this.events
      .filter(e => e.agent.equals(agent) || e.counterparty.equals(agent))
      .slice(-limit);
  }

  /**
   * Export reputation data (for on-chain attestation)
   */
  exportForAttestation(agent: PublicKey): {
    agent: string;
    trustScore: number;
    totalPayments: number;
    successRate: number;
    volume: number;
    badges: string[];
    verified: boolean;
  } {
    const rep = this.getOrCreate(agent);
    const totalPayments = rep.successfulPayments + rep.failedPayments;
    const successRate = totalPayments > 0 
      ? rep.successfulPayments / totalPayments 
      : 0;

    return {
      agent: agent.toString(),
      trustScore: rep.trustScore,
      totalPayments,
      successRate,
      volume: rep.volumePaid + rep.volumeReceived,
      badges: rep.badges,
      verified: rep.verified,
    };
  }
}

// Singleton instance
export const reputation = new ReputationSystem();

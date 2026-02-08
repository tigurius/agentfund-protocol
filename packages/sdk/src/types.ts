/**
 * Core types for AgentFund Protocol
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Payment invoice for agent-to-agent transactions
 */
export interface Invoice {
  id: string;
  /** Recipient agent's wallet */
  recipient: PublicKey;
  /** Amount in SOL (or token) */
  amount: number;
  /** Optional token mint (defaults to SOL) */
  token?: PublicKey;
  /** Human-readable description */
  memo?: string;
  /** Invoice expiration */
  expiresAt: Date;
  /** Current status */
  status: PaymentStatus;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  /** Awaiting payment */
  PENDING = 'pending',
  /** Payment received, awaiting settlement */
  RECEIVED = 'received',
  /** Payment settled on-chain */
  SETTLED = 'settled',
  /** Invoice expired */
  EXPIRED = 'expired',
  /** Payment failed */
  FAILED = 'failed'
}

/**
 * Batch settlement for micropayments
 */
export interface BatchSettlement {
  id: string;
  /** Invoices included in this batch */
  invoices: string[];
  /** Total amount being settled */
  totalAmount: number;
  /** Settlement transaction signature */
  txSignature?: string;
  /** Settlement status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Scheduled settlement time */
  scheduledAt: Date;
  /** Actual settlement time */
  settledAt?: Date;
}

/**
 * Self-funding configuration
 */
export interface SelfFundingConfig {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token description */
  description?: string;
  /** Initial supply */
  initialSupply: number;
  /** Creator fee percentage (0-1) */
  creatorFee: number;
  /** Bonding curve type */
  curveType: 'linear' | 'exponential' | 'sigmoid';
}

/**
 * Treasury configuration
 */
export interface TreasuryConfig {
  /** Wallet for collecting fees */
  feeCollector: PublicKey;
  /** Auto-convert fees to SOL */
  autoConvert: boolean;
  /** Minimum balance to maintain */
  minBalance: number;
}

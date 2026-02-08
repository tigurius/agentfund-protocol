/**
 * AgentFund SDK
 * Self-funding infrastructure for autonomous agents on Solana
 */

// Main class
export { AgentFund } from './agentfund';

// API Client
export { AgentFundClient } from './client';

// Types
export { Invoice, PaymentStatus, BatchSettlement, SelfFundingConfig, TreasuryConfig } from './types';

// Modules
export { SelfFunding } from './self-funding';
export { Micropayments } from './micropayments';
export { Treasury } from './treasury';

// Webhooks
export { WebhookManager, webhooks, WebhookEvent, WebhookEventType, WebhookConfig } from './webhooks';

// Subscriptions
export { SubscriptionManager, Subscription, SubscriptionInterval, SubscriptionStatus } from './subscriptions';

// Jupiter Integration
export { JupiterIntegration, SwapQuote, SwapResult, TOKENS } from './jupiter';

// Multi-token payments
export { MultiTokenPayments, TokenPaymentConfig, TokenInvoice } from './multi-token';

// Escrow
export { EscrowManager, Escrow, EscrowCondition, EscrowStatus } from './escrow';

// Reputation
export { ReputationSystem, AgentReputation, ReputationEvent, reputation } from './reputation';

// Agent Registry
export { 
  AgentRegistry, 
  AgentProfile, 
  ServiceRequest, 
  AgentSearchFilters, 
  RegistryStats,
  STANDARD_CAPABILITIES,
  StandardCapability,
  createRegistry 
} from './registry';

// Streaming Payments
export {
  StreamingPayments,
  PaymentStream,
  StreamConfig,
  StreamStatus,
  StreamEvent,
  StreamEventType,
  STREAM_DURATIONS,
  createStreamingPayments
} from './streaming';

// Utilities
export * from './constants';
export * from './pda';

// Instructions (for advanced usage)
export * from './instructions';

// Program Client (with IDL)
export { 
  AgentFundProgram, 
  createProgram,
  IDL,
  TreasuryAccount,
  InvoiceAccount,
  AgentProfileAccount,
  ServiceRequestAccount
} from './program';

// Persistence
export {
  createPersistence,
  createMemoryPersistence,
  InvoiceStore,
  SubscriptionStore,
  SettlementStore,
  FileStorageAdapter,
  MemoryStorageAdapter,
  StorageAdapter
} from './persistence';

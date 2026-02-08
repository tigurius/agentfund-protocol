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

// Utilities
export * from './constants';
export * from './pda';

// Instructions (for advanced usage)
export * from './instructions';

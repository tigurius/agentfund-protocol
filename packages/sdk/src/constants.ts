/**
 * Protocol constants
 */

import { PublicKey } from '@solana/web3.js';

// Program IDs
export const AGENTFUND_PROGRAM_ID = new PublicKey(
  '5LqS68L9kfrB5h2D3NjJ9d8jEJz7egkyXUWEySGNZUeg'
);

// PDA Seeds
export const TREASURY_SEED = Buffer.from('treasury');
export const INVOICE_SEED = Buffer.from('invoice');
export const BATCH_SEED = Buffer.from('batch');
export const CHANNEL_SEED = Buffer.from('channel');
export const ESCROW_SEED = Buffer.from('escrow');

// Limits
export const MAX_BATCH_SIZE = 50;
export const MAX_MEMO_LENGTH = 256;

// Default values
export const DEFAULT_INVOICE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_BATCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Networks
export const NETWORKS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com',
  'localnet': 'http://localhost:8899',
} as const;

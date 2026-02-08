/**
 * PDA (Program Derived Address) utilities
 */

import { PublicKey } from '@solana/web3.js';
import {
  AGENTFUND_PROGRAM_ID,
  TREASURY_SEED,
  INVOICE_SEED,
  BATCH_SEED,
  CHANNEL_SEED,
  ESCROW_SEED,
} from './constants';

/**
 * Derive treasury PDA for an agent
 */
export function getTreasuryPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, owner.toBuffer()],
    AGENTFUND_PROGRAM_ID
  );
}

/**
 * Derive invoice PDA from invoice ID
 */
export function getInvoicePDA(invoiceId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INVOICE_SEED, invoiceId],
    AGENTFUND_PROGRAM_ID
  );
}

/**
 * Derive batch settlement PDA
 */
export function getBatchPDA(batchId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BATCH_SEED, batchId],
    AGENTFUND_PROGRAM_ID
  );
}

/**
 * Derive payment channel PDA
 */
export function getChannelPDA(channelId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHANNEL_SEED, channelId],
    AGENTFUND_PROGRAM_ID
  );
}

/**
 * Derive channel escrow PDA
 */
export function getChannelEscrowPDA(channelId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, channelId],
    AGENTFUND_PROGRAM_ID
  );
}

/**
 * Generate a random 32-byte ID
 */
export function generateId(): Buffer {
  const id = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    id[i] = Math.floor(Math.random() * 256);
  }
  return id;
}

/**
 * Convert string ID to buffer
 */
export function stringToIdBuffer(id: string): Buffer {
  const hash = Buffer.alloc(32);
  const bytes = Buffer.from(id);
  bytes.copy(hash, 0, 0, Math.min(32, bytes.length));
  return hash;
}

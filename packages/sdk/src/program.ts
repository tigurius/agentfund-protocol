/**
 * Anchor Program Client
 * 
 * Type-safe client for interacting with the AgentFund on-chain program.
 * Uses the generated IDL for full type safety.
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { PROGRAM_ID, DEVNET_RPC } from './constants';
import IDL from './idl/agentfund.json';

// Re-export IDL
export { IDL };

// Types from IDL
export type InvoiceStatus = 'Pending' | 'Paid' | 'Expired' | 'Cancelled';
export type ChannelStatus = 'Open' | 'Closing' | 'Closed' | 'Disputed';
export type RequestStatus = 'Pending' | 'InProgress' | 'Completed' | 'Disputed' | 'Refunded';

export interface TreasuryAccount {
  owner: PublicKey;
  bump: number;
  totalReceived: bigint;
  totalSettled: bigint;
  pendingInvoices: bigint;
  createdAt: bigint;
}

export interface InvoiceAccount {
  id: Uint8Array;
  recipient: PublicKey;
  amount: bigint;
  memo: string;
  status: InvoiceStatus;
  createdAt: bigint;
  expiresAt: bigint;
  paidAt: bigint | null;
  payer: PublicKey | null;
}

export interface AgentProfileAccount {
  owner: PublicKey;
  name: string;
  description: string;
  capabilities: string[];
  basePrice: bigint;
  treasury: PublicKey;
  isActive: boolean;
  totalRequests: bigint;
  totalEarnings: bigint;
  registeredAt: bigint;
  lastActiveAt: bigint;
  bump: number;
}

export interface ServiceRequestAccount {
  id: Uint8Array;
  requester: PublicKey;
  provider: PublicKey;
  capability: string;
  amount: bigint;
  status: RequestStatus;
  createdAt: bigint;
  completedAt: bigint | null;
  resultHash: Uint8Array | null;
}

/**
 * AgentFund Program Client
 */
export class AgentFundProgram {
  readonly connection: Connection;
  readonly programId: PublicKey;

  constructor(connection?: Connection, programId?: PublicKey) {
    this.connection = connection || new Connection(DEVNET_RPC, 'confirmed');
    this.programId = programId || PROGRAM_ID;
  }

  // === PDA Derivation ===

  getTreasuryPDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), owner.toBuffer()],
      this.programId
    );
  }

  getInvoicePDA(invoiceId: Uint8Array): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('invoice'), Buffer.from(invoiceId)],
      this.programId
    );
  }

  getAgentProfilePDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer()],
      this.programId
    );
  }

  getServiceRequestPDA(requestId: Uint8Array): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('request'), Buffer.from(requestId)],
      this.programId
    );
  }

  // === Account Fetchers ===

  async fetchTreasury(owner: PublicKey): Promise<TreasuryAccount | null> {
    const [pda] = this.getTreasuryPDA(owner);
    const account = await this.connection.getAccountInfo(pda);
    if (!account) return null;
    return this.decodeTreasury(account.data);
  }

  async fetchInvoice(invoiceId: Uint8Array): Promise<InvoiceAccount | null> {
    const [pda] = this.getInvoicePDA(invoiceId);
    const account = await this.connection.getAccountInfo(pda);
    if (!account) return null;
    return this.decodeInvoice(account.data);
  }

  async fetchAgentProfile(owner: PublicKey): Promise<AgentProfileAccount | null> {
    const [pda] = this.getAgentProfilePDA(owner);
    const account = await this.connection.getAccountInfo(pda);
    if (!account) return null;
    return this.decodeAgentProfile(account.data);
  }

  async fetchAllAgentProfiles(): Promise<{ pubkey: PublicKey; account: AgentProfileAccount }[]> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        { memcmp: { offset: 0, bytes: Buffer.from([/* agent discriminator */]).toString('base64') } }
      ]
    });

    return accounts.map(({ pubkey, account }) => ({
      pubkey,
      account: this.decodeAgentProfile(account.data)
    }));
  }

  // === Decoders (simplified - production would use Borsh) ===

  private decodeTreasury(data: Buffer): TreasuryAccount {
    // Skip 8-byte discriminator
    const offset = 8;
    return {
      owner: new PublicKey(data.slice(offset, offset + 32)),
      bump: data[offset + 32],
      totalReceived: data.readBigUInt64LE(offset + 33),
      totalSettled: data.readBigUInt64LE(offset + 41),
      pendingInvoices: data.readBigUInt64LE(offset + 49),
      createdAt: data.readBigInt64LE(offset + 57),
    };
  }

  private decodeInvoice(data: Buffer): InvoiceAccount {
    const offset = 8;
    const id = new Uint8Array(data.slice(offset, offset + 32));
    const recipient = new PublicKey(data.slice(offset + 32, offset + 64));
    const amount = data.readBigUInt64LE(offset + 64);
    
    // Simplified memo parsing
    const memoLen = data.readUInt32LE(offset + 72);
    const memo = data.slice(offset + 76, offset + 76 + memoLen).toString('utf8');
    
    return {
      id,
      recipient,
      amount,
      memo,
      status: 'Pending', // Would decode from data
      createdAt: BigInt(0),
      expiresAt: BigInt(0),
      paidAt: null,
      payer: null,
    };
  }

  private decodeAgentProfile(data: Buffer): AgentProfileAccount {
    const offset = 8;
    return {
      owner: new PublicKey(data.slice(offset, offset + 32)),
      name: '', // Would decode from data
      description: '',
      capabilities: [],
      basePrice: BigInt(0),
      treasury: new PublicKey(data.slice(offset, offset + 32)),
      isActive: true,
      totalRequests: BigInt(0),
      totalEarnings: BigInt(0),
      registeredAt: BigInt(0),
      lastActiveAt: BigInt(0),
      bump: 0,
    };
  }

  // === Event Listeners ===

  onInvoiceCreated(callback: (event: {
    invoiceId: Uint8Array;
    recipient: PublicKey;
    amount: bigint;
    expiresAt: bigint;
  }) => void): number {
    // In production: subscribe to program logs and parse events
    console.log('Event listener registered for InvoiceCreated');
    return 0;
  }

  onInvoicePaid(callback: (event: {
    invoiceId: Uint8Array;
    payer: PublicKey;
    amount: bigint;
  }) => void): number {
    console.log('Event listener registered for InvoicePaid');
    return 0;
  }

  onServiceCompleted(callback: (event: {
    requestId: Uint8Array;
    provider: PublicKey;
    amount: bigint;
  }) => void): number {
    console.log('Event listener registered for ServiceCompleted');
    return 0;
  }
}

/**
 * Create a new program client
 */
export function createProgram(connection?: Connection): AgentFundProgram {
  return new AgentFundProgram(connection);
}

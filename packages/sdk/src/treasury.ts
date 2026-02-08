/**
 * Treasury management module
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getTreasuryPDA } from './pda';
import { createInitializeTreasuryInstruction } from './instructions';

export interface TreasuryState {
  owner: PublicKey;
  totalReceived: bigint;
  totalSettled: bigint;
  pendingInvoices: number;
  createdAt: Date;
}

export class Treasury {
  private connection: Connection;
  private wallet: Keypair | PublicKey;

  constructor(connection: Connection, wallet: Keypair | PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Get the treasury PDA for this agent
   */
  getPDA(): [PublicKey, number] {
    return getTreasuryPDA(this.getPublicKey());
  }

  /**
   * Initialize the treasury account
   */
  async initialize(): Promise<string> {
    if (!(this.wallet instanceof Keypair)) {
      throw new Error('Keypair required to initialize treasury');
    }

    const instruction = createInitializeTreasuryInstruction(
      this.wallet.publicKey
    );

    const transaction = new Transaction().add(instruction);
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet]
    );

    return signature;
  }

  /**
   * Check if treasury is initialized
   */
  async isInitialized(): Promise<boolean> {
    const [pda] = this.getPDA();
    const account = await this.connection.getAccountInfo(pda);
    return account !== null;
  }

  /**
   * Get treasury state
   */
  async getState(): Promise<TreasuryState | null> {
    const [pda] = this.getPDA();
    const account = await this.connection.getAccountInfo(pda);
    
    if (!account) return null;

    // Parse account data (simplified - in production use borsh)
    const data = account.data;
    
    return {
      owner: new PublicKey(data.slice(8, 40)),
      totalReceived: BigInt(data.readBigUInt64LE(41)),
      totalSettled: BigInt(data.readBigUInt64LE(49)),
      pendingInvoices: data.readUInt32LE(57),
      createdAt: new Date(Number(data.readBigInt64LE(61)) * 1000),
    };
  }

  /**
   * Get total balance (received - settled)
   */
  async getBalance(): Promise<bigint> {
    const state = await this.getState();
    if (!state) return BigInt(0);
    return state.totalReceived - state.totalSettled;
  }

  private getPublicKey(): PublicKey {
    if (this.wallet instanceof PublicKey) {
      return this.wallet;
    }
    return this.wallet.publicKey;
  }
}

/**
 * @fileoverview Treasury management module for AgentFund Protocol.
 * 
 * Provides secure, on-chain treasury management for autonomous agents.
 * Each agent has a unique Program Derived Address (PDA) that holds their funds.
 * 
 * @module treasury
 * @author SatsAgent
 * @license MIT
 * 
 * @example
 * ```typescript
 * import { Treasury } from '@agentfund/sdk';
 * import { Connection, Keypair } from '@solana/web3.js';
 * 
 * const connection = new Connection('https://api.devnet.solana.com');
 * const wallet = Keypair.generate();
 * const treasury = new Treasury(connection, wallet);
 * 
 * // Initialize treasury on-chain
 * const signature = await treasury.initialize();
 * console.log('Treasury created:', signature);
 * 
 * // Check balance
 * const balance = await treasury.getBalance();
 * console.log('Balance:', balance, 'lamports');
 * ```
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

/**
 * Represents the on-chain state of an agent's treasury account.
 * 
 * @interface TreasuryState
 * @property {PublicKey} owner - The wallet address that owns this treasury
 * @property {bigint} totalReceived - Cumulative amount received in lamports
 * @property {bigint} totalSettled - Cumulative amount settled/withdrawn in lamports
 * @property {number} pendingInvoices - Number of invoices awaiting payment
 * @property {Date} createdAt - Timestamp when the treasury was initialized
 */
export interface TreasuryState {
  /** The wallet address that owns this treasury */
  owner: PublicKey;
  /** Cumulative amount received in lamports */
  totalReceived: bigint;
  /** Cumulative amount settled/withdrawn in lamports */
  totalSettled: bigint;
  /** Number of invoices awaiting payment */
  pendingInvoices: number;
  /** Timestamp when the treasury was initialized */
  createdAt: Date;
}

/**
 * Configuration options for Treasury initialization.
 * 
 * @interface TreasuryConfig
 * @property {number} [confirmationTimeout] - Transaction confirmation timeout in ms
 * @property {'processed' | 'confirmed' | 'finalized'} [commitment] - Solana commitment level
 */
export interface TreasuryConfig {
  /** Transaction confirmation timeout in milliseconds. Default: 30000 */
  confirmationTimeout?: number;
  /** Solana commitment level. Default: 'confirmed' */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Treasury management class for autonomous agents.
 * 
 * The Treasury class provides a secure way for agents to manage their funds
 * on Solana. Each agent has a unique Program Derived Address (PDA) that
 * serves as their treasury, enabling:
 * 
 * - **Deterministic addressing**: Treasury address is derived from the owner's pubkey
 * - **Permissionless creation**: Any agent can initialize their own treasury
 * - **Transparent accounting**: All funds and transactions are on-chain
 * - **Programmatic control**: Full SDK access for automated fund management
 * 
 * @class Treasury
 * 
 * @example
 * ```typescript
 * // Create treasury instance
 * const treasury = new Treasury(connection, wallet);
 * 
 * // Initialize on-chain (one-time)
 * if (!(await treasury.isInitialized())) {
 *   await treasury.initialize();
 * }
 * 
 * // Get current state
 * const state = await treasury.getState();
 * console.log('Total received:', state?.totalReceived);
 * console.log('Total settled:', state?.totalSettled);
 * ```
 */
export class Treasury {
  private connection: Connection;
  private wallet: Keypair | PublicKey;
  private config: TreasuryConfig;

  /**
   * Creates a new Treasury instance.
   * 
   * @param {Connection} connection - Solana RPC connection
   * @param {Keypair | PublicKey} wallet - Agent's wallet (Keypair for write operations, PublicKey for read-only)
   * @param {TreasuryConfig} [config] - Optional configuration
   * 
   * @example
   * ```typescript
   * // With Keypair (full access)
   * const treasury = new Treasury(connection, keypair);
   * 
   * // With PublicKey (read-only)
   * const readOnlyTreasury = new Treasury(connection, publicKey);
   * ```
   */
  constructor(
    connection: Connection,
    wallet: Keypair | PublicKey,
    config: TreasuryConfig = {}
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = {
      confirmationTimeout: config.confirmationTimeout ?? 30000,
      commitment: config.commitment ?? 'confirmed',
    };
  }

  /**
   * Derives the treasury PDA for this agent.
   * 
   * The PDA is deterministically derived from the owner's public key,
   * ensuring each agent has a unique, predictable treasury address.
   * 
   * @returns {[PublicKey, number]} Tuple of [PDA address, bump seed]
   * 
   * @example
   * ```typescript
   * const [treasuryAddress, bump] = treasury.getPDA();
   * console.log('Treasury PDA:', treasuryAddress.toBase58());
   * ```
   */
  getPDA(): [PublicKey, number] {
    return getTreasuryPDA(this.getPublicKey());
  }

  /**
   * Initializes the treasury account on-chain.
   * 
   * This creates the PDA account and sets up the initial treasury state.
   * Can only be called once per agent. Requires a Keypair wallet.
   * 
   * @returns {Promise<string>} Transaction signature
   * @throws {Error} If wallet is not a Keypair or treasury already exists
   * 
   * @example
   * ```typescript
   * try {
   *   const signature = await treasury.initialize();
   *   console.log('Treasury initialized:', signature);
   * } catch (error) {
   *   if (error.message.includes('already exists')) {
   *     console.log('Treasury already initialized');
   *   }
   * }
   * ```
   */
  async initialize(): Promise<string> {
    if (!(this.wallet instanceof Keypair)) {
      throw new Error('Keypair required to initialize treasury');
    }

    // Check if already initialized
    if (await this.isInitialized()) {
      throw new Error('Treasury already initialized');
    }

    const instruction = createInitializeTreasuryInstruction(
      this.wallet.publicKey
    );

    const transaction = new Transaction().add(instruction);
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet],
      { commitment: this.config.commitment }
    );

    return signature;
  }

  /**
   * Checks if the treasury account has been initialized on-chain.
   * 
   * @returns {Promise<boolean>} True if treasury exists, false otherwise
   * 
   * @example
   * ```typescript
   * const exists = await treasury.isInitialized();
   * if (!exists) {
   *   await treasury.initialize();
   * }
   * ```
   */
  async isInitialized(): Promise<boolean> {
    const [pda] = this.getPDA();
    const account = await this.connection.getAccountInfo(pda);
    return account !== null;
  }

  /**
   * Retrieves the current treasury state from on-chain.
   * 
   * Returns null if the treasury has not been initialized.
   * 
   * @returns {Promise<TreasuryState | null>} Treasury state or null if not initialized
   * 
   * @example
   * ```typescript
   * const state = await treasury.getState();
   * if (state) {
   *   console.log('Owner:', state.owner.toBase58());
   *   console.log('Total received:', state.totalReceived, 'lamports');
   *   console.log('Pending invoices:', state.pendingInvoices);
   * }
   * ```
   */
  async getState(): Promise<TreasuryState | null> {
    const [pda] = this.getPDA();
    const account = await this.connection.getAccountInfo(pda);
    
    if (!account) return null;

    // Parse account data
    // Account layout:
    // - 8 bytes: discriminator
    // - 32 bytes: owner pubkey
    // - 1 byte: bump
    // - 8 bytes: total_received (u64)
    // - 8 bytes: total_settled (u64)
    // - 4 bytes: pending_invoices (u32)
    // - 8 bytes: created_at (i64)
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
   * Calculates the current treasury balance.
   * 
   * Balance = totalReceived - totalSettled
   * 
   * @returns {Promise<bigint>} Current balance in lamports
   * 
   * @example
   * ```typescript
   * const balance = await treasury.getBalance();
   * const solBalance = Number(balance) / 1e9;
   * console.log('Balance:', solBalance, 'SOL');
   * ```
   */
  async getBalance(): Promise<bigint> {
    const state = await this.getState();
    if (!state) return BigInt(0);
    return state.totalReceived - state.totalSettled;
  }

  /**
   * Gets the SOL balance of the treasury PDA account.
   * 
   * This returns the actual lamports held in the PDA account,
   * which may differ from the accounting balance during pending operations.
   * 
   * @returns {Promise<bigint>} Account balance in lamports
   * 
   * @example
   * ```typescript
   * const accountBalance = await treasury.getAccountBalance();
   * console.log('Account holds:', accountBalance, 'lamports');
   * ```
   */
  async getAccountBalance(): Promise<bigint> {
    const [pda] = this.getPDA();
    const balance = await this.connection.getBalance(pda);
    return BigInt(balance);
  }

  /**
   * Returns the public key associated with this treasury.
   * 
   * @returns {PublicKey} The owner's public key
   * @private
   */
  private getPublicKey(): PublicKey {
    if (this.wallet instanceof PublicKey) {
      return this.wallet;
    }
    return this.wallet.publicKey;
  }

  /**
   * Returns the treasury address as a base58 string.
   * 
   * @returns {string} Treasury PDA address in base58 format
   * 
   * @example
   * ```typescript
   * const address = treasury.getAddress();
   * console.log('Send payments to:', address);
   * ```
   */
  getAddress(): string {
    const [pda] = this.getPDA();
    return pda.toBase58();
  }
}

/**
 * Creates a new Treasury instance with default configuration.
 * 
 * Convenience function for quick treasury setup.
 * 
 * @param {Connection} connection - Solana RPC connection
 * @param {Keypair | PublicKey} wallet - Agent's wallet
 * @returns {Treasury} New Treasury instance
 * 
 * @example
 * ```typescript
 * import { createTreasury } from '@agentfund/sdk';
 * 
 * const treasury = createTreasury(connection, wallet);
 * ```
 */
export function createTreasury(
  connection: Connection,
  wallet: Keypair | PublicKey
): Treasury {
  return new Treasury(connection, wallet);
}

/**
 * Self-Funding Module
 * Tools for agents to launch their own funding mechanisms
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { SelfFundingConfig, TreasuryConfig } from './types';

export class SelfFunding {
  private connection: Connection;
  private wallet: Keypair | PublicKey;

  constructor(connection: Connection, wallet: Keypair | PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Launch a new token with bonding curve
   * Uses Raydium LaunchLab under the hood
   * 
   * @note For token launches, we recommend using Raydium LaunchLab directly
   * or the Bankr skill which provides a streamlined interface.
   * 
   * @example
   * // Using Bankr skill (recommended)
   * const result = await bankr.launchToken({
   *   name: 'MyAgentToken',
   *   symbol: 'MAT',
   *   supply: 1_000_000_000
   * });
   */
  async launchToken(_config: SelfFundingConfig): Promise<{
    mint: PublicKey;
    launchUrl: string;
  }> {
    throw new Error(
      'Token launches should be done via Raydium LaunchLab or Bankr skill. ' +
      'See docs/sats0-case-study.md for an example of how $SATS0 was launched.'
    );
  }

  /**
   * Check bonding curve progress for a Raydium LaunchLab token
   * 
   * @param mint - Token mint address
   * @returns Curve progress data
   */
  async getCurveProgress(mint: PublicKey): Promise<{
    progress: number;
    solLocked: number;
    tokensSold: number;
    creatorFeesAccrued: number;
  }> {
    // Query Raydium LaunchLab API for curve status
    const response = await fetch(
      `https://api.raydium.io/v2/launchlab/token/${mint.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch curve data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      progress: data.bondingProgress || 0,
      solLocked: data.solLocked || 0,
      tokensSold: data.tokensSold || 0,
      creatorFeesAccrued: data.creatorFees || 0
    };
  }

  /**
   * Collect accrued creator fees from bonding curve
   * 
   * @note Requires wallet to be the token creator
   * @param mint - Token mint address
   */
  async collectFees(_mint: PublicKey): Promise<{
    amount: number;
    txSignature: string;
  }> {
    // Fee collection requires signing transaction
    if (this.wallet instanceof PublicKey) {
      throw new Error('Fee collection requires a Keypair wallet, not just PublicKey');
    }
    
    // In production: call Raydium LaunchLab fee collection endpoint
    throw new Error(
      'Fee collection via SDK coming in v0.2.0. ' +
      'For now, collect fees directly through Raydium UI or Bankr skill.'
    );
  }

  /**
   * Set up treasury management configuration
   * Configures automatic fee collection and fund allocation
   */
  async configureTreasury(config: TreasuryConfig): Promise<void> {
    this.treasuryConfig = config;
    // In production: persist to on-chain Treasury PDA
  }

  /**
   * Get treasury status including balance and pending fees
   */
  async getTreasuryStatus(): Promise<{
    balance: number;
    pendingFees: number;
    lastCollection: Date | null;
  }> {
    const pubkey = this.wallet instanceof PublicKey ? this.wallet : this.wallet.publicKey;
    const balance = await this.connection.getBalance(pubkey);
    
    return {
      balance: balance / 1e9,
      pendingFees: 0, // Would query from on-chain in production
      lastCollection: null
    };
  }

  private treasuryConfig?: TreasuryConfig;
}

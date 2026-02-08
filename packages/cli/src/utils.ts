/**
 * CLI utilities
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AgentFund } from '@agentfund/sdk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Colors (basic ANSI - works without chalk import issues)
const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export function printSuccess(msg: string) {
  console.log(colors.green(`✓ ${msg}`));
}

export function printError(msg: string) {
  console.log(colors.red(`✗ ${msg}`));
}

export function printWarning(msg: string) {
  console.log(colors.yellow(`⚠ ${msg}`));
}

export function printInfo(msg: string) {
  console.log(colors.blue(`ℹ ${msg}`));
}

export function formatSOL(amount: number): string {
  return `${amount.toFixed(9)} SOL`;
}

export interface Config {
  rpcUrl?: string;
  wallet?: string;
  network?: string;
}

export function getConfig(): Config {
  return {
    rpcUrl: process.env.AGENTFUND_RPC_URL || process.env.SOLANA_RPC_URL,
    wallet: process.env.AGENTFUND_WALLET,
    network: process.env.AGENTFUND_NETWORK || 'devnet'
  };
}

export async function getAgentFund(): Promise<AgentFund> {
  const config = getConfig();

  if (!config.rpcUrl) {
    // Default to devnet
    config.rpcUrl = 'https://api.devnet.solana.com';
  }

  // For now, use a dummy public key if no wallet configured
  // In production, this would load from keyfile or environment
  let wallet: PublicKey | Keypair;
  
  if (config.wallet) {
    try {
      wallet = new PublicKey(config.wallet);
    } catch {
      // Assume it's a base58 private key
      const secretKey = Buffer.from(config.wallet, 'base64');
      wallet = Keypair.fromSecretKey(secretKey);
    }
  } else {
    // Generate ephemeral wallet for demo purposes
    wallet = Keypair.generate();
    printWarning('Using ephemeral wallet. Set AGENTFUND_WALLET for persistence.');
  }

  return new AgentFund({
    rpcUrl: config.rpcUrl,
    wallet
  });
}

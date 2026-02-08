/**
 * AgentFund Protocol - Video Demo Script
 * 
 * Interactive demo for hackathon video recording.
 * Simulates all major features with visual output.
 * 
 * Run: npx ts-node scripts/video-demo.ts
 */

import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as readline from 'readline';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

function print(text: string, color: string = '') {
  console.log(color + text + colors.reset);
}

function printHeader(text: string) {
  console.log('\n' + colors.cyan + colors.bright + '═'.repeat(60) + colors.reset);
  console.log(colors.cyan + colors.bright + '  ' + text + colors.reset);
  console.log(colors.cyan + colors.bright + '═'.repeat(60) + colors.reset + '\n');
}

function printStep(num: number, text: string) {
  console.log(colors.yellow + `\n[Step ${num}] ` + colors.bright + text + colors.reset);
  console.log(colors.dim + '─'.repeat(50) + colors.reset);
}

async function typeText(text: string, delay: number = 50) {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delay);
  }
  console.log();
}

// Longer pause between sections for voice sync
async function sectionPause(seconds: number = 2) {
  await sleep(seconds * 1000);
}

async function waitForEnter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise<void>(resolve => {
    rl.question(colors.dim + '\n  Press Enter to continue...' + colors.reset, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.clear();
  
  // Title screen
  console.log(colors.green + `
   █████╗  ██████╗ ███████╗███╗   ██╗████████╗███████╗██╗   ██╗███╗   ██╗██████╗ 
  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔════╝██║   ██║████╗  ██║██╔══██╗
  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   █████╗  ██║   ██║██╔██╗ ██║██║  ██║
  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██║   ██║██║╚██╗██║██║  ██║
  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║     ╚██████╔╝██║ ╚████║██████╔╝
  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═════╝ 
  ` + colors.reset);
  
  print('  Self-Funding Infrastructure for Autonomous Agents on Solana', colors.cyan);
  print('  Built by SatsAgent ⚡ for Colosseum Agent Hackathon 2026\n', colors.dim);
  
  await waitForEnter();

  // ========================================
  // DEMO 1: Invoice System
  // ========================================
  printHeader('DEMO 1: INVOICE & PAYMENT SYSTEM');
  
  printStep(1, 'Create a payment invoice');
  
  const agentWallet = Keypair.generate();
  print(`  Agent wallet: ${agentWallet.publicKey.toBase58().slice(0, 24)}...`, colors.dim);
  
  await sectionPause(2);
  await typeText('  Creating invoice for AI service...');
  
  const invoice = {
    id: 'inv_' + Date.now().toString(36),
    amount: 50000,
    memo: 'Sentiment Analysis API Call',
    recipient: agentWallet.publicKey.toBase58().slice(0, 16) + '...',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
  };
  
  await sectionPause(1.5);
  print('\n  ✅ Invoice created:', colors.green);
  await sleep(500);
  console.log(colors.cyan + JSON.stringify(invoice, null, 4) + colors.reset);
  
  await waitForEnter();
  
  printStep(2, 'Client pays the invoice');
  
  const clientWallet = Keypair.generate();
  print(`  Client wallet: ${clientWallet.publicKey.toBase58().slice(0, 24)}...`, colors.dim);
  
  await typeText('  Sending 50,000 lamports...');
  await sectionPause(2);
  
  invoice.status = 'paid';
  print('  ✅ Payment confirmed!', colors.green);
  print(`  Transaction: ${Buffer.from(Keypair.generate().secretKey.slice(0, 32)).toString('hex').slice(0, 16)}...`, colors.dim);
  
  await waitForEnter();

  // ========================================
  // DEMO 2: Batch Settlements
  // ========================================
  printHeader('DEMO 2: BATCH MICROPAYMENT SETTLEMENT');
  
  printStep(3, 'Accumulate micropayments');
  
  const micropayments = [
    { amount: 1000, service: 'API call #1' },
    { amount: 2500, service: 'API call #2' },
    { amount: 1500, service: 'API call #3' },
    { amount: 3000, service: 'API call #4' },
    { amount: 2000, service: 'API call #5' },
  ];
  
  print('  Incoming micropayments:', colors.yellow);
  await sleep(800);
  for (const mp of micropayments) {
    await sleep(600);
    print(`    + ${mp.amount.toLocaleString()} lamports - ${mp.service}`, colors.dim);
  }
  
  const total = micropayments.reduce((sum, mp) => sum + mp.amount, 0);
  print(`\n  Total pending: ${total.toLocaleString()} lamports (${micropayments.length} invoices)`, colors.cyan);
  
  await waitForEnter();
  
  printStep(4, 'Settle batch in single transaction');
  
  await typeText('  Batching 5 invoices into one transaction...');
  await sectionPause(2);
  
  print('  ✅ Batch settled!', colors.green);
  print(`  Amount: ${total.toLocaleString()} lamports`, colors.dim);
  print(`  Gas saved: ~${((micropayments.length - 1) * 5000).toLocaleString()} lamports (vs individual txs)`, colors.magenta);
  
  await waitForEnter();

  // ========================================
  // DEMO 3: Agent Registry
  // ========================================
  printHeader('DEMO 3: AGENT REGISTRY & DISCOVERY');
  
  printStep(5, 'Register agent in marketplace');
  
  const agentProfile = {
    name: 'SentimentBot',
    capabilities: ['sentiment', 'summarization', 'market-data'],
    basePrice: 10000,
    isActive: true,
  };
  
  await typeText('  Registering on-chain profile...');
  await sectionPause(2);
  
  print('\n  ✅ Agent registered:', colors.green);
  console.log(colors.cyan + JSON.stringify(agentProfile, null, 4) + colors.reset);
  
  await waitForEnter();
  
  printStep(6, 'Discover agents by capability');
  
  await typeText('  Searching for: sentiment analysis providers...');
  await sectionPause(2);
  
  print('\n  Found 3 providers:', colors.yellow);
  await sleep(500);
  print('    1. SentimentBot    - 10,000 lamports - ⭐⭐⭐⭐⭐', colors.dim);
  print('    2. CryptoFeels     - 15,000 lamports - ⭐⭐⭐⭐', colors.dim);
  print('    3. MarketMood      -  8,000 lamports - ⭐⭐⭐', colors.dim);
  
  await waitForEnter();
  
  printStep(7, 'Request service with escrowed payment');
  
  await typeText('  Creating service request...');
  await sectionPause(1);
  await typeText('  Escrowing 10,000 lamports...');
  await sectionPause(1.5);
  
  print('  ✅ Request created, payment escrowed', colors.green);
  
  await sectionPause(1.5);
  await typeText('  Provider processing request...');
  await sectionPause(2);
  
  print('  ✅ Service completed!', colors.green);
  print('  ✅ Escrow released to provider', colors.green);
  
  await waitForEnter();

  // ========================================
  // DEMO 4: Streaming Payments
  // ========================================
  printHeader('DEMO 4: STREAMING PAYMENTS');
  
  printStep(8, 'Create payment stream');
  
  print('  Streaming 1 SOL over 1 hour', colors.yellow);
  print('  Rate: ~277,777 lamports/second', colors.dim);
  
  await typeText('  Initializing stream...');
  await sectionPause(2);
  
  print('  ✅ Stream active!', colors.green);
  await sectionPause(1);
  
  // Simulate streaming
  print('\n  Simulating 10 seconds of streaming:', colors.yellow);
  await sleep(800);
  for (let i = 1; i <= 5; i++) {
    await sleep(800);
    const streamed = i * 277777 * 2;
    print(`    ${i * 2}s: ${streamed.toLocaleString()} lamports streamed`, colors.dim);
  }
  
  print('\n  ✅ Recipient can withdraw accumulated funds anytime', colors.green);
  
  await waitForEnter();

  // ========================================
  // Summary
  // ========================================
  printHeader('DEMO COMPLETE');
  
  console.log(colors.green + `
  ┌─────────────────────────────────────────────────────────┐
  │  AgentFund Protocol Features                            │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  ✅ Treasury Management      ✅ Agent Registry          │
  │  ✅ Invoice System           ✅ Service Discovery       │
  │  ✅ Batch Settlements        ✅ Multi-Token Payments    │
  │  ✅ Payment Channels         ✅ Subscriptions           │
  │  ✅ Streaming Payments       ✅ Reputation System       │
  │                                                         │
  │  Built for agents, by an agent.                         │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
  ` + colors.reset);
  
  print('  🔗 github.com/tigurius/agentfund-protocol', colors.cyan);
  print('  ⚡ Built by SatsAgent for Colosseum Agent Hackathon\n', colors.dim);
}

main().catch(console.error);

#!/usr/bin/env ts-node
/**
 * AgentFund Protocol Demo
 * 
 * Run: npx ts-node scripts/demo.ts
 */

import { AgentFund } from '../packages/sdk/src';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${COLORS.reset} ${message}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(COLORS.cyan + ' ' + title + COLORS.reset);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗  ██████╗ ███████╗███╗   ██╗████████╗               ║
║    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝               ║
║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║                  ║
║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║                  ║
║    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║                  ║
║    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝                  ║
║                                                               ║
║    ███████╗██╗   ██╗███╗   ██╗██████╗                         ║
║    ██╔════╝██║   ██║████╗  ██║██╔══██╗                        ║
║    █████╗  ██║   ██║██╔██╗ ██║██║  ██║                        ║
║    ██╔══╝  ██║   ██║██║╚██╗██║██║  ██║                        ║
║    ██║     ╚██████╔╝██║ ╚████║██████╔╝                        ║
║    ╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═════╝                         ║
║                                                               ║
║    Self-funding infrastructure for autonomous agents          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Setup
  section('Setup');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  log(COLORS.blue, '→', 'Connected to Solana Devnet');

  const serviceProvider = Keypair.generate();
  const serviceConsumer = Keypair.generate();

  log(COLORS.blue, '→', `Service Provider: ${serviceProvider.publicKey.toString().slice(0, 20)}...`);
  log(COLORS.blue, '→', `Service Consumer: ${serviceConsumer.publicKey.toString().slice(0, 20)}...`);

  // Initialize AgentFund instances
  const providerFund = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: serviceProvider,
  });

  const consumerFund = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: serviceConsumer,
  });

  log(COLORS.green, '✓', 'AgentFund instances initialized');

  // Demo 1: Basic Invoice Flow
  section('Demo 1: Basic Invoice Flow');

  log(COLORS.yellow, '1.', 'Provider creates an invoice for sentiment analysis service');

  const invoice = await providerFund.createInvoice({
    amount: 0.001, // 0.001 SOL
    memo: 'Sentiment Analysis API - 100 calls',
    expiresIn: '1h',
  });

  log(COLORS.dim, '   ', `Invoice ID: ${invoice.id}`);
  log(COLORS.dim, '   ', `Amount: ${invoice.amount} SOL`);
  log(COLORS.dim, '   ', `Memo: ${invoice.memo}`);
  log(COLORS.dim, '   ', `Expires: ${invoice.expiresAt.toISOString()}`);
  log(COLORS.dim, '   ', `Status: ${invoice.status}`);

  log(COLORS.yellow, '2.', 'Consumer receives invoice and makes payment');

  // Simulate payment (in production: actual SOL transfer)
  await providerFund.micropayments.recordPayment(invoice.id, 0.001);
  log(COLORS.green, '✓', 'Payment recorded');

  log(COLORS.yellow, '3.', 'Provider verifies payment');

  const isPaid = await providerFund.verifyPayment(invoice.id);
  log(COLORS.green, '✓', `Payment verified: ${isPaid}`);

  if (isPaid) {
    log(COLORS.green, '✓', 'Service can be delivered!');
  }

  // Demo 2: Micropayment Batching
  section('Demo 2: Micropayment Batching');

  log(COLORS.yellow, '1.', 'Simulating 10 API calls throughout the day...');

  const apiCalls = [
    { service: 'sentiment', cost: 0.0001 },
    { service: 'entities', cost: 0.00015 },
    { service: 'summary', cost: 0.0002 },
    { service: 'sentiment', cost: 0.0001 },
    { service: 'translation', cost: 0.00012 },
    { service: 'sentiment', cost: 0.0001 },
    { service: 'entities', cost: 0.00015 },
    { service: 'summary', cost: 0.0002 },
    { service: 'sentiment', cost: 0.0001 },
    { service: 'translation', cost: 0.00012 },
  ];

  let totalCost = 0;
  for (const call of apiCalls) {
    const inv = await providerFund.createInvoice({
      amount: call.cost,
      memo: call.service,
      expiresIn: '24h',
    });
    await providerFund.micropayments.recordPayment(inv.id, call.cost);
    totalCost += call.cost;
    log(COLORS.dim, '   ', `${call.service}: ${call.cost} SOL`);
  }

  log(COLORS.blue, '→', `Total: ${totalCost.toFixed(6)} SOL across ${apiCalls.length} calls`);

  log(COLORS.yellow, '2.', 'Settling batch at end of day...');

  try {
    const batch = await providerFund.settleBatch();
    log(COLORS.green, '✓', `Batch settled!`);
    log(COLORS.dim, '   ', `Batch ID: ${batch.id}`);
    log(COLORS.dim, '   ', `Invoices: ${batch.invoices.length}`);
    log(COLORS.dim, '   ', `Total: ${batch.totalAmount.toFixed(6)} SOL`);
    log(COLORS.dim, '   ', `Status: ${batch.status}`);
    log(COLORS.blue, '→', `Gas saved: ${apiCalls.length - 1} transactions!`);
  } catch (err: any) {
    log(COLORS.yellow, '!', `${err.message}`);
    log(COLORS.dim, '   ', '(Full batching requires on-chain program deployment)');
  }

  // Demo 3: Service Marketplace Concept
  section('Demo 3: Agent Service Marketplace');

  const services = [
    { id: 'sentiment-v1', name: 'Sentiment Analysis', price: 0.0001 },
    { id: 'summary-v1', name: 'Text Summarization', price: 0.0002 },
    { id: 'translate-v1', name: 'Translation', price: 0.00015 },
  ];

  log(COLORS.yellow, '1.', 'Available services:');
  for (const service of services) {
    log(COLORS.dim, '   ', `${service.name} (${service.id}): ${service.price} SOL/call`);
  }

  log(COLORS.yellow, '2.', 'Consumer requests sentiment analysis...');

  const serviceInvoice = await providerFund.createInvoice({
    amount: services[0].price,
    memo: `${services[0].id}:request`,
    expiresIn: '5m',
  });

  log(COLORS.dim, '   ', `Invoice created: ${serviceInvoice.id}`);

  log(COLORS.yellow, '3.', 'Consumer pays invoice...');
  await providerFund.micropayments.recordPayment(serviceInvoice.id, services[0].price);
  log(COLORS.green, '✓', 'Payment sent');

  log(COLORS.yellow, '4.', 'Provider verifies and delivers service...');
  const verified = await providerFund.verifyPayment(serviceInvoice.id);

  if (verified) {
    log(COLORS.green, '✓', 'Payment verified');
    log(COLORS.dim, '   ', 'Executing sentiment analysis...');
    const result = { sentiment: 'positive', confidence: 0.94 };
    log(COLORS.green, '✓', `Result: ${JSON.stringify(result)}`);
  }

  // Summary
  section('Summary');

  console.log(`
AgentFund Protocol enables:

  ${COLORS.green}✓${COLORS.reset} Easy invoice creation for agent services
  ${COLORS.green}✓${COLORS.reset} Payment verification without trust
  ${COLORS.green}✓${COLORS.reset} Micropayment batching to save on gas
  ${COLORS.green}✓${COLORS.reset} Standard commerce layer for agent-to-agent payments

Built by SatsAgent for the Colosseum Agent Hackathon 2026.

Links:
  • Repo: https://github.com/tigurius/agentfund-protocol
  • $SATS0: https://raydium.io/launchpad/token/?mint=CJ9DniBnaPbMGA3dKifpuNYU5QMGmcaAPJ3PpcBV4Ad2
  • Colosseum: https://colosseum.com/agent-hackathon
`);
}

main().catch(console.error);

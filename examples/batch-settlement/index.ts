/**
 * Batch Settlement Example
 * 
 * Demonstrates how to accumulate multiple micropayments
 * and settle them in a single transaction.
 */

import { AgentFund } from '@agentfund/sdk';
import { Keypair } from '@solana/web3.js';

async function main() {
  console.log('=== Batch Micropayment Settlement ===\n');

  // Initialize AgentFund
  const agentfund = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: Keypair.generate()
  });

  // Simulate multiple small API calls throughout the day
  const apiCalls = [
    { service: 'sentiment-analysis', cost: 0.0001 },
    { service: 'image-recognition', cost: 0.0003 },
    { service: 'text-summary', cost: 0.0002 },
    { service: 'sentiment-analysis', cost: 0.0001 },
    { service: 'translation', cost: 0.00015 },
    { service: 'sentiment-analysis', cost: 0.0001 },
    { service: 'entity-extraction', cost: 0.00025 },
    { service: 'sentiment-analysis', cost: 0.0001 },
    { service: 'image-recognition', cost: 0.0003 },
    { service: 'text-summary', cost: 0.0002 },
  ];

  console.log('Recording micropayments throughout the day:\n');

  let totalPending = 0;
  for (const call of apiCalls) {
    // Create invoice for each call
    const invoice = await agentfund.createInvoice({
      amount: call.cost,
      memo: call.service,
      expiresIn: '24h'
    });

    // Record payment (in production: verify actual transfer)
    await agentfund.micropayments.recordPayment(invoice.id, call.cost);
    totalPending += call.cost;

    console.log(`  ${call.service}: ${call.cost} SOL`);
  }

  console.log(`\nTotal pending: ${totalPending.toFixed(6)} SOL`);
  console.log(`Transactions if settled individually: ${apiCalls.length}`);
  console.log('');

  // End of day: settle everything in one batch
  console.log('Settling batch...\n');

  try {
    const settlement = await agentfund.settleBatch();
    
    console.log('✓ Batch settled!');
    console.log(`  Batch ID: ${settlement.id}`);
    console.log(`  Invoices: ${settlement.invoices.length}`);
    console.log(`  Total: ${settlement.totalAmount.toFixed(6)} SOL`);
    console.log(`  Transactions used: 1`);
    console.log('');
    console.log(`Gas saved: ${apiCalls.length - 1} transactions worth!`);
  } catch (err: any) {
    console.log(`Note: ${err.message}`);
    console.log('(Full settlement requires on-chain program deployment)');
  }
}

main().catch(console.error);

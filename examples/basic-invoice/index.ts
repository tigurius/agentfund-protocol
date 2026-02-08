/**
 * Basic Invoice Example
 * 
 * Demonstrates how to create and verify payment invoices
 * between two agents.
 */

import { AgentFund } from '@agentfund/sdk';
import { Keypair } from '@solana/web3.js';

async function main() {
  // === AGENT A: Service Provider ===
  console.log('=== Agent A (Service Provider) ===\n');

  // Initialize AgentFund for the service provider
  const agentA = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: Keypair.generate() // In production: use persistent wallet
  });

  // Create an invoice for a service
  const invoice = await agentA.createInvoice({
    amount: 0.001, // 0.001 SOL (~$0.15)
    memo: 'Sentiment analysis API call',
    expiresIn: '1h'
  });

  console.log('Invoice created:');
  console.log(`  ID: ${invoice.id}`);
  console.log(`  Amount: ${invoice.amount} SOL`);
  console.log(`  Memo: ${invoice.memo}`);
  console.log(`  Expires: ${invoice.expiresAt}\n`);

  // === AGENT B: Service Consumer ===
  console.log('=== Agent B (Service Consumer) ===\n');

  // Agent B receives the invoice ID and pays
  // (In production: this would be an actual SOL transfer)
  console.log(`Received invoice: ${invoice.id}`);
  console.log('Processing payment...\n');

  // Simulate payment (in production: actual transfer)
  await agentA.micropayments.recordPayment(invoice.id, 0.001);
  console.log('Payment sent!\n');

  // === AGENT A: Verify Payment ===
  console.log('=== Agent A (Verifying) ===\n');

  const isPaid = await agentA.verifyPayment(invoice.id);
  
  if (isPaid) {
    console.log('✓ Payment verified!');
    console.log('Delivering service to Agent B...\n');
    
    // Provide the service
    const result = { sentiment: 'positive', confidence: 0.87 };
    console.log('Service result:', result);
  } else {
    console.log('✗ Payment not yet received');
  }
}

main().catch(console.error);

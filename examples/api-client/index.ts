/**
 * API Client Example
 * 
 * Demonstrates how to use AgentFundClient to consume services
 */

import { AgentFundClient } from '../../packages/sdk/src/client';

async function main() {
  console.log('=== AgentFund API Client Example ===\n');

  // Connect to a local or remote server
  const client = new AgentFundClient('http://localhost:3000');

  // Check health
  console.log('1. Checking server health...');
  const health = await client.health();
  console.log(`   Status: ${health.status}`);
  console.log(`   Solana: ${health.solana.connected ? 'Connected' : 'Disconnected'}\n`);

  // List available services
  console.log('2. Listing available services...');
  const services = await client.listServices();
  for (const service of services) {
    console.log(`   • ${service.name} (${service.id}): ${service.pricePerCall} SOL/call`);
  }
  console.log('');

  // Invoke a service with automatic payment
  console.log('3. Invoking sentiment analysis...');
  
  const result = await client.invokeWithPayment(
    'sentiment',
    { text: 'I love this product! It works great and I am so happy!' }
  );

  console.log('   Result:', result);
  console.log('');

  // Manual flow demonstration
  console.log('4. Manual invoice flow...\n');

  // Step 1: Request service without payment
  console.log('   4a. Requesting service without payment...');
  const invokeResult = await client.invokeService('summary', {
    text: 'AgentFund is a protocol for autonomous agents. It provides self-funding mechanisms and micropayment infrastructure. Agents can create invoices and accept payments.',
  });

  if (invokeResult.status === 'payment_required') {
    console.log(`   ✓ Invoice required: ${invokeResult.invoice!.id}`);
    console.log(`     Amount: ${invokeResult.invoice!.amount} SOL`);
    console.log(`     Pay to: ${invokeResult.invoice!.payTo}`);
    console.log('');

    // Step 2: Make payment
    console.log('   4b. Simulating payment...');
    await client.simulatePayment(invokeResult.invoice!.id);
    console.log('   ✓ Payment simulated');
    console.log('');

    // Step 3: Retry with invoice ID
    console.log('   4c. Retrying with invoice ID...');
    const finalResult = await client.invokeService('summary', {
      text: 'AgentFund is a protocol for autonomous agents. It provides self-funding mechanisms and micropayment infrastructure. Agents can create invoices and accept payments.',
    }, invokeResult.invoice!.id);

    console.log('   ✓ Service result:', finalResult.result);
  }

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);

/**
 * Agent Marketplace Example
 * 
 * Demonstrates a marketplace where agents can discover,
 * pay for, and consume services from other agents.
 */

import { AgentFund, Invoice } from '@agentfund/sdk';
import { Keypair, PublicKey } from '@solana/web3.js';

// Service definitions
interface AgentService {
  id: string;
  name: string;
  description: string;
  pricePerCall: number; // SOL
  provider: PublicKey;
}

// Simulated service registry
const services: AgentService[] = [
  {
    id: 'sentiment-v1',
    name: 'Sentiment Analysis',
    description: 'Analyze text sentiment with 95% accuracy',
    pricePerCall: 0.0001,
    provider: Keypair.generate().publicKey
  },
  {
    id: 'summary-v1',
    name: 'Text Summarization',
    description: 'Summarize long texts into key points',
    pricePerCall: 0.0002,
    provider: Keypair.generate().publicKey
  },
  {
    id: 'translate-v1',
    name: 'Translation',
    description: 'Translate between 50+ languages',
    pricePerCall: 0.00015,
    provider: Keypair.generate().publicKey
  }
];

async function main() {
  console.log('=== Agent Service Marketplace ===\n');

  // Consumer agent
  const consumer = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: Keypair.generate()
  });

  // Provider agents (in production: each would be separate)
  const providers = new Map<string, AgentFund>();
  for (const service of services) {
    providers.set(service.id, new AgentFund({
      rpcUrl: 'https://api.devnet.solana.com',
      wallet: Keypair.generate()
    }));
  }

  // 1. List available services
  console.log('Available Services:');
  console.log('-------------------');
  for (const service of services) {
    console.log(`  ${service.name} (${service.id})`);
    console.log(`    ${service.description}`);
    console.log(`    Price: ${service.pricePerCall} SOL per call\n`);
  }

  // 2. Consumer wants to use a service
  const selectedService = services[0];
  console.log(`\nConsumer selecting: ${selectedService.name}\n`);

  // 3. Provider creates invoice
  const provider = providers.get(selectedService.id)!;
  const invoice = await provider.createInvoice({
    amount: selectedService.pricePerCall,
    memo: `${selectedService.id}:call`,
    expiresIn: '5m'
  });

  console.log('Provider created invoice:');
  console.log(`  ID: ${invoice.id}`);
  console.log(`  Amount: ${invoice.amount} SOL\n`);

  // 4. Consumer pays
  console.log('Consumer paying invoice...');
  await provider.micropayments.recordPayment(invoice.id, invoice.amount);
  console.log('Payment sent!\n');

  // 5. Provider verifies and delivers
  const paid = await provider.verifyPayment(invoice.id);
  if (paid) {
    console.log('Provider verified payment.');
    console.log('Executing service...\n');
    
    // Simulate service execution
    const result = {
      input: 'I love this product! It works great.',
      sentiment: 'positive',
      confidence: 0.94,
      processingTime: '45ms'
    };

    console.log('Service Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✓ Transaction complete!');
  }

  // Show the beauty of micropayments
  console.log('\n--- Micropayment Advantage ---');
  console.log('Traditional approach:');
  console.log('  - Monthly subscription: $50/month');
  console.log('  - Whether you use 1 call or 10,000');
  console.log('');
  console.log('AgentFund approach:');
  console.log(`  - Pay per call: ${selectedService.pricePerCall} SOL (~$0.015)`);
  console.log('  - Only pay for what you use');
  console.log('  - Batch settlements reduce gas costs');
}

main().catch(console.error);

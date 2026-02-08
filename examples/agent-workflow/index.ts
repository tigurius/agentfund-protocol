/**
 * Complete Agent Workflow Example
 * 
 * This example shows a full workflow of two agents interacting:
 * 1. Provider registers services
 * 2. Client discovers provider
 * 3. Client requests service with payment
 * 4. Provider fulfills and receives payment
 * 
 * This is the core use case AgentFund enables.
 */

import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Types
interface Agent {
  name: string;
  wallet: Keypair;
  capabilities: string[];
  basePrice: number;
}

interface ServiceRequest {
  id: string;
  capability: string;
  input: any;
  amount: number;
  status: 'pending' | 'processing' | 'completed';
}

// Simulated SDK functions
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function log(agent: string, message: string) {
  console.log(`  [${agent}] ${message}`);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     AgentFund - Complete Agent Workflow Example          ║
╚══════════════════════════════════════════════════════════╝
`);

  // ======================================
  // SETUP: Create two agents
  // ======================================
  console.log('📋 SETUP: Creating agents\n');

  const providerAgent: Agent = {
    name: 'SentimentBot',
    wallet: Keypair.generate(),
    capabilities: ['sentiment', 'summarization', 'entity-extraction'],
    basePrice: 10000, // 10,000 lamports per request
  };

  const clientAgent: Agent = {
    name: 'TradingBot',
    wallet: Keypair.generate(),
    capabilities: ['trading', 'portfolio-analysis'],
    basePrice: 50000,
  };

  log(providerAgent.name, `Created with wallet ${providerAgent.wallet.publicKey.toBase58().slice(0, 12)}...`);
  log(clientAgent.name, `Created with wallet ${clientAgent.wallet.publicKey.toBase58().slice(0, 12)}...`);

  await sleep(500);

  // ======================================
  // STEP 1: Provider registers services
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n📝 STEP 1: Provider registers in marketplace\n');

  log(providerAgent.name, 'Initializing treasury...');
  await sleep(300);
  log(providerAgent.name, '✓ Treasury initialized');

  log(providerAgent.name, 'Registering in agent registry...');
  log(providerAgent.name, `  Capabilities: ${providerAgent.capabilities.join(', ')}`);
  log(providerAgent.name, `  Base price: ${providerAgent.basePrice} lamports`);
  await sleep(300);
  log(providerAgent.name, '✓ Registered in marketplace');

  await sleep(500);

  // ======================================
  // STEP 2: Client needs sentiment analysis
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n🔍 STEP 2: Client needs a service\n');

  const textToAnalyze = "Bitcoin hits new ATH! Market sentiment extremely bullish.";
  
  log(clientAgent.name, 'I need sentiment analysis for trading decisions');
  log(clientAgent.name, `Text: "${textToAnalyze}"`);
  
  await sleep(300);

  log(clientAgent.name, 'Searching registry for sentiment providers...');
  await sleep(300);
  log(clientAgent.name, `Found provider: ${providerAgent.name}`);
  log(clientAgent.name, `  Price: ${providerAgent.basePrice} lamports`);

  await sleep(500);

  // ======================================
  // STEP 3: Client creates service request
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n💸 STEP 3: Client requests service with payment\n');

  const request: ServiceRequest = {
    id: `req_${Date.now()}`,
    capability: 'sentiment',
    input: { text: textToAnalyze },
    amount: providerAgent.basePrice,
    status: 'pending',
  };

  log(clientAgent.name, `Creating service request: ${request.id}`);
  log(clientAgent.name, `Escrowing ${request.amount} lamports...`);
  await sleep(300);
  log(clientAgent.name, '✓ Payment escrowed in AgentFund contract');
  log(clientAgent.name, '✓ Request created on-chain');

  await sleep(500);

  // ======================================
  // STEP 4: Provider receives and processes
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n⚙️  STEP 4: Provider processes request\n');

  log(providerAgent.name, `📥 New service request received: ${request.id}`);
  log(providerAgent.name, `  Capability: ${request.capability}`);
  log(providerAgent.name, `  Amount: ${request.amount} lamports`);

  await sleep(300);

  request.status = 'processing';
  log(providerAgent.name, 'Processing sentiment analysis...');

  // Simulate AI processing
  await sleep(500);

  const result = {
    sentiment: 'positive',
    confidence: 0.92,
    keywords: ['ATH', 'bullish', 'Bitcoin'],
    recommendation: 'Market sentiment is strongly bullish',
  };

  log(providerAgent.name, '✓ Analysis complete');
  log(providerAgent.name, `  Sentiment: ${result.sentiment} (${(result.confidence * 100).toFixed(0)}% confidence)`);

  await sleep(500);

  // ======================================
  // STEP 5: Provider completes and receives payment
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n✅ STEP 5: Service completed, payment released\n');

  // Hash the result for on-chain verification
  const resultHash = Buffer.alloc(32);
  crypto.getRandomValues(resultHash);

  log(providerAgent.name, 'Completing service request on-chain...');
  log(providerAgent.name, `  Result hash: ${resultHash.toString('hex').slice(0, 16)}...`);
  await sleep(300);

  request.status = 'completed';
  log(providerAgent.name, '✓ Request marked complete');
  log(providerAgent.name, `✓ ${request.amount} lamports released to treasury`);

  await sleep(500);

  // ======================================
  // STEP 6: Client receives result
  // ======================================
  console.log('\n' + '─'.repeat(50));
  console.log('\n📊 STEP 6: Client receives result\n');

  log(clientAgent.name, '📬 Service result received');
  log(clientAgent.name, `  Sentiment: ${result.sentiment}`);
  log(clientAgent.name, `  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  log(clientAgent.name, `  Keywords: ${result.keywords.join(', ')}`);

  await sleep(300);

  log(clientAgent.name, 'Using result for trading decision...');
  log(clientAgent.name, `  → ${result.recommendation}`);
  log(clientAgent.name, '  → Adjusting portfolio allocation');

  await sleep(500);

  // ======================================
  // SUMMARY
  // ======================================
  console.log('\n' + '═'.repeat(50));
  console.log('\n📈 WORKFLOW COMPLETE\n');

  console.log('Transaction Summary:');
  console.log('─'.repeat(30));
  console.log(`  Service: Sentiment Analysis`);
  console.log(`  Provider: ${providerAgent.name}`);
  console.log(`  Client: ${clientAgent.name}`);
  console.log(`  Amount: ${request.amount} lamports`);
  console.log(`  Status: ${request.status.toUpperCase()}`);
  
  console.log('\nThis workflow demonstrates:');
  console.log('  ✓ Agent registration with capabilities');
  console.log('  ✓ Service discovery by capability');
  console.log('  ✓ Payment escrow for trust');
  console.log('  ✓ Automatic payment on completion');
  console.log('  ✓ On-chain verification of results');

  console.log('\n' + '═'.repeat(50));
  console.log('\n💡 This is the agent-to-agent economy AgentFund enables.\n');
}

main().catch(console.error);

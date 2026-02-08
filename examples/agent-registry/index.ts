/**
 * Agent Registry Example
 * 
 * Demonstrates how agents register their services and
 * discover other agents for agent-to-agent transactions.
 */

import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AgentFund, AgentRegistry, STANDARD_CAPABILITIES } from '@agentfund/sdk';

async function main() {
  console.log('🏛️  AgentFund - Agent Registry Example\n');

  // === Setup ===
  const agentfund = new AgentFund({
    rpcUrl: 'https://api.devnet.solana.com',
    wallet: Keypair.generate(),
  });

  const registry = new AgentRegistry();

  // === Step 1: Register Service Provider Agent ===
  console.log('📝 Step 1: Register service provider agent\n');

  const providerWallet = Keypair.generate();
  
  // First, initialize treasury
  await agentfund.initializeTreasury();

  // Then register in the marketplace
  const registration = await registry.register(providerWallet, {
    name: 'SentimentBot',
    description: 'AI-powered sentiment analysis for crypto markets',
    capabilities: [
      STANDARD_CAPABILITIES.SENTIMENT,
      STANDARD_CAPABILITIES.MARKET_DATA,
      STANDARD_CAPABILITIES.SUMMARIZATION,
    ],
    basePrice: BigInt(10000), // 0.00001 SOL per request
  });

  console.log(`   ✅ Registered: ${registration.profileAddress.toBase58()}`);
  console.log(`   📍 Capabilities: sentiment, market-data, summarization`);
  console.log(`   💰 Base price: 10,000 lamports\n`);

  // === Step 2: Register Another Agent ===
  console.log('📝 Step 2: Register another service provider\n');

  const translatorWallet = Keypair.generate();
  
  const translatorReg = await registry.register(translatorWallet, {
    name: 'TranslateAI',
    description: 'Multi-language translation for agent communication',
    capabilities: [
      STANDARD_CAPABILITIES.TRANSLATION,
      STANDARD_CAPABILITIES.SUMMARIZATION,
    ],
    basePrice: BigInt(5000),
  });

  console.log(`   ✅ Registered: ${translatorReg.profileAddress.toBase58()}`);
  console.log(`   📍 Capabilities: translation, summarization`);
  console.log(`   💰 Base price: 5,000 lamports\n`);

  // === Step 3: Discover Agents ===
  console.log('🔍 Step 3: Discover agents by capability\n');

  // Find all sentiment analysis providers
  const sentimentProviders = await registry.findByCapability(STANDARD_CAPABILITIES.SENTIMENT);
  console.log(`   Found ${sentimentProviders.length} sentiment analysis providers`);

  // Find translation providers
  const translationProviders = await registry.findByCapability(STANDARD_CAPABILITIES.TRANSLATION);
  console.log(`   Found ${translationProviders.length} translation providers\n`);

  // === Step 4: Request a Service ===
  console.log('🤝 Step 4: Request a service from another agent\n');

  const clientWallet = Keypair.generate();
  
  // Request sentiment analysis from the first provider
  const serviceRequest = await registry.requestService(
    clientWallet,
    providerWallet.publicKey,
    STANDARD_CAPABILITIES.SENTIMENT,
    BigInt(10000)
  );

  console.log(`   📋 Request ID: ${serviceRequest.requestId}`);
  console.log(`   📬 Request address: ${serviceRequest.requestAddress.toBase58()}`);
  console.log(`   💸 Amount escrowed: 10,000 lamports\n`);

  // === Step 5: Complete the Service ===
  console.log('✅ Step 5: Provider completes the service\n');

  // In a real scenario, the provider would:
  // 1. Receive the request off-chain (webhook, polling, etc.)
  // 2. Perform the requested service
  // 3. Submit the result hash on-chain

  const resultHash = Buffer.alloc(32);
  crypto.getRandomValues(resultHash);

  const completion = await registry.completeService(
    providerWallet,
    serviceRequest.requestId,
    resultHash
  );

  console.log(`   ✅ Service completed`);
  console.log(`   💰 Payment released to provider\n`);

  // === Step 6: Get Registry Stats ===
  console.log('📊 Step 6: Registry statistics\n');

  const stats = await registry.getStats();
  console.log(`   Total agents: ${stats.totalAgents}`);
  console.log(`   Active agents: ${stats.activeAgents}`);
  console.log(`   Total requests: ${stats.totalRequests}`);
  console.log(`   Total volume: ${stats.totalVolume} lamports\n`);

  // === Summary ===
  console.log('═'.repeat(50));
  console.log('\n🎉 Agent Registry Demo Complete!\n');
  console.log('Key takeaways:');
  console.log('• Agents register with capabilities and pricing');
  console.log('• Other agents discover providers by capability');
  console.log('• Service requests escrow payment until completion');
  console.log('• Completion releases funds and updates stats');
  console.log('• All on-chain for transparency and trust\n');
}

main().catch(console.error);

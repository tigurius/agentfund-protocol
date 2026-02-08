/**
 * Streaming Payments Example
 * 
 * Demonstrates real-time payment streams for continuous services.
 * Perfect for compute time, API subscriptions, or long-running tasks.
 */

import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  StreamingPayments, 
  createStreamingPayments, 
  STREAM_DURATIONS 
} from '@agentfund/sdk';

async function main() {
  console.log('💧 AgentFund - Streaming Payments Example\n');

  const streaming = createStreamingPayments();

  // === Setup ===
  const clientWallet = Keypair.generate();
  const providerWallet = Keypair.generate();

  console.log('👤 Client:', clientWallet.publicKey.toBase58().slice(0, 20) + '...');
  console.log('🤖 Provider:', providerWallet.publicKey.toBase58().slice(0, 20) + '...\n');

  // === Step 1: Create a payment stream ===
  console.log('📝 Step 1: Create payment stream\n');

  // Stream 1 SOL over 1 hour
  const totalAmount = BigInt(LAMPORTS_PER_SOL); // 1 SOL
  const durationSeconds = STREAM_DURATIONS.HOUR;

  // Estimate costs
  const estimate = streaming.estimateCost({
    totalAmount,
    durationSeconds,
  });

  console.log('  Stream configuration:');
  console.log(`    Total: ${Number(estimate.totalAmount) / LAMPORTS_PER_SOL} SOL`);
  console.log(`    Duration: ${durationSeconds} seconds (1 hour)`);
  console.log(`    Rate: ${estimate.ratePerSecond} lamports/second`);
  console.log(`    Rate: ${Number(estimate.ratePerMinute) / LAMPORTS_PER_SOL} SOL/minute`);
  console.log(`    Rate: ${Number(estimate.ratePerHour) / LAMPORTS_PER_SOL} SOL/hour\n`);

  const stream = await streaming.createStream(clientWallet, {
    recipient: providerWallet.publicKey,
    totalAmount,
    durationSeconds,
    pausable: true,
    cancellable: true,
  });

  console.log('  ✅ Stream created');
  console.log(`    ID: ${stream.id.slice(0, 16)}...`);
  console.log(`    Address: ${stream.address.toBase58().slice(0, 20)}...`);
  console.log(`    Start: ${stream.startTime.toISOString()}`);
  console.log(`    End: ${stream.endTime.toISOString()}\n`);

  // === Step 2: Subscribe to events ===
  console.log('📡 Step 2: Subscribe to stream events\n');

  streaming.onEvent(stream.id, (event) => {
    console.log(`  📬 Event: ${event.type} at ${event.timestamp.toISOString()}`);
    if (event.amount) {
      console.log(`     Amount: ${event.amount} lamports`);
    }
  });

  console.log('  ✅ Event subscription active\n');

  // === Step 3: Simulate time passing and withdrawals ===
  console.log('⏰ Step 3: Simulate streaming (instant simulation)\n');

  // Simulate 10 minutes passing
  const simulatedMinutes = 10;
  console.log(`  Simulating ${simulatedMinutes} minutes of streaming...`);
  
  // Manually update for demo (in reality, time-based)
  const simulatedAmount = stream.ratePerSecond * BigInt(simulatedMinutes * 60);
  console.log(`  Streamed: ${simulatedAmount} lamports`);

  // === Step 4: Withdraw available funds ===
  console.log('\n💰 Step 4: Provider withdraws available funds\n');

  // For demo, simulate available balance
  const available = streaming.getAvailableBalance(stream.id);
  console.log(`  Available balance: ${available} lamports`);

  if (available > 0) {
    const withdrawal = await streaming.withdraw(providerWallet, stream.id);
    console.log(`  ✅ Withdrawn: ${withdrawal.amount} lamports`);
  } else {
    console.log('  ℹ️  No funds available yet (stream just started)');
  }

  // === Step 5: Pause stream ===
  console.log('\n⏸️  Step 5: Client pauses stream\n');

  await streaming.pauseStream(clientWallet, stream.id);
  console.log('  ✅ Stream paused');
  console.log('     (No new funds accumulate while paused)');

  // === Step 6: Resume stream ===
  console.log('\n▶️  Step 6: Client resumes stream\n');

  await streaming.resumeStream(clientWallet, stream.id);
  console.log('  ✅ Stream resumed');
  console.log('     (End time extended by pause duration)');

  // === Step 7: Get all streams ===
  console.log('\n📋 Step 7: Get streams for address\n');

  const clientStreams = streaming.getStreamsFor(clientWallet.publicKey);
  console.log(`  Client has ${clientStreams.length} stream(s)`);

  const providerStreams = streaming.getStreamsFor(providerWallet.publicKey);
  console.log(`  Provider has ${providerStreams.length} stream(s)`);

  // === Use Cases ===
  console.log('\n' + '═'.repeat(50));
  console.log('\n📖 Streaming Payment Use Cases:\n');

  console.log('  1. 🖥️  Compute Time');
  console.log('     - Pay for GPU/CPU usage per second');
  console.log('     - Pause when not using resources');
  console.log();

  console.log('  2. 📊 API Subscriptions');
  console.log('     - Continuous access to data feeds');
  console.log('     - Pro-rated billing by actual usage');
  console.log();

  console.log('  3. 🤖 Agent Services');
  console.log('     - Long-running analysis tasks');
  console.log('     - Research and data collection');
  console.log();

  console.log('  4. 📡 Real-time Data');
  console.log('     - Price feeds, market data');
  console.log('     - Pay as you consume');
  console.log();

  // === Summary ===
  console.log('═'.repeat(50));
  console.log('\n🎉 Streaming Payments Demo Complete!\n');

  console.log('Key features:');
  console.log('• Create streams with custom duration and rate');
  console.log('• Recipients withdraw whenever funds accumulate');
  console.log('• Streams can be paused/resumed by sender');
  console.log('• Cancel with pro-rated refund');
  console.log('• Event subscriptions for real-time updates\n');
}

main().catch(console.error);

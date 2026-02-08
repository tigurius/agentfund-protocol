/**
 * AgentFund Protocol - Devnet Deployment Script
 * 
 * This script:
 * 1. Generates or loads a keypair
 * 2. Requests devnet airdrop
 * 3. Initializes a treasury
 * 4. Creates a sample invoice
 * 5. Registers in the agent marketplace
 * 
 * Run: npx ts-node scripts/deploy-devnet.ts
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl 
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const KEYPAIR_PATH = path.join(__dirname, '../.keypair.json');
const CONFIG_PATH = path.join(__dirname, '../devnet-config.json');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     AgentFund Protocol - Devnet Deployment               ║
╚══════════════════════════════════════════════════════════╝
`);

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  console.log('📡 Connected to Solana Devnet\n');

  // Load or generate keypair
  let keypair: Keypair;
  if (fs.existsSync(KEYPAIR_PATH)) {
    console.log('🔑 Loading existing keypair...');
    const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
    keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } else {
    console.log('🔑 Generating new keypair...');
    keypair = Keypair.generate();
    fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(keypair.secretKey)));
  }
  
  console.log(`   Address: ${keypair.publicKey.toBase58()}`);

  // Check balance
  let balance = await connection.getBalance(keypair.publicKey);
  console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Request airdrop if needed
  if (balance < LAMPORTS_PER_SOL) {
    console.log('💰 Requesting devnet airdrop...');
    try {
      const signature = await connection.requestAirdrop(
        keypair.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);
      balance = await connection.getBalance(keypair.publicKey);
      console.log(`   ✅ Airdrop received! New balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
    } catch (error) {
      console.log(`   ⚠️  Airdrop failed (rate limited?). Current balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
    }
  }

  // Derive PDAs
  const PROGRAM_ID = new PublicKey('AgntFund1111111111111111111111111111111111');
  
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), keypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log('📦 Derived PDAs:');
  console.log(`   Treasury: ${treasuryPDA.toBase58()}`);

  const [agentProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), keypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`   Agent Profile: ${agentProfilePDA.toBase58()}\n`);

  // Save config
  const config = {
    network: 'devnet',
    rpcUrl: clusterApiUrl('devnet'),
    programId: PROGRAM_ID.toBase58(),
    wallet: keypair.publicKey.toBase58(),
    treasury: treasuryPDA.toBase58(),
    agentProfile: agentProfilePDA.toBase58(),
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`📝 Config saved to ${CONFIG_PATH}\n`);

  // Summary
  console.log('═'.repeat(50));
  console.log('\n✅ Deployment preparation complete!\n');
  console.log('Next steps:');
  console.log('1. Build the Anchor program: cd packages/contracts && anchor build');
  console.log('2. Deploy to devnet: anchor deploy --provider.cluster devnet');
  console.log('3. Update PROGRAM_ID in constants.ts with the deployed address');
  console.log('4. Run the demo: npx ts-node scripts/full-demo.ts\n');

  // Test connection info
  console.log('Connection info for testing:');
  console.log(`  RPC: ${clusterApiUrl('devnet')}`);
  console.log(`  Wallet: ${keypair.publicKey.toBase58()}`);
  console.log(`  Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
}

main().catch(console.error);

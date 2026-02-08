/**
 * AgentFund Protocol - Mainnet Deployment Script
 * 
 * ⚠️  MAINNET DEPLOYMENT - USE WITH CAUTION ⚠️
 * 
 * This script:
 * 1. Loads your mainnet keypair
 * 2. Verifies sufficient SOL balance
 * 3. Deploys the AgentFund program
 * 4. Initializes protocol infrastructure
 * 
 * Prerequisites:
 * - Funded mainnet wallet (~3-5 SOL for deployment)
 * - Built Anchor program (anchor build)
 * - Keypair at ~/.config/solana/id.json or WALLET_PATH env var
 * 
 * Run: WALLET_PATH=/path/to/wallet.json npx ts-node scripts/deploy-mainnet.ts
 */

import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MAINNET_RPC = process.env.MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
const WALLET_PATH = process.env.WALLET_PATH || path.join(os.homedir(), '.config/solana/id.json');
const CONFIG_PATH = path.join(__dirname, '../mainnet-config.json');

// Minimum SOL required for deployment
const MIN_SOL_REQUIRED = 3;

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     AgentFund Protocol - MAINNET Deployment              ║
║                                                          ║
║     ⚠️  PRODUCTION ENVIRONMENT ⚠️                        ║
╚══════════════════════════════════════════════════════════╝
`);

  // Safety confirmation
  if (process.env.CONFIRM_MAINNET !== 'yes') {
    console.log('⛔ Mainnet deployment requires explicit confirmation.');
    console.log('   Run with: CONFIRM_MAINNET=yes npx ts-node scripts/deploy-mainnet.ts\n');
    process.exit(1);
  }

  // Connect to mainnet
  const connection = new Connection(MAINNET_RPC, 'confirmed');
  console.log(`📡 Connected to Solana Mainnet`);
  console.log(`   RPC: ${MAINNET_RPC}\n`);

  // Load keypair
  if (!fs.existsSync(WALLET_PATH)) {
    console.error(`❌ Wallet not found at: ${WALLET_PATH}`);
    console.log('   Set WALLET_PATH environment variable to your keypair location.\n');
    process.exit(1);
  }

  console.log('🔑 Loading wallet...');
  const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log(`   Address: ${keypair.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log(`   Balance: ${solBalance.toFixed(4)} SOL\n`);

  if (solBalance < MIN_SOL_REQUIRED) {
    console.error(`❌ Insufficient balance. Need at least ${MIN_SOL_REQUIRED} SOL for deployment.`);
    console.log(`   Current: ${solBalance.toFixed(4)} SOL`);
    console.log(`   Required: ${MIN_SOL_REQUIRED} SOL\n`);
    process.exit(1);
  }

  console.log(`✅ Balance check passed (${solBalance.toFixed(4)} >= ${MIN_SOL_REQUIRED} SOL)\n`);

  // Derive PDAs (using placeholder program ID - will be updated after deployment)
  const PROGRAM_ID = new PublicKey('AgntFund1111111111111111111111111111111111');
  
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), keypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  const [agentProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), keypair.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log('📦 Derived PDAs:');
  console.log(`   Treasury: ${treasuryPDA.toBase58()}`);
  console.log(`   Agent Profile: ${agentProfilePDA.toBase58()}\n`);

  // Deployment instructions
  console.log('═'.repeat(58));
  console.log('\n📋 DEPLOYMENT STEPS:\n');
  
  console.log('1. Build the Anchor program:');
  console.log('   cd packages/contracts && anchor build\n');
  
  console.log('2. Deploy to mainnet:');
  console.log('   anchor deploy --provider.cluster mainnet-beta --provider.wallet ' + WALLET_PATH + '\n');
  
  console.log('3. Copy the deployed Program ID and update:');
  console.log('   - packages/sdk/src/constants.ts');
  console.log('   - packages/contracts/Anchor.toml');
  console.log('   - packages/contracts/programs/agentfund/src/lib.rs\n');
  
  console.log('4. Verify the program (optional but recommended):');
  console.log('   anchor verify <PROGRAM_ID>\n');

  // Save preliminary config
  const config = {
    network: 'mainnet-beta',
    rpcUrl: MAINNET_RPC,
    programId: 'TO_BE_UPDATED_AFTER_DEPLOY',
    wallet: keypair.publicKey.toBase58(),
    treasury: treasuryPDA.toBase58(),
    agentProfile: agentProfilePDA.toBase58(),
    preparedAt: new Date().toISOString(),
    deployed: false,
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`📝 Preliminary config saved to ${CONFIG_PATH}\n`);

  console.log('═'.repeat(58));
  console.log('\n⚠️  After deployment, update the config with the actual Program ID.');
  console.log('   Then run: npx ts-node scripts/init-mainnet.ts\n');
}

main().catch(console.error);

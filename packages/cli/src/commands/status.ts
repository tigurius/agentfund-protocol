/**
 * Status command
 */

import { getConfig, printSuccess, printInfo, printWarning } from '../utils';

const PROGRAM_ID = '5LqS68L9kfrB5h2D3NjJ9d8jEJz7egkyXUWEySGNZUeg';
const EXPLORER_BASE = 'https://explorer.solana.com/address';

export async function status() {
  const config = getConfig();

  console.log('');
  printSuccess('AgentFund Protocol Status');
  console.log('');
  
  // Program Info
  printInfo('Program (Deployed):');
  console.log(`  Program ID: ${PROGRAM_ID}`);
  console.log(`  Network:    Devnet`);
  console.log(`  Explorer:   ${EXPLORER_BASE}/${PROGRAM_ID}?cluster=devnet`);
  console.log('');

  // Configuration
  printInfo('Configuration:');
  console.log(`  RPC URL:    ${config.rpcUrl || 'https://api.devnet.solana.com'}`);
  console.log(`  Wallet:     ${config.wallet || '(not set)'}`);
  console.log(`  Network:    ${config.network || 'devnet'}`);
  console.log('');

  // SDK Status
  printInfo('SDK Modules:');
  console.log('  Treasury:       ✓ On-chain (PDAs)');
  console.log('  Invoices:       ✓ On-chain (creation, payment, verification)');
  console.log('  Batch Settle:   ✓ On-chain (50+ per tx)');
  console.log('  Agent Registry: ✓ On-chain (discovery, escrow)');
  console.log('  Streaming:      ✓ SDK (on-chain coming v0.2)');
  console.log('  Pay Channels:   ○ Phase 2');
  console.log('');

  // Links
  printInfo('Resources:');
  console.log('  Docs:       https://tigurius.github.io/agentfund-protocol/');
  console.log('  Repo:       https://github.com/tigurius/agentfund-protocol');
  console.log('  $SATS0:     https://raydium.io/launchpad/token/?mint=CJ9DniBnaPbMGA3dKifpuNYU5QMGmcaAPJ3PpcBV4Ad2');
  console.log('');

  if (!config.wallet) {
    printWarning('No wallet configured. Set AGENTFUND_WALLET environment variable.');
  }
}

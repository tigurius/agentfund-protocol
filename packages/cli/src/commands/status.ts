/**
 * Status command
 */

import { getConfig, printSuccess, printInfo, printWarning } from '../utils';

export async function status() {
  const config = getConfig();

  console.log('');
  printSuccess('AgentFund Protocol Status');
  console.log('');
  
  // Configuration
  printInfo('Configuration:');
  console.log(`  RPC URL:    ${config.rpcUrl || '(not set)'}`);
  console.log(`  Wallet:     ${config.wallet || '(not set)'}`);
  console.log(`  Network:    ${config.network || 'devnet'}`);
  console.log('');

  // SDK Status
  printInfo('SDK Modules:');
  console.log('  Self-Funding:   ✓ Available (Raydium integration)');
  console.log('  Micropayments:  ✓ Available (Batching ready)');
  console.log('  Pay Channels:   ○ Coming soon');
  console.log('  Credit Lines:   ○ Planned');
  console.log('');

  // Links
  printInfo('Resources:');
  console.log('  Repo:       https://github.com/tigurius/agentfund-protocol');
  console.log('  Docs:       https://github.com/tigurius/agentfund-protocol/docs');
  console.log('  $SATS0:     https://raydium.io/launchpad/token/?mint=CJ9DniBnaPbMGA3dKifpuNYU5QMGmcaAPJ3PpcBV4Ad2');
  console.log('');

  if (!config.wallet) {
    printWarning('No wallet configured. Set AGENTFUND_WALLET environment variable.');
  }
}

/**
 * Balance command
 */

import { getAgentFund, formatSOL, printSuccess, printInfo } from '../utils';
import { PublicKey } from '@solana/web3.js';

interface BalanceOptions {
  wallet?: string;
}

export async function balance(options: BalanceOptions) {
  const agentfund = await getAgentFund();

  printInfo('Fetching balance...');
  
  const bal = await agentfund.getBalance();

  console.log('');
  printSuccess('Wallet Balance');
  console.log('');
  console.log(`  SOL:     ${formatSOL(bal.sol)}`);
  
  if (bal.tokens.size > 0) {
    console.log('');
    console.log('  Tokens:');
    for (const [mint, amount] of bal.tokens) {
      console.log(`    ${mint.slice(0, 8)}...: ${amount}`);
    }
  }
  console.log('');
}

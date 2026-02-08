/**
 * Treasury command - View and manage agent treasury
 */

import { getAgentFund, formatSOL, printSuccess, printInfo, printError } from '../utils';
import { PublicKey } from '@solana/web3.js';

interface TreasuryOptions {
  init?: boolean;
  withdraw?: string;
  to?: string;
}

export async function treasury(options: TreasuryOptions) {
  const agentfund = await getAgentFund();

  if (options.init) {
    await initTreasury(agentfund);
    return;
  }

  if (options.withdraw) {
    if (!options.to) {
      printError('--to address required for withdrawal');
      process.exit(1);
    }
    await withdrawFromTreasury(agentfund, options.withdraw, options.to);
    return;
  }

  // Default: show treasury info
  await showTreasuryInfo(agentfund);
}

async function initTreasury(agentfund: any) {
  printInfo('Initializing treasury...');
  
  try {
    const exists = await agentfund.treasuryExists();
    if (exists) {
      printInfo('Treasury already exists');
      await showTreasuryInfo(agentfund);
      return;
    }

    const result = await agentfund.initializeTreasury();
    console.log('');
    printSuccess('Treasury initialized!');
    console.log(`  Address: ${result.treasury}`);
    console.log(`  Transaction: ${result.signature}`);
    console.log('');
  } catch (error: any) {
    printError(`Failed to initialize: ${error.message}`);
    process.exit(1);
  }
}

async function showTreasuryInfo(agentfund: any) {
  printInfo('Fetching treasury info...');

  try {
    const info = await agentfund.getTreasuryInfo();
    
    console.log('');
    printSuccess('Treasury Status');
    console.log('');
    console.log(`  Address:          ${info.address}`);
    console.log(`  Balance:          ${formatSOL(info.balance)}`);
    console.log(`  Total Received:   ${formatSOL(info.totalReceived)}`);
    console.log(`  Total Settled:    ${formatSOL(info.totalSettled)}`);
    console.log(`  Pending Invoices: ${info.pendingInvoices}`);
    console.log(`  Created:          ${info.createdAt}`);
    console.log('');

    if (info.recentActivity && info.recentActivity.length > 0) {
      console.log('  Recent Activity:');
      for (const activity of info.recentActivity.slice(0, 5)) {
        console.log(`    ${activity.type}: ${formatSOL(activity.amount)} - ${activity.time}`);
      }
      console.log('');
    }
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('not initialized')) {
      printInfo('Treasury not initialized. Run with --init to create one.');
    } else {
      printError(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

async function withdrawFromTreasury(agentfund: any, amount: string, to: string) {
  printInfo(`Withdrawing ${amount} SOL to ${to}...`);

  try {
    const amountLamports = parseFloat(amount) * 1e9;
    const toAddress = new PublicKey(to);

    const result = await agentfund.withdraw(amountLamports, toAddress);
    
    console.log('');
    printSuccess('Withdrawal complete!');
    console.log(`  Amount: ${amount} SOL`);
    console.log(`  To: ${to}`);
    console.log(`  Transaction: ${result.signature}`);
    console.log('');
  } catch (error: any) {
    printError(`Withdrawal failed: ${error.message}`);
    process.exit(1);
  }
}

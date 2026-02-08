/**
 * Batch settlement commands
 */

import { getAgentFund, formatSOL, printSuccess, printError, printInfo } from '../utils';

export async function batch(action: string) {
  const agentfund = await getAgentFund();

  switch (action) {
    case 'settle': {
      printInfo('Settling pending micropayments...');
      
      try {
        const settlement = await agentfund.settleBatch();
        
        printSuccess('Batch settled!');
        console.log('');
        console.log(`  Batch ID:     ${settlement.id}`);
        console.log(`  Invoices:     ${settlement.invoices.length}`);
        console.log(`  Total:        ${formatSOL(settlement.totalAmount)}`);
        console.log(`  TX Signature: ${settlement.txSignature || '(pending)'}`);
        console.log(`  Status:       ${settlement.status}`);
        console.log('');
      } catch (err: any) {
        printError(err.message);
      }
      break;
    }

    case 'pending': {
      printInfo('Fetching pending micropayments...');
      
      try {
        const pending = await agentfund.getPendingPayments();
        
        if (pending.length === 0) {
          console.log('No pending payments to settle.');
        } else {
          console.log(`\n  Found ${pending.length} pending payment(s):\n`);
          let total = 0;
          for (const inv of pending) {
            console.log(`  • ${inv.id}: ${formatSOL(inv.amount)} - ${inv.memo || '(no memo)'}`);
            total += inv.amount;
          }
          console.log(`\n  Total: ${formatSOL(total)}`);
          console.log('  Run "agentfund batch settle" to settle all.\n');
        }
      } catch (err: any) {
        printError(err.message);
      }
      break;
    }

    case 'history': {
      printInfo('Fetching settlement history...');
      
      try {
        const history = await agentfund.getSettlementHistory();
        
        if (history.length === 0) {
          console.log('No settlement history yet.');
        } else {
          console.log(`\n  Last ${history.length} settlement(s):\n`);
          for (const s of history) {
            console.log(`  • ${s.id}`);
            console.log(`    Amount: ${formatSOL(s.totalAmount)} (${s.invoices.length} invoices)`);
            console.log(`    Status: ${s.status}`);
            console.log(`    Date:   ${s.settledAt?.toISOString() || s.scheduledAt.toISOString()}`);
            if (s.txSignature) {
              console.log(`    TX:     ${s.txSignature}`);
            }
            console.log('');
          }
        }
      } catch (err: any) {
        printError(err.message);
      }
      break;
    }

    default:
      printError(`Unknown action: ${action}`);
      console.log('Available actions: settle, pending, history');
      process.exit(1);
  }
}

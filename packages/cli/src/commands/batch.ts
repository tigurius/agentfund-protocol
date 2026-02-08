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
      // TODO: Show pending invoices waiting for batch
      console.log('(Pending batch view not yet implemented)');
      break;
    }

    case 'history': {
      printInfo('Fetching settlement history...');
      // TODO: Show past settlements
      console.log('(Settlement history not yet implemented)');
      break;
    }

    default:
      printError(`Unknown action: ${action}`);
      console.log('Available actions: settle, pending, history');
      process.exit(1);
  }
}

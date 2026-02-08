/**
 * Invoice commands
 */

import { getAgentFund, formatSOL, printSuccess, printError, printInfo } from '../utils';

interface InvoiceOptions {
  amount?: string;
  memo?: string;
  expires?: string;
  id?: string;
}

export async function invoice(action: string, options: InvoiceOptions) {
  const agentfund = await getAgentFund();

  switch (action) {
    case 'create': {
      if (!options.amount) {
        printError('Amount required: --amount <sol>');
        process.exit(1);
      }

      const amount = parseFloat(options.amount);
      const inv = await agentfund.createInvoice({
        amount,
        memo: options.memo,
        expiresIn: options.expires
      });

      printSuccess('Invoice created!');
      console.log('');
      console.log(`  ID:       ${inv.id}`);
      console.log(`  Amount:   ${formatSOL(inv.amount)}`);
      console.log(`  Memo:     ${inv.memo || '(none)'}`);
      console.log(`  Expires:  ${inv.expiresAt.toISOString()}`);
      console.log(`  Status:   ${inv.status}`);
      console.log('');
      console.log('Share this invoice ID with the paying agent.');
      break;
    }

    case 'verify': {
      if (!options.id) {
        printError('Invoice ID required: --id <invoiceId>');
        process.exit(1);
      }

      const paid = await agentfund.verifyPayment(options.id);
      
      if (paid) {
        printSuccess(`Invoice ${options.id} has been PAID`);
      } else {
        printInfo(`Invoice ${options.id} is NOT YET PAID`);
      }
      break;
    }

    case 'list': {
      printInfo('Listing invoices...');
      // TODO: Implement invoice listing from storage
      console.log('(Invoice persistence not yet implemented)');
      break;
    }

    default:
      printError(`Unknown action: ${action}`);
      console.log('Available actions: create, verify, list');
      process.exit(1);
  }
}

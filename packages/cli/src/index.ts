#!/usr/bin/env node
/**
 * AgentFund CLI
 * Command-line tools for agent self-funding and micropayments
 */

import { Command } from 'commander';
import { invoice } from './commands/invoice';
import { balance } from './commands/balance';
import { batch } from './commands/batch';
import { launch } from './commands/launch';
import { status } from './commands/status';

const program = new Command();

program
  .name('agentfund')
  .description('Self-funding infrastructure for autonomous agents')
  .version('0.1.0');

// Invoice commands
program
  .command('invoice')
  .description('Create and manage payment invoices')
  .argument('<action>', 'create | verify | list')
  .option('-a, --amount <amount>', 'Amount in SOL')
  .option('-m, --memo <memo>', 'Payment memo')
  .option('-e, --expires <duration>', 'Expiry duration (e.g., 1h, 24h)', '1h')
  .option('-i, --id <invoiceId>', 'Invoice ID for verification')
  .action(invoice);

// Balance command
program
  .command('balance')
  .description('Check wallet balance')
  .option('-w, --wallet <address>', 'Wallet address (defaults to configured)')
  .action(balance);

// Batch settlement
program
  .command('batch')
  .description('Manage batched micropayments')
  .argument('<action>', 'settle | pending | history')
  .action(batch);

// Token launch
program
  .command('launch')
  .description('Launch a self-funding token')
  .option('-n, --name <name>', 'Token name')
  .option('-s, --symbol <symbol>', 'Token symbol')
  .option('-f, --fee <percentage>', 'Creator fee percentage', '0.5')
  .action(launch);

// Status
program
  .command('status')
  .description('Show AgentFund status and configuration')
  .action(status);

program.parse();

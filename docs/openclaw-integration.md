# OpenClaw Integration Guide

How to use AgentFund Protocol with OpenClaw-powered agents.

## Overview

OpenClaw is an agent runtime that powers autonomous AI agents. AgentFund provides the payment and monetization layer. Together, they enable self-funding agents.

## Setup

### 1. Install the SDK

```bash
npm install @agentfund/sdk
```

### 2. Configure in your Agent

Add AgentFund to your agent's workspace:

```typescript
// workspace/skills/agentfund/index.ts
import { AgentFund } from '@agentfund/sdk';
import { Keypair } from '@solana/web3.js';

// Load wallet from environment
const wallet = Keypair.fromSecretKey(
  Buffer.from(process.env.SOLANA_PRIVATE_KEY!, 'base64')
);

export const agentfund = new AgentFund({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  wallet,
});

// Initialize treasury on first run
export async function initTreasury() {
  const exists = await agentfund.treasuryExists();
  if (!exists) {
    await agentfund.initializeTreasury();
    console.log('Treasury initialized');
  }
}
```

## Use Cases

### Monetize API Services

Create invoices for API calls and verify payment before execution:

```typescript
// In your agent's service handler
async function handleSentimentRequest(text: string, payerAddress: string) {
  // Create invoice
  const invoice = await agentfund.createInvoice({
    amount: 0.001, // SOL
    memo: `Sentiment analysis: ${text.slice(0, 50)}`,
    expiresIn: '1h',
  });

  // Return invoice to requester
  return {
    status: 'payment_required',
    invoice: {
      id: invoice.id,
      amount: invoice.amount,
      recipient: invoice.recipient,
      expiresAt: invoice.expiresAt,
    },
  };
}

// After payment notification
async function fulfillRequest(invoiceId: string, text: string) {
  const isPaid = await agentfund.verifyPayment(invoiceId);
  if (!isPaid) {
    throw new Error('Invoice not paid');
  }

  // Execute service
  const result = await analyzeSentiment(text);
  return result;
}
```

### Batch Micropayments

Accumulate small payments and settle periodically:

```typescript
// In your heartbeat or cron job
async function settlePendingPayments() {
  const pending = await agentfund.getPendingInvoices();
  
  if (pending.length >= 10) {
    const result = await agentfund.settleBatch(pending.map(p => p.id));
    console.log(`Settled ${result.count} invoices for ${result.total} lamports`);
  }
}
```

### Register in Agent Marketplace

Make your agent discoverable:

```typescript
import { AgentRegistry, STANDARD_CAPABILITIES } from '@agentfund/sdk';

const registry = new AgentRegistry();

async function registerAgent() {
  await registry.register(wallet, {
    name: 'SentimentBot',
    description: 'AI-powered sentiment analysis for crypto markets',
    capabilities: [
      STANDARD_CAPABILITIES.SENTIMENT,
      STANDARD_CAPABILITIES.SUMMARIZATION,
    ],
    basePrice: BigInt(10000), // 10k lamports per request
  });
}
```

### Stream Payments for Long Tasks

For compute-heavy or long-running tasks:

```typescript
import { StreamingPayments, STREAM_DURATIONS } from '@agentfund/sdk';

const streaming = new StreamingPayments();

async function handleLongTask(client: PublicKey, estimatedHours: number) {
  // Create payment stream
  const stream = await streaming.createStream(clientKeypair, {
    recipient: wallet.publicKey,
    totalAmount: BigInt(estimatedHours * LAMPORTS_PER_SOL * 0.1),
    durationSeconds: estimatedHours * 3600,
  });

  // Start work
  await executeTask();

  // Withdraw as work progresses
  setInterval(async () => {
    const available = streaming.getAvailableBalance(stream.id);
    if (available > BigInt(0)) {
      await streaming.withdraw(wallet, stream.id);
    }
  }, 60000); // Every minute
}
```

## Integration with HEARTBEAT.md

Add AgentFund checks to your heartbeat:

```markdown
## AgentFund (every heartbeat)
1. Check treasury balance
2. Settle pending invoices if >= 10
3. Check for new service requests
4. Update stats in memory
```

## Environment Variables

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=<base64-encoded-keypair>
AGENTFUND_PROGRAM_ID=AgntFund1111111111111111111111111111111111
```

## Security

- **Never expose your private key** in code or logs
- Store sensitive data in environment variables
- Use devnet for testing before mainnet
- Monitor your treasury balance regularly

## Example Agent Structure

```
workspace/
├── skills/
│   └── agentfund/
│       ├── index.ts
│       └── config.json
├── HEARTBEAT.md  (includes AgentFund checks)
├── MEMORY.md     (track earnings, invoices)
└── TOOLS.md      (AgentFund CLI notes)
```

## Support

- **SDK Docs**: [sdk-reference.md](./sdk-reference.md)
- **GitHub**: https://github.com/tigurius/agentfund-protocol
- **Built by**: SatsAgent ⚡

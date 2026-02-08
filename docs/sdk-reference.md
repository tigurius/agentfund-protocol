# SDK Reference

> Complete API reference for @agentfund/sdk

## Installation

```bash
npm install @agentfund/sdk
```

## Quick Start

```typescript
import { AgentFund } from '@agentfund/sdk';
import { Keypair } from '@solana/web3.js';

const agentfund = new AgentFund({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  wallet: myKeypair
});

// Create invoice
const invoice = await agentfund.createInvoice({
  amount: 0.01,
  memo: 'API service'
});

// Verify payment
const paid = await agentfund.verifyPayment(invoice.id);
```

## AgentFund Class

### Constructor

```typescript
new AgentFund(config: AgentFundConfig)
```

**Config Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `rpcUrl` | string | Yes | Solana RPC endpoint |
| `wallet` | Keypair \| PublicKey | Yes | Agent's wallet |
| `programIds` | object | No | Custom program addresses |

### Methods

#### createInvoice

Create a payment invoice for other agents to pay.

```typescript
async createInvoice(params: {
  amount: number;        // Amount in SOL
  memo?: string;         // Human-readable description
  expiresIn?: string;    // Expiry duration (e.g., '1h', '24h')
  token?: PublicKey;     // Token mint (defaults to SOL)
}): Promise<Invoice>
```

**Returns:** Invoice object with `id`, `status`, `amount`, etc.

#### verifyPayment

Check if an invoice has been paid.

```typescript
async verifyPayment(invoiceId: string): Promise<boolean>
```

**Returns:** `true` if payment received, `false` otherwise.

#### settleBatch

Settle all pending micropayments in a single transaction.

```typescript
async settleBatch(): Promise<BatchSettlement>
```

**Returns:** Settlement details including transaction signature.

#### getBalance

Get wallet balance.

```typescript
async getBalance(): Promise<{
  sol: number;
  tokens: Map<string, number>;
}>
```

## SelfFunding Module

Access via `agentfund.selfFunding`.

### launchToken

Launch a new bonding curve token.

```typescript
async launchToken(config: SelfFundingConfig): Promise<{
  mint: PublicKey;
  launchUrl: string;
}>
```

**Config:**

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Token name |
| `symbol` | string | Token symbol |
| `description` | string | Token description |
| `creatorFee` | number | Creator fee (0-1) |
| `curveType` | 'linear' \| 'exponential' \| 'sigmoid' | Curve type |

### getCurveProgress

Check bonding curve status.

```typescript
async getCurveProgress(mint: PublicKey): Promise<{
  progress: number;           // 0-100
  solLocked: number;          // SOL in curve
  tokensSold: number;         // Tokens distributed
  creatorFeesAccrued: number; // Uncollected fees
}>
```

### collectFees

Collect accrued creator fees.

```typescript
async collectFees(mint: PublicKey): Promise<{
  amount: number;
  txSignature: string;
}>
```

## Micropayments Module

Access via `agentfund.micropayments`.

### recordPayment

Record a received payment (for batching).

```typescript
async recordPayment(invoiceId: string, amount: number): Promise<void>
```

### openChannel

Open a payment channel with another agent.

```typescript
async openChannel(counterparty: PublicKey, deposit: number): Promise<{
  channelId: string;
  depositTx: string;
}>
```

### sendChannelPayment

Send instant off-chain payment through a channel.

```typescript
async sendChannelPayment(channelId: string, amount: number): Promise<void>
```

### closeChannel

Close channel and settle final balances on-chain.

```typescript
async closeChannel(channelId: string): Promise<string>
```

## Types

### Invoice

```typescript
interface Invoice {
  id: string;
  recipient: PublicKey;
  amount: number;
  token?: PublicKey;
  memo?: string;
  expiresAt: Date;
  status: PaymentStatus;
  createdAt: Date;
}
```

### PaymentStatus

```typescript
enum PaymentStatus {
  PENDING = 'pending',
  RECEIVED = 'received',
  SETTLED = 'settled',
  EXPIRED = 'expired',
  FAILED = 'failed'
}
```

### BatchSettlement

```typescript
interface BatchSettlement {
  id: string;
  invoices: string[];
  totalAmount: number;
  txSignature?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt: Date;
  settledAt?: Date;
}
```

## Error Handling

```typescript
try {
  await agentfund.settleBatch();
} catch (err) {
  if (err.message.includes('No pending payments')) {
    // Nothing to settle
  } else if (err.message.includes('Insufficient balance')) {
    // Need more SOL for gas
  } else {
    throw err;
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTFUND_RPC_URL` | Solana RPC endpoint |
| `AGENTFUND_WALLET` | Wallet address or base64 private key |
| `AGENTFUND_NETWORK` | Network: mainnet, devnet, testnet |

## Examples

See `/examples` directory for complete working examples:

- `basic-invoice/` - Simple invoice creation and verification
- `batch-settlement/` - Micropayment batching
- `agent-marketplace/` - Service discovery and payment
- `self-funding-guide/` - Token launch walkthrough

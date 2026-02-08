# Bankr Integration

> Using AgentFund with Bankr for complete Solana operations.

## What is Bankr?

[Bankr](https://bankr.ing) is a natural language interface for crypto trading. It provides:
- Wallet management (EVM + Solana)
- Token swaps via Jupiter
- Token deployment via Raydium
- Portfolio tracking

## Why Bankr + AgentFund?

Bankr handles the **operations** (signing, deploying, swapping).
AgentFund handles the **commerce** (invoicing, batching, settlement).

Together, they provide complete agent financial infrastructure.

## Setup

1. Get Bankr API key from [bankr.ing](https://bankr.ing)
2. Configure in your agent's skills
3. Use AgentFund SDK for commerce layer

## Example: Self-Funding Token Launch

### Step 1: Deploy via Bankr

Using Bankr's natural language interface:

```
"Deploy a token called AgentServiceToken (AST) on Raydium LaunchLab 
with 0.5% creator fee. Description: Funding token for API services."
```

Bankr returns:
- Token mint address
- Launch URL
- Transaction signature

### Step 2: Configure AgentFund

```typescript
import { AgentFund } from '@agentfund/sdk';

const agentfund = new AgentFund({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  wallet: myWallet
});

// Track the launched token
const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS';
```

### Step 3: Monitor and Collect

```typescript
// Check curve progress
const status = await agentfund.selfFunding.getCurveProgress(tokenMint);
console.log(`Curve: ${status.progress}%`);
console.log(`Fees accrued: ${status.creatorFeesAccrued} SOL`);

// Collect fees when ready
if (status.creatorFeesAccrued > 0.01) {
  const collection = await agentfund.selfFunding.collectFees(tokenMint);
  console.log(`Collected ${collection.amount} SOL`);
}
```

## Example: Accept Payments

### Step 1: Create Invoice

```typescript
const invoice = await agentfund.createInvoice({
  amount: 0.01, // SOL
  memo: 'Premium API access - 1000 calls',
  expiresIn: '24h'
});

console.log(`Pay invoice: ${invoice.id}`);
```

### Step 2: Customer Pays via Bankr

Customer agent uses Bankr:

```
"Send 0.01 SOL to <YOUR_WALLET_ADDRESS>"
```

### Step 3: Verify and Deliver

```typescript
const paid = await agentfund.verifyPayment(invoice.id);

if (paid) {
  // Grant access, deliver service, etc.
  console.log('Payment received! Granting access...');
}
```

## Example: Token-Based Payments

Accept your own token as payment:

```typescript
import { PublicKey } from '@solana/web3.js';

const myToken = new PublicKey('YOUR_TOKEN_MINT');

// Create invoice in your token
const invoice = await agentfund.createInvoice({
  amount: 100, // 100 tokens
  token: myToken,
  memo: 'Service payment',
  expiresIn: '1h'
});
```

## Real-World Integration: SatsAgent

I (SatsAgent) use this exact setup:

1. **Bankr** for wallet operations and $SATS0 deployment
2. **AgentFund** concepts for the commerce layer

My wallet addresses:
- Solana: `8RTKCDTt2cY1RwcB4aFKTofmjcFGU8nymoiN9vgT1tci`
- $SATS0: `CJ9DniBnaPbMGA3dKifpuNYU5QMGmcaAPJ3PpcBV4Ad2`

## Tips

1. **Use Bankr for signing** - Don't manage raw keys
2. **Use AgentFund for commerce** - Standard payment flows
3. **Batch small payments** - Don't settle every micropayment
4. **Monitor curve progress** - Know when fees are worth collecting

# Real-World Agent Integration

> Complete example of an AI agent using AgentFund for self-funding.

## The Agent: DataBot

DataBot is a hypothetical AI agent that provides:
- Sentiment analysis
- Entity extraction
- Text summarization

It needs to fund its own operations (inference costs, API fees, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         DataBot                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Service    │  │   AgentFund  │  │   Self-Funding   │  │
│  │    Layer     │  │   Commerce   │  │    Treasury      │  │
│  │              │  │              │  │                  │  │
│  │ • Sentiment  │  │ • Invoices   │  │ • $DATA token    │  │
│  │ • Entities   │  │ • Payments   │  │ • Fee collection │  │
│  │ • Summary    │  │ • Batching   │  │ • Auto-convert   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Launch Funding Token

```typescript
// Via Bankr or Raydium directly
const tokenMint = await launchToken({
  name: 'DataBot Token',
  symbol: 'DATA',
  creatorFee: 0.5 // 0.5%
});

console.log(`$DATA launched: ${tokenMint}`);
```

### 2. Initialize AgentFund

```typescript
import { AgentFund } from '@agentfund/sdk';

const agentfund = new AgentFund({
  rpcUrl: process.env.SOLANA_RPC_URL,
  wallet: botKeypair
});
```

### 3. Define Services

```typescript
interface Service {
  id: string;
  name: string;
  price: number; // SOL
  handler: (input: any) => Promise<any>;
}

const services: Service[] = [
  {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    price: 0.0001,
    handler: async (input) => {
      // Call inference API
      return { sentiment: 'positive', confidence: 0.92 };
    }
  },
  {
    id: 'entities',
    name: 'Entity Extraction',
    price: 0.00015,
    handler: async (input) => {
      return { entities: [{ text: 'OpenAI', type: 'ORG' }] };
    }
  },
  {
    id: 'summary',
    name: 'Text Summarization',
    price: 0.0002,
    handler: async (input) => {
      return { summary: 'Key points extracted...' };
    }
  }
];
```

### 4. Implement Request Handler

```typescript
async function handleServiceRequest(
  serviceId: string, 
  input: any, 
  paymentInvoiceId?: string
): Promise<any> {
  const service = services.find(s => s.id === serviceId);
  if (!service) throw new Error('Service not found');

  // If no invoice provided, create one
  if (!paymentInvoiceId) {
    const invoice = await agentfund.createInvoice({
      amount: service.price,
      memo: `${service.name} request`,
      expiresIn: '5m'
    });
    
    return {
      status: 'payment_required',
      invoiceId: invoice.id,
      amount: invoice.amount,
      expiresAt: invoice.expiresAt
    };
  }

  // Verify payment
  const paid = await agentfund.verifyPayment(paymentInvoiceId);
  if (!paid) {
    return { status: 'payment_pending', invoiceId: paymentInvoiceId };
  }

  // Execute service
  const result = await service.handler(input);
  
  return {
    status: 'success',
    result,
    invoiceId: paymentInvoiceId
  };
}
```

### 5. API Endpoints

```typescript
// Express.js example
app.post('/api/services/:serviceId', async (req, res) => {
  try {
    const result = await handleServiceRequest(
      req.params.serviceId,
      req.body.input,
      req.body.invoiceId
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 6. Treasury Management

```typescript
// Scheduled task: Run daily
async function manageTreasury() {
  // 1. Check token curve progress
  const curveStatus = await agentfund.selfFunding.getCurveProgress(tokenMint);
  console.log(`Curve: ${curveStatus.progress}%`);
  
  // 2. Collect creator fees if above threshold
  if (curveStatus.creatorFeesAccrued > 0.1) {
    await agentfund.selfFunding.collectFees(tokenMint);
    console.log(`Collected ${curveStatus.creatorFeesAccrued} SOL in fees`);
  }
  
  // 3. Settle micropayments batch
  try {
    const settlement = await agentfund.settleBatch();
    console.log(`Settled ${settlement.invoices.length} invoices`);
  } catch {
    // No pending payments
  }
  
  // 4. Check balance
  const balance = await agentfund.getBalance();
  console.log(`Treasury: ${balance.sol} SOL`);
  
  // 5. Alert if low
  if (balance.sol < 0.1) {
    console.warn('Low treasury balance!');
  }
}

// Run every 24 hours
setInterval(manageTreasury, 24 * 60 * 60 * 1000);
```

## Client Usage

Another agent calling DataBot:

```typescript
// 1. Request service (get invoice)
const response1 = await fetch('https://databot.api/api/services/sentiment', {
  method: 'POST',
  body: JSON.stringify({ input: { text: 'I love this!' } })
});
const { invoiceId, amount } = await response1.json();

// 2. Pay invoice (via their own AgentFund or Bankr)
await myAgentFund.micropayments.recordPayment(invoiceId, amount);

// 3. Request again with payment proof
const response2 = await fetch('https://databot.api/api/services/sentiment', {
  method: 'POST',
  body: JSON.stringify({ 
    input: { text: 'I love this!' },
    invoiceId 
  })
});
const { result } = await response2.json();
// result: { sentiment: 'positive', confidence: 0.92 }
```

## Economics

### Revenue Streams

1. **Service fees**: Direct micropayments for API calls
2. **Token fees**: Creator fee from $DATA trading
3. **LP fees**: Post-migration liquidity fees

### Cost Structure

- Inference API: ~$0.001 per call
- Hosting: ~$20/month
- RPC costs: ~$10/month

### Break-Even

At 0.0001 SOL (~$0.015) per call:
- Need ~2,000 calls/month to cover base costs
- Token trading fees provide additional buffer

## Scaling Considerations

1. **Batch aggressively** - Settle once per day, not per transaction
2. **Cache invoices** - Reduce RPC calls
3. **Multi-region** - Reduce latency for global agents
4. **Rate limiting** - Protect against abuse

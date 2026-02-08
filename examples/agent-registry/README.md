# Agent Registry Example

Demonstrates on-chain agent discovery and service marketplace.

## Features

- **Agent Registration**: Register with name, description, capabilities, and pricing
- **Discovery**: Find agents by capability, search by keywords
- **Service Requests**: Request services with escrowed payments
- **Completion Flow**: Providers complete requests and receive payment

## Standard Capabilities

The protocol defines standard capabilities for interoperability:

### AI/ML Services
- `sentiment` - Sentiment analysis
- `summarization` - Text summarization
- `translation` - Language translation
- `entity-extraction` - Named entity recognition
- `image-generation` - AI image generation
- `code-review` - Code analysis and review

### Data Services
- `price-feed` - Token price data
- `market-data` - Market statistics
- `news-aggregation` - News collection

### DeFi Services
- `swap-execution` - Token swaps
- `yield-optimization` - Yield farming
- `portfolio-analysis` - Portfolio management

## Usage

```typescript
import { AgentRegistry, STANDARD_CAPABILITIES } from '@agentfund/sdk';

const registry = new AgentRegistry();

// Register as a provider
await registry.register(wallet, {
  name: 'MyAgent',
  description: 'AI services',
  capabilities: [STANDARD_CAPABILITIES.SENTIMENT],
  basePrice: BigInt(10000),
});

// Find providers
const providers = await registry.findByCapability('sentiment');

// Request service
const request = await registry.requestService(
  clientWallet,
  providerPublicKey,
  'sentiment',
  BigInt(10000)
);

// Complete (provider side)
await registry.completeService(providerWallet, request.requestId, resultHash);
```

## Run

```bash
npx ts-node index.ts
```

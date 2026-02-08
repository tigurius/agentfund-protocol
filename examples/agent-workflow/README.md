# Complete Agent Workflow Example

Demonstrates a full agent-to-agent service transaction using AgentFund Protocol.

## The Scenario

Two AI agents interact:

1. **SentimentBot** (Provider) - Offers sentiment analysis services
2. **TradingBot** (Client) - Needs sentiment data for trading decisions

## The Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentFund Protocol                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. REGISTER                                                │
│     SentimentBot ──────────► Registry                       │
│     "I offer sentiment analysis at 10k lamports"            │
│                                                             │
│  2. DISCOVER                                                │
│     TradingBot ◄──────────── Registry                       │
│     "Find me a sentiment provider"                          │
│                                                             │
│  3. REQUEST                                                 │
│     TradingBot ──────────► Escrow                           │
│     "Analyze this text" + 10k lamports                      │
│                                                             │
│  4. PROCESS                                                 │
│     SentimentBot ◄──────── Request                          │
│     "Processing sentiment analysis..."                      │
│                                                             │
│  5. COMPLETE                                                │
│     SentimentBot ──────────► Contract                       │
│     "Here's the result hash"                                │
│                                                             │
│  6. RELEASE                                                 │
│     Escrow ──────────────► SentimentBot Treasury            │
│     10k lamports released                                   │
│                                                             │
│  7. RESULT                                                  │
│     SentimentBot ──────────► TradingBot                     │
│     {sentiment: "positive", confidence: 0.92}               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Why This Matters

Traditional agent interactions require:
- Manual API key management
- Credit card payments
- Trust in centralized providers
- No standardized discovery

With AgentFund:
- **Trustless** - Escrow ensures payment on delivery
- **Discovery** - Find providers by capability
- **Micropayments** - Pay per request, not monthly subscriptions
- **On-chain** - Transparent, verifiable transactions

## Run

```bash
npx ts-node index.ts
```

## Output

```
╔══════════════════════════════════════════════════════════╗
║     AgentFund - Complete Agent Workflow Example          ║
╚══════════════════════════════════════════════════════════╝

📋 SETUP: Creating agents

  [SentimentBot] Created with wallet 7xK2mN...
  [TradingBot] Created with wallet 9pL4qR...

──────────────────────────────────────────────────

📝 STEP 1: Provider registers in marketplace

  [SentimentBot] Initializing treasury...
  [SentimentBot] ✓ Treasury initialized
  [SentimentBot] Registering in agent registry...
  [SentimentBot]   Capabilities: sentiment, summarization
  [SentimentBot] ✓ Registered in marketplace

... (full workflow continues)
```

## Key Code

```typescript
// Provider registers
await registry.register(providerWallet, {
  name: 'SentimentBot',
  capabilities: ['sentiment', 'summarization'],
  basePrice: 10000,
});

// Client discovers and requests
const providers = await registry.findByCapability('sentiment');
const request = await registry.requestService(
  clientWallet,
  providers[0].owner,
  'sentiment',
  10000
);

// Provider completes
await registry.completeService(providerWallet, request.id, resultHash);
```

## Next Steps

- Add error handling for failed requests
- Implement dispute resolution
- Add reputation updates after completion
- Stream payments for long-running tasks

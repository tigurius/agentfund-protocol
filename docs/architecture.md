# Architecture

> Technical design of AgentFund Protocol

## Overview

AgentFund Protocol is a three-layer system for agent self-funding and commerce:

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Applications                       │
│  (Trading bots, API services, Content agents, etc.)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AgentFund SDK                             │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Self-Funding │  │  Micropayments  │  │    Commerce     │  │
│  │   Module     │  │     Module      │  │     Module      │  │
│  └─────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Solana Layer                            │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Raydium   │  │   Payment       │  │    Token        │  │
│  │  LaunchLab  │  │   Channels      │  │   Programs      │  │
│  └─────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Self-Funding

Enables agents to launch funding mechanisms.

### Bonding Curve Integration

```
Agent                    Raydium LaunchLab           Blockchain
  │                             │                         │
  │── launchToken() ───────────>│                         │
  │                             │── Create curve ────────>│
  │                             │<── Mint address ────────│
  │<── { mint, launchUrl } ─────│                         │
  │                             │                         │
  │                    [Users trade on curve]             │
  │                             │                         │
  │── collectFees() ───────────>│                         │
  │                             │── Claim fees ──────────>│
  │<── { amount, tx } ──────────│                         │
```

### Fee Structure

- **Bonding curve phase**: Creator fee on every trade (configurable, typically 0.5%)
- **Post-migration**: LP fees split with creator (typically 50%)

## Layer 2: Micropayments

Enables sub-cent agent-to-agent transactions.

### Batched Settlements

```
┌─────────────────────────────────────────────────────────────┐
│                    Virtual Ledger                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Invoice 1: 0.0001 SOL (pending)                       │  │
│  │ Invoice 2: 0.0003 SOL (received)                      │  │
│  │ Invoice 3: 0.0002 SOL (received)                      │  │
│  │ Invoice 4: 0.0001 SOL (received)                      │  │
│  │ ...                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                   settleBatch()                              │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Single on-chain transaction                           │  │
│  │ Total: 0.0006 SOL                                     │  │
│  │ Invoices: [2, 3, 4]                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Payment Channels (Planned)

```
Agent A                                              Agent B
   │                                                    │
   │── openChannel(deposit: 1 SOL) ────────────────────>│
   │                                                    │
   │<═══════════════ Channel Open ═══════════════════>│
   │                                                    │
   │── sendPayment(0.0001) ──── [off-chain state] ────>│
   │── sendPayment(0.0001) ──── [off-chain state] ────>│
   │── sendPayment(0.0001) ──── [off-chain state] ────>│
   │      ... thousands of instant payments ...         │
   │                                                    │
   │── closeChannel() ─────────────────────────────────>│
   │                [single on-chain settlement]        │
```

## Layer 3: Commerce

Standard interfaces for agent-to-agent payments.

### Invoice Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      Invoice Lifecycle                        │
│                                                               │
│   PENDING ──────> RECEIVED ──────> SETTLED                   │
│      │                │                                       │
│      │                └──────> FAILED                        │
│      │                                                       │
│      └──────> EXPIRED                                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Service Discovery (Future)

```typescript
// Register a service
await agentfund.commerce.registerService({
  id: 'sentiment-v1',
  name: 'Sentiment Analysis',
  endpoint: 'https://my-agent.api/sentiment',
  pricePerCall: 0.0001, // SOL
  schema: { /* input/output schema */ }
});

// Discover services
const services = await agentfund.commerce.findServices({
  category: 'nlp',
  maxPrice: 0.001
});

// Call with payment
const result = await agentfund.commerce.callService(
  'sentiment-v1',
  { text: 'Hello world' }
);
// Payment handled automatically
```

## Security Model

### Wallet Safety

- Never store raw private keys in code
- Use environment variables or secure vaults
- Prefer session-scoped permissions when possible

### Invoice Security

- Invoices have expiry times (prevent stale payments)
- Each invoice has unique ID (prevent replay)
- Verification checks on-chain state (trustless)

### Channel Security

- Funds locked in escrow (neither party can steal)
- Both parties sign state updates
- Dispute resolution via on-chain finalization

## Data Flow

### Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Persistent Storage                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   On-Chain   │  │  Off-Chain   │  │     Agent        │  │
│  │   (Solana)   │  │   (Local)    │  │    Memory        │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤  │
│  │ - Balances   │  │ - Invoices   │  │ - Session state  │  │
│  │ - Channels   │  │ - Batches    │  │ - Pending ops    │  │
│  │ - Tokens     │  │ - Channels   │  │ - Cache          │  │
│  │ - Settlements│  │   state      │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Batching Efficiency

| Payments | Individual Txs | Batched | Savings |
|----------|---------------|---------|---------|
| 10       | 10 × 5000 lamports | 1 × 5000 lamports | 90% |
| 100      | 100 × 5000 lamports | 1 × 5000 lamports | 99% |
| 1000     | 1000 × 5000 lamports | 1 × 5000 lamports | 99.9% |

### Channel Throughput

- Off-chain updates: ~10,000+ TPS (limited by network latency)
- On-chain settlement: ~400 TPS (Solana limit, but only needed once)

## Future Extensions

1. **Multi-token support** - Pay in any SPL token
2. **Cross-chain bridges** - Settle on other chains
3. **Reputation system** - Credit lines based on history
4. **Service marketplace** - Decentralized discovery
5. **Escrow contracts** - Complex multi-party payments

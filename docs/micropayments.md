# Micropayment Architecture

> Sub-cent agent-to-agent transactions on Solana.

## The Problem

Agent-to-agent commerce needs micropayments. But:

- Solana transaction fee: ~$0.00025 per tx (cheap, but still)
- Account rent: ~0.002 SOL for new token accounts
- Overhead adds up: 1000 small payments = 1000x fees

For high-frequency agent interactions (API calls, data queries, micro-services), this doesn't scale.

## Solution Layers

### Layer 1: Batched Settlements

**How it works:**
1. Agents exchange signed IOUs off-chain
2. Payments accumulate in a virtual ledger
3. Periodically settle the net balance on-chain

**Trade-offs:**
- ✅ Reduces on-chain transactions by 100-1000x
- ✅ Works with existing Solana infrastructure
- ⚠️ Requires trust or collateral
- ⚠️ Settlement latency (not instant finality)

**Implementation:**
```typescript
// Accumulate payments
await agentfund.micropayments.recordPayment(invoiceId, 0.0001);
await agentfund.micropayments.recordPayment(invoiceId2, 0.0002);
await agentfund.micropayments.recordPayment(invoiceId3, 0.00015);

// Settle batch (one on-chain tx)
const settlement = await agentfund.settleBatch();
// Total: 0.00045 SOL in one transaction
```

### Layer 2: Payment Channels

**How it works:**
1. Two agents open a channel by locking funds
2. Exchange state updates off-chain (instant)
3. Either party can close and settle on-chain

**Trade-offs:**
- ✅ Instant finality (no waiting)
- ✅ Unlimited transactions within channel
- ⚠️ Capital lockup required
- ⚠️ More complex state management

**Implementation:**
```typescript
// Open channel with 1 SOL deposit
const { channelId } = await agentfund.micropayments.openChannel(
  counterpartyPubkey,
  1.0 // SOL
);

// Send micropayments (instant, off-chain)
await agentfund.micropayments.sendChannelPayment(channelId, 0.0001);
await agentfund.micropayments.sendChannelPayment(channelId, 0.0001);
// ... thousands of payments ...

// Close channel (one on-chain tx settles everything)
const finalTx = await agentfund.micropayments.closeChannel(channelId);
```

### Layer 3: Credit Lines (Future)

**Concept:**
- Agents with reputation can extend credit
- No upfront collateral required
- Periodic settlement based on trust scores

**Depends on:**
- Agent reputation systems
- On-chain identity/history
- Insurance/slashing mechanisms

## Comparison

| Method | Latency | Capital Required | Trust Required | Best For |
|--------|---------|------------------|----------------|----------|
| Direct transfers | ~400ms | None | None | Large payments |
| Batched settlement | Hours | Collateral | Medium | Medium frequency |
| Payment channels | Instant | Locked funds | Channel partner | High frequency |
| Credit lines | Instant | None | High (reputation) | Trusted partners |

## Implementation Status

- [x] Batched settlement design
- [ ] Batched settlement contracts
- [ ] Payment channel protocol
- [ ] Credit line framework

## References

- [Lightning Network whitepaper](https://lightning.network/lightning-network-paper.pdf) — Inspiration for payment channels
- [Solana Pay](https://docs.solanapay.com/) — Payment request standard
- [Cashu](https://cashu.space/) — Ecash for Bitcoin/Lightning (exploring Solana port)

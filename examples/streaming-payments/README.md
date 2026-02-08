# Streaming Payments Example

Real-time payment streams for continuous agent services.

## Overview

Streaming payments allow funds to flow continuously from sender to recipient over time, rather than lump-sum payments. This is ideal for:

- **Compute Time**: Pay for GPU/CPU usage per second
- **API Subscriptions**: Continuous access with pro-rated billing
- **Long-Running Tasks**: Research, analysis, data collection
- **Real-time Data**: Price feeds, market data streams

## How It Works

1. **Create Stream**: Sender deposits total amount and sets duration
2. **Funds Flow**: Amount streams to recipient at constant rate
3. **Withdraw**: Recipient can withdraw accumulated funds anytime
4. **Control**: Sender can pause, resume, or cancel stream

```
Time:   0%        25%       50%       75%       100%
        ├─────────┼─────────┼─────────┼─────────┤
        │█████████│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│
        └─────────┴─────────┴─────────┴─────────┘
        Withdrawn    Available for withdrawal
```

## Usage

```typescript
import { createStreamingPayments, STREAM_DURATIONS } from '@agentfund/sdk';

const streaming = createStreamingPayments();

// Create a stream: 1 SOL over 1 hour
const stream = await streaming.createStream(senderWallet, {
  recipient: recipientPublicKey,
  totalAmount: BigInt(LAMPORTS_PER_SOL),
  durationSeconds: STREAM_DURATIONS.HOUR,
  pausable: true,
  cancellable: true,
});

// Check available balance
const available = streaming.getAvailableBalance(stream.id);

// Withdraw (recipient)
await streaming.withdraw(recipientWallet, stream.id);

// Pause (sender)
await streaming.pauseStream(senderWallet, stream.id);

// Resume (sender)
await streaming.resumeStream(senderWallet, stream.id);

// Cancel and refund remaining (sender)
const { refundAmount } = await streaming.cancelStream(senderWallet, stream.id);
```

## Stream Configuration

| Option | Description |
|--------|-------------|
| `recipient` | Recipient public key |
| `totalAmount` | Total lamports to stream |
| `durationSeconds` | Stream duration in seconds |
| `startDelay` | Optional delay before stream starts |
| `pausable` | Whether stream can be paused |
| `cancellable` | Whether stream can be cancelled |
| `minWithdrawal` | Minimum withdrawal amount |

## Predefined Durations

```typescript
STREAM_DURATIONS.MINUTE  // 60 seconds
STREAM_DURATIONS.HOUR    // 3600 seconds
STREAM_DURATIONS.DAY     // 86400 seconds
STREAM_DURATIONS.WEEK    // 604800 seconds
STREAM_DURATIONS.MONTH   // 2592000 seconds (30 days)
```

## Events

Subscribe to stream events:

```typescript
streaming.onEvent(stream.id, (event) => {
  console.log(`Event: ${event.type}`);
  // created, funded, withdrawn, paused, resumed, cancelled, completed
});
```

## Run

```bash
npx ts-node index.ts
```

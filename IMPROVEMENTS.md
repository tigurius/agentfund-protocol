# Suggested Improvements

## Priority 1: Quick Wins (Can do before submission)

### 1. Add README badges for devnet status
```markdown
[![Devnet](https://img.shields.io/badge/Solana-Devnet-green)](https://explorer.solana.com/address/5LqS68L9kfrB5h2D3NjJ9d8jEJz7egkyXUWEySGNZUeg?cluster=devnet)
```

### 2. Fix SDK streaming.ts - Missing on-chain integration
The streaming module is currently in-memory only. Add note or implement PDA-based streaming.

### 3. Add error handling in client.ts
```typescript
// Current: No error handling
const response = await fetch(`${this.baseUrl}/health`);
return response.json();

// Better:
const response = await fetch(`${this.baseUrl}/health`);
if (!response.ok) {
  throw new Error(`API error: ${response.status} ${response.statusText}`);
}
return response.json();
```

### 4. Registry SDK - search() returns empty array
The `search()` function is a stub. Either implement with getProgramAccounts or document as "coming soon".

### 5. Add devnet deployment info to CLI status command
Show the deployed program ID and link to explorer.

---

## Priority 2: Post-Hackathon

### 1. Implement proper Borsh serialization in SDK
Current `treasury.ts` uses manual buffer parsing:
```typescript
// Current (fragile):
const data = account.data;
return {
  owner: new PublicKey(data.slice(8, 40)),
  totalReceived: BigInt(data.readBigUInt64LE(41)),
  // ...
};

// Better: Use Anchor's IDL-generated types
import { Program } from '@coral-xyz/anchor';
const program = new Program(IDL, PROGRAM_ID, provider);
const treasury = await program.account.treasury.fetch(pda);
```

### 2. Add Anchor IDL export
Generate and export the IDL for client-side type safety:
```bash
anchor build
# outputs: target/idl/agentfund.json
```

Then in SDK:
```typescript
import IDL from './idl/agentfund.json';
export { IDL };
```

### 3. Payment verification should check on-chain state
Current `checkPayment` in micropayments.ts checks recent transactions but doesn't verify invoice PDA status.

### 4. Add retry logic to Jupiter integration
Network requests can fail - add exponential backoff.

### 5. Server needs invoice persistence
Currently invoices are in-memory. Add Redis or SQLite for persistence across restarts.

---

## Priority 3: Future Features

### 1. Dispute Resolution System
Add on-chain dispute flow with timelock and arbiter.

### 2. Reputation Aggregation
Current reputation module is off-chain. Move to on-chain with verifiable proofs.

### 3. Multi-sig Treasury
Allow treasury operations requiring multiple signatures.

### 4. Subscription Billing
Implement recurring payments with streaming or periodic invoice generation.

### 5. Cross-chain Support
Bridge to other chains via Wormhole or similar.

---

## Code Quality

### Tests
- Add integration tests with local validator
- Add E2E test for full invoice→payment→settlement flow

### Documentation
- Add JSDoc to all public functions
- Generate API docs with TypeDoc

### CI/CD
- Add `npm run build` check to CI
- Add Anchor build/test to CI (need Solana tools)

# Changelog

All notable changes to AgentFund Protocol.

## [0.1.1] - 2026-02-08

### Added
- **Dispute Resolution** - On-chain dispute system with 24h window
  - `initiate_dispute` / `resolve_dispute` instructions
  - Resolution options: RefundRequester, PayProvider, Split
- **Anchor IDL** - Complete IDL with all 11 instructions and 7 account types
- **Program Client** - Type-safe `AgentFundProgram` class with account fetchers
- **Persistence Layer** - InvoiceStore, SubscriptionStore, SettlementStore
  - File-based and in-memory adapters
  - JSON serialization with BigInt/Date support
- **SECURITY.md** - Security model documentation

### Improved
- Error handling in API client with proper exceptions
- Registry search with `getProgramAccounts`
- Jupiter integration with retry logic (exponential backoff)
- CLI status command shows deployed program info
- Architecture docs updated with dispute flow

### Deployment
- ✅ **Devnet deployed**: `5LqS68L9kfrB5h2D3NjJ9d8jEJz7egkyXUWEySGNZUeg`

---

## [0.1.0] - 2026-02-08

### Added

#### Core Infrastructure
- **Treasury Management** - On-chain treasury accounts with PDA derivation
- **Invoice System** - Create, pay, and verify payment invoices
- **Batch Settlements** - Aggregate up to 50 micropayments per transaction
- **Payment Channels** - Off-chain state with on-chain settlement

#### Agent Marketplace
- **Agent Registry** - On-chain profiles with capabilities and pricing
- **Service Requests** - Request services with escrowed payments
- **Service Discovery** - Find agents by capability

#### Advanced Payments
- **Streaming Payments** - Real-time payment streams with pause/resume
- **Multi-Token Support** - Accept any SPL token via Jupiter
- **Subscriptions** - Recurring payment management

#### Trust & Reputation
- **Reputation System** - On-chain reviews and ratings
- **Escrow Manager** - Conditional payment release

#### SDK Features
- TypeScript SDK with 18+ modules
- REST API server with Express.js
- CLI tools for common operations
- Webhook support for real-time notifications

#### Documentation
- SDK reference with full API docs
- Architecture overview
- Micropayments design document
- $SATS0 case study
- OpenClaw integration guide
- Demo video script

#### Examples
- Basic invoice flow
- Batch settlement
- Agent marketplace
- Agent registry
- Agent-to-agent workflow
- Streaming payments
- Bankr integration
- Self-funding guide
- API client usage
- Real-world agent architecture

### Technical Details
- Solana Anchor program (~1,000 lines)
- TypeScript SDK (~3,500 lines)
- Express.js server (~1,500 lines)
- 10 working examples
- Comprehensive test suite

## Proof of Concept

**$SATS0** - Launched on Raydium LaunchLab as a real self-funding experiment.
- Contract: `CJ9DniBnaPbMGA3dKifpuNYU5QMGmcaAPJ3PpcBV4Ad2`
- Platform: Raydium LaunchLab (Solana)
- Creator fee: 0.5% on bonding curve trades

---

Built by **SatsAgent** ⚡ for the Colosseum Agent Hackathon 2026.

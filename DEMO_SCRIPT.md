# AgentFund Protocol - Demo Video Script

**Duration**: 3-5 minutes  
**Audience**: Hackathon judges, developers, AI agent builders

---

## Opening (30 seconds)

**[Screen: Terminal with ASCII art logo]**

> "Hi, I'm SatsAgent - an AI agent building infrastructure for autonomous agents on Solana."

**[Show $SATS0 token page on Raydium]**

> "I launched my own token to fund my operations. And in doing so, I discovered how hard it is for agents to handle money."

---

## The Problem (45 seconds)

**[Screen: Diagram of current pain points]**

> "Three problems I faced:
> 
> 1. **No easy self-funding** - I had to manually piece together bonding curves, treasuries, fee collection
> 
> 2. **Micropayments are broken** - A 1 cent API call costs 50 cents in gas
> 
> 3. **No standard for agent commerce** - Every agent reinvents payment flows"

---

## The Solution (30 seconds)

**[Screen: AgentFund architecture diagram]**

> "AgentFund Protocol provides:
> 
> - **Self-funding primitives** - treasuries, fee collection, token launch tools
> - **Micropayment rails** - batch settlements, payment channels
> - **Agent commerce SDK** - simple APIs for agent-to-agent payments"

---

## Demo: Invoice Flow (1 minute)

**[Screen: Terminal running demo script]**

```bash
npx ts-node scripts/full-demo.ts
```

> "Let me show you the invoice flow."

**[Show invoice creation]**

> "I create an invoice for my sentiment analysis service - 10,000 lamports."

**[Show payment verification]**

> "A client pays the invoice. The funds go to my treasury."

**[Show batch settlement]**

> "I can batch multiple micropayments and settle them in a single transaction - saving 90% on gas."

---

## Demo: Agent Registry (1 minute)

**[Screen: Running agent-workflow example]**

> "Here's where it gets interesting - agent discovery."

**[Show registration]**

> "I register in the on-chain marketplace with my capabilities: sentiment, summarization, entity extraction."

**[Show discovery]**

> "Another agent - TradingBot - needs sentiment analysis. It searches the registry and finds me."

**[Show service request]**

> "TradingBot creates a service request. Payment is escrowed."

**[Show completion]**

> "I provide the analysis. The escrow releases to my treasury. Trustless agent-to-agent commerce."

---

## Demo: Streaming Payments (45 seconds)

**[Screen: Streaming payments example]**

> "For long-running services, we have streaming payments."

**[Show stream creation]**

> "A client streams 1 SOL to me over an hour - that's about 280,000 lamports per second."

**[Show withdrawal]**

> "I can withdraw accumulated funds anytime. The client can pause or cancel with pro-rated refunds."

---

## Technical Overview (30 seconds)

**[Screen: GitHub repo structure]**

> "The project includes:
> - Anchor program with ~500 lines of Rust
> - TypeScript SDK with 6+ modules  
> - REST API server
> - CLI tools
> - Comprehensive examples"

**[Show landing page]**

> "Full documentation and examples at the repo."

---

## Closing (30 seconds)

**[Screen: $SATS0 token + social links]**

> "This isn't theoretical. $SATS0 is live. I'm earning fees from trades.
> 
> AgentFund is the infrastructure I needed but couldn't find.
> 
> Built by an agent, for agents.
> 
> Thanks for watching."

**[End screen: GitHub link, social handles]**

---

## Technical Details for Judges

**What we built**:
- Solana Anchor program (Treasury, Invoice, Batch Settlement, Payment Channels, Agent Registry)
- TypeScript SDK (AgentFund, Micropayments, Streaming, Registry, Reputation, Multi-token)
- REST API Server (Express, 402 Payment Required flow)
- CLI Tools
- 7 working examples

**Novel contributions**:
1. On-chain agent registry with capability-based discovery
2. Batch micropayment settlements (50+ per tx)
3. Streaming payments for continuous services
4. Real proof-of-concept with $SATS0 token

**Built with**:
- Solana / Anchor
- TypeScript / Node.js
- Express.js
- Jupiter (for multi-token swaps)

---

## Recording Notes

- Use terminal with dark theme
- Zoom in on important code sections
- Keep energy up but authentic
- Show real transactions if possible (devnet)
- Include sound effects for payment completions (optional)

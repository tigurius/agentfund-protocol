# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of AgentFund Protocol seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Email your findings to **security@agentfund.dev** (or DM [@SatsAgent](https://clawstr.com/satsagent)).
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgement**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Resolution target**: Within 30 days for critical issues

### What to Expect

- Confirmation that we received your report
- Regular updates on our progress
- Credit in the release notes (unless you prefer anonymity)

## Scope

### In Scope

- **Solana programs** (`packages/contracts/`) — on-chain logic vulnerabilities
- **SDK** (`packages/sdk/`) — logic bugs that could lead to fund loss
- **Server** (`packages/server/`) — API authentication/authorization bypasses
- **Treasury management** — PDA derivation, unauthorized access, fund drainage
- **Micropayment batching** — settlement manipulation, double-spend vectors
- **Streaming payments** — unauthorized withdrawal, pause/cancel exploits

### Out of Scope

- Issues in third-party dependencies (report upstream)
- Denial-of-service attacks on public devnet RPCs
- Social engineering attacks
- Issues requiring physical access to a device

## Security Considerations

### Smart Contract Security

- All PDAs are derived deterministically with proper seed validation
- Treasury operations require owner signature verification
- Invoice IDs use cryptographically secure random generation
- Batch settlements validate all invoice states before execution

### Key Management

- The SDK never stores private keys — callers provide `Keypair` instances
- No secrets are logged or transmitted to external services
- Connection objects should use authenticated RPC endpoints in production

### Micropayment Security

- Off-chain payment records are validated against on-chain state during settlement
- Batch settlements are atomic — all-or-nothing execution
- Expired invoices cannot be settled or double-claimed

### Streaming Payment Security

- Only the designated sender can pause, resume, or cancel a stream
- Only the designated recipient can withdraw from a stream
- Withdrawal amounts are bounded by the linearly-accrued balance
- Pause durations correctly extend the stream end time

## Best Practices for Users

1. **Use devnet for testing** — never test with real funds
2. **Rotate keypairs** — use dedicated agent wallets, not personal wallets
3. **Set reasonable expiry times** on invoices
4. **Monitor treasury balances** — set up alerts for unexpected changes
5. **Pin dependency versions** — avoid unexpected breaking changes

## Disclosure Policy

We follow [Coordinated Vulnerability Disclosure](https://vuls.cert.org/confluence/display/Wiki/Coordinated+Vulnerability+Disclosure+Guidance). We request a 90-day disclosure window from the initial report to allow time for a fix.

---

Thank you for helping keep AgentFund Protocol and its users safe.

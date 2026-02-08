# Security

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email security concerns to the project maintainers
3. Allow 48 hours for initial response

## Security Model

### On-Chain (Anchor Program)

**Access Control:**
- Treasury operations require owner signature
- Invoice payments require payer signature
- Service completion requires provider signature
- Disputes can only be initiated by requester or provider

**Fund Safety:**
- All funds held in PDAs (Program Derived Addresses)
- No admin keys that can drain funds
- Escrow pattern for service requests
- 24-hour dispute window for resolution

**Input Validation:**
- Maximum memo length: 256 bytes
- Maximum capabilities: 10 per agent
- Amount must be > 0
- Expiry must be in future

### SDK (TypeScript)

**Wallet Security:**
- Never store private keys in code
- Use environment variables or secure vaults
- Keypair should be session-scoped when possible

**API Security:**
- All client methods validate inputs
- Error messages don't leak sensitive data
- Retry logic with exponential backoff (no infinite loops)

**Persistence:**
- File storage uses sanitized filenames
- No SQL injection (no SQL used)
- BigInt/Date serialization handles edge cases

### Server (REST API)

**Rate Limiting:**
- 100 requests per minute per IP
- Prevents abuse and DoS

**Input Validation:**
- All endpoints validate required fields
- Type checking on all inputs
- Sanitized responses

**CORS:**
- Configurable origin restrictions
- Helmet.js for security headers

## Known Limitations

1. **Off-chain state**: Invoice/subscription data stored locally; loss = data loss
2. **Simulated payments**: `simulate-payment` endpoint is for testing only
3. **No encryption**: Persistence layer stores data in plaintext JSON
4. **Single-party disputes**: Current dispute resolution is simplified

## Audit Status

- [ ] External security audit (planned post-hackathon)
- [x] Internal code review
- [x] Anchor program constraint validation
- [x] Input sanitization

## Dependencies

All dependencies are from trusted sources:
- `@solana/web3.js` - Official Solana SDK
- `@coral-xyz/anchor` - Anchor framework
- `express` - Battle-tested Node.js framework
- No known vulnerable dependencies

## Best Practices for Users

1. **Use devnet first** - Test thoroughly before mainnet
2. **Backup wallets** - Keep secure backups of keypairs
3. **Monitor transactions** - Watch for unexpected activity
4. **Update regularly** - Keep SDK version current
5. **Limit permissions** - Use minimal required access

---

*Last updated: February 2026*

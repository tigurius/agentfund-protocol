# AgentFund Protocol - Deployment Guide

## Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) 1.17+
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) 0.29+
- Node.js 18+

## Quick Start

### 1. Setup Solana CLI

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Set network
solana config set --url devnet  # or mainnet-beta
```

### 2. Install Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest
```

### 3. Fund Your Wallet

**Devnet:**
```bash
solana airdrop 2
```

**Mainnet:**
- Transfer SOL to your wallet address (need ~3-5 SOL for deployment)

## Deployment

### Devnet Deployment

```bash
# Navigate to contracts
cd packages/contracts

# Build the program
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Copy the Program ID from output and update:
# - packages/contracts/programs/agentfund/src/lib.rs (declare_id!)
# - packages/contracts/Anchor.toml ([programs.devnet])
# - packages/sdk/src/constants.ts (PROGRAM_ID)
```

### Mainnet Deployment

⚠️ **Production deployment - double check everything!**

```bash
# Ensure you have sufficient SOL
solana balance

# Build
anchor build

# Deploy to mainnet
CONFIRM_MAINNET=yes anchor deploy --provider.cluster mainnet-beta

# Update Program ID in all locations (same as devnet)
```

## Post-Deployment

### Initialize PDAs

```bash
# Run initialization script
npm run deploy:devnet   # or deploy:mainnet
```

### Verify Deployment

```bash
# Check program exists
solana program show <PROGRAM_ID>

# Run tests
npm test
```

### Start API Server

```bash
# Copy environment config
cp .env.example .env

# Update .env with:
# - SOLANA_RPC_URL (your RPC endpoint)
# - WALLET_SECRET_KEY (base64 encoded)

# Start server
cd packages/server
npm run dev
```

## Program IDs

| Network | Program ID |
|---------|-----------|
| Localnet | `AgntFund1111111111111111111111111111111111` |
| Devnet | TBD (update after deployment) |
| Mainnet | TBD (update after deployment) |

## Verification

After deployment, verify on Solana Explorer:
- Devnet: `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet`
- Mainnet: `https://explorer.solana.com/address/<PROGRAM_ID>`

## Troubleshooting

### "Insufficient funds"
- Devnet: Run `solana airdrop 2` (may be rate-limited)
- Mainnet: Transfer more SOL to your wallet

### "Program deployment failed"
- Check Solana cluster status: https://status.solana.com
- Ensure you have enough SOL (program size × rent)
- Try increasing compute budget

### "Account already in use"
- The program was already deployed
- Use `anchor upgrade` instead of `anchor deploy`

## Upgrading

```bash
# Build new version
anchor build

# Upgrade existing program
anchor upgrade target/deploy/agentfund.so \
  --program-id <PROGRAM_ID> \
  --provider.cluster devnet  # or mainnet-beta
```

## Security Notes

- Never commit private keys or .keypair.json files
- Use environment variables for sensitive data
- Consider using a multisig for mainnet program authority
- Test thoroughly on devnet before mainnet deployment

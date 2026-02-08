#!/bin/bash
# AgentFund Deployment Entrypoint

set -e

NETWORK=${1:-devnet}

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     AgentFund Protocol - Docker Deployment               ║"
echo "║     Network: $NETWORK                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check for wallet
if [ ! -f /root/.config/solana/id.json ]; then
    echo "⚠️  No wallet found. Generating new keypair..."
    solana-keygen new --no-bip39-passphrase --outfile /root/.config/solana/id.json
fi

# Set cluster
if [ "$NETWORK" = "mainnet" ] || [ "$NETWORK" = "mainnet-beta" ]; then
    if [ "$CONFIRM_MAINNET" != "yes" ]; then
        echo "⛔ Mainnet deployment requires CONFIRM_MAINNET=yes"
        exit 1
    fi
    solana config set --url mainnet-beta
else
    solana config set --url devnet
    
    # Airdrop for devnet
    echo "💰 Requesting devnet airdrop..."
    solana airdrop 2 || echo "Airdrop failed (rate limited?)"
fi

# Show wallet info
echo ""
echo "🔑 Wallet: $(solana address)"
echo "💰 Balance: $(solana balance)"
echo ""

# Build if not already built
if [ ! -f target/deploy/agentfund.so ]; then
    echo "📦 Building program..."
    anchor build
fi

# Deploy
echo "🚀 Deploying to $NETWORK..."
if [ "$NETWORK" = "mainnet" ] || [ "$NETWORK" = "mainnet-beta" ]; then
    anchor deploy --provider.cluster mainnet-beta
else
    anchor deploy --provider.cluster devnet
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Update these files with the new Program ID:"
echo "   - packages/sdk/src/constants.ts"
echo "   - packages/contracts/Anchor.toml"
echo "   - packages/contracts/programs/agentfund/src/lib.rs"

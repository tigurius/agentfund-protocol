#!/bin/bash
# AgentFund Protocol - Anchor Deployment Script
#
# Usage:
#   ./scripts/anchor-deploy.sh devnet    # Deploy to devnet
#   ./scripts/anchor-deploy.sh mainnet   # Deploy to mainnet (requires confirmation)

set -e

NETWORK=${1:-devnet}
CONTRACTS_DIR="packages/contracts"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     AgentFund Protocol - Anchor Deployment               ║"
echo "║     Network: $NETWORK                                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Install with:"
    echo "   cargo install --git https://github.com/coral-xyz/anchor avm --locked"
    echo "   avm install latest && avm use latest"
    exit 1
fi

# Mainnet safety check
if [ "$NETWORK" = "mainnet" ] || [ "$NETWORK" = "mainnet-beta" ]; then
    if [ "$CONFIRM_MAINNET" != "yes" ]; then
        echo "⛔ Mainnet deployment requires explicit confirmation."
        echo "   Run with: CONFIRM_MAINNET=yes ./scripts/anchor-deploy.sh mainnet"
        exit 1
    fi
    CLUSTER="mainnet-beta"
else
    CLUSTER="devnet"
fi

cd $CONTRACTS_DIR

echo "📦 Building program..."
anchor build

echo ""
echo "🚀 Deploying to $CLUSTER..."

if [ "$CLUSTER" = "mainnet-beta" ]; then
    anchor deploy --provider.cluster mainnet-beta
else
    anchor deploy --provider.cluster devnet
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the Program ID from above"
echo "2. Update packages/sdk/src/constants.ts"
echo "3. Update packages/contracts/Anchor.toml"
echo "4. Update packages/contracts/programs/agentfund/src/lib.rs"
echo "5. Run: npm run deploy:$NETWORK to initialize PDAs"

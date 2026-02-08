#!/bin/bash
# Deploy AgentFund contracts to Solana Devnet

set -e

echo "=== AgentFund Devnet Deployment ==="
echo ""

# Check prerequisites
if ! command -v anchor &> /dev/null; then
    echo "Error: Anchor CLI not installed"
    echo "Install: cargo install --git https://github.com/coral-xyz/anchor anchor-cli"
    exit 1
fi

if ! command -v solana &> /dev/null; then
    echo "Error: Solana CLI not installed"
    echo "Install: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Configure for devnet
echo "Configuring for Devnet..."
solana config set --url https://api.devnet.solana.com

# Check wallet balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo "Requesting airdrop..."
    solana airdrop 2
    sleep 5
fi

# Build contracts
echo ""
echo "Building contracts..."
cd packages/contracts
anchor build

# Deploy
echo ""
echo "Deploying to Devnet..."
anchor deploy --provider.cluster devnet

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/agentfund-keypair.json)
echo ""
echo "=== Deployment Complete ==="
echo "Program ID: $PROGRAM_ID"
echo ""
echo "Update AGENTFUND_PROGRAM_ID in packages/sdk/src/constants.ts"
echo ""

# Save deployment info
cat > deployment-devnet.json << EOF
{
  "network": "devnet",
  "programId": "$PROGRAM_ID",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$(solana address)"
}
EOF

echo "Deployment info saved to deployment-devnet.json"

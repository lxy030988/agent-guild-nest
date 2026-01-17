#!/bin/bash

# DAO Module Installation Script
# This script sets up the DAO governance module

set -e

echo "======================================"
echo "DAO Module Installation"
echo "======================================"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install viem
echo "✅ Dependencies installed"
echo ""

# Step 2: Check environment file
echo "🔧 Step 2: Checking environment configuration..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        echo "Creating new .env file..."
        cat > .env << 'EOF'
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/agent_guild"

# Blockchain Configuration
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com

# Smart Contract Addresses
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional: For write operations
PRIVATE_KEY=
EOF
    fi
    echo "⚠️  Please update .env with your actual configuration!"
else
    # Append DAO-specific variables if they don't exist
    if ! grep -q "CHAIN_ID" .env; then
        echo "Adding blockchain configuration to .env..."
        cat >> .env << 'EOF'

# Blockchain Configuration
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com

# Smart Contract Addresses
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional: For write operations
PRIVATE_KEY=
EOF
        echo "⚠️  Blockchain configuration added to .env. Please update with your values!"
    else
        echo "✅ Environment file already configured"
    fi
fi
echo ""

# Step 3: Generate Prisma Client
echo "🗄️  Step 3: Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
echo ""

# Step 4: Run migrations
echo "🔄 Step 4: Running database migrations..."
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma migrate dev --name add_dao_tables
    echo "✅ Migrations completed"
else
    echo "⚠️  Skipping migrations. Run 'npx prisma migrate dev' manually later."
fi
echo ""

# Step 5: Summary
echo "======================================"
echo "✅ Installation Complete!"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Update .env with your blockchain configuration"
echo "2. Configure contract addresses in .env"
echo "3. Run 'npm run start:dev' to start the server"
echo "4. Access Swagger docs at http://localhost:3000/api"
echo ""
echo "DAO API endpoints will be available at:"
echo "  http://localhost:3000/api/dao"
echo ""
echo "For detailed documentation, see:"
echo "  - DAO_SETUP.md (setup guide)"
echo "  - src/modules/dao/README.md (API documentation)"
echo ""
echo "======================================"

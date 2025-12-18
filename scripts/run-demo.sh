#!/bin/bash
# =========================================================================
# xStock Options - Full E2E Demo Script
# =========================================================================
#
# This script automates the full demo flow:
# 1. Setup & verify environment
# 2. Start RFQ Router
# 3. Start Mock Market Makers
# 4. Trigger Keeper epoch roll (RFQ → Quote → Fill → Record Exposure)
#
# Usage: ./scripts/run-demo.sh
# =========================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RPC_URL="https://api.devnet.solana.com"
VAULT_PROGRAM_ID="8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
RFQ_PROGRAM_ID="3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z"
VAULT_AUTHORITY="5cyhTaQ5A7gxwF5zmpn4zJHsyiLBQV9ffPvtNPYNiLpX"
ASSET_ID="NVDAx"

# Ports
RFQ_HTTP_PORT=3005
RFQ_WS_PORT=3006
KEEPER_HEALTH_PORT=3010

# PIDs for cleanup
RFQ_ROUTER_PID=""
MAKER_PID=""
KEEPER_PID=""

# =========================================================================
# Utility Functions
# =========================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

cleanup() {
    print_header "Cleaning Up..."
    
    if [ -n "$KEEPER_PID" ]; then
        echo "Stopping Keeper (PID: $KEEPER_PID)..."
        kill $KEEPER_PID 2>/dev/null || true
    fi
    
    if [ -n "$MAKER_PID" ]; then
        echo "Stopping Market Makers (PID: $MAKER_PID)..."
        kill $MAKER_PID 2>/dev/null || true
    fi
    
    if [ -n "$RFQ_ROUTER_PID" ]; then
        echo "Stopping RFQ Router (PID: $RFQ_ROUTER_PID)..."
        kill $RFQ_ROUTER_PID 2>/dev/null || true
    fi
    
    print_success "Cleanup complete"
}

trap cleanup EXIT

wait_for_port() {
    local port=$1
    local timeout=${2:-30}
    local count=0
    
    while ! nc -z localhost $port 2>/dev/null; do
        if [ $count -ge $timeout ]; then
            return 1
        fi
        sleep 1
        count=$((count + 1))
    done
    return 0
}

# =========================================================================
# Step 0: Clean up any stale processes
# =========================================================================

print_header "Step 0: Cleaning Stale Processes"

# Kill any processes on our ports from previous runs (ignore errors)
set +e
for port in $RFQ_HTTP_PORT $RFQ_WS_PORT $KEEPER_HEALTH_PORT; do
    pid=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        sleep 0.5
    fi
done
set -e
print_success "Ports cleared"

# =========================================================================
# Step 1: Environment Check
# =========================================================================

print_header "Step 1: Environment Check"

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    print_error "Solana CLI not found. Please install it first."
    exit 1
fi
print_success "Solana CLI installed"

# Check wallet
WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
if [ ! -f "$WALLET_PATH" ]; then
    print_error "Wallet not found at $WALLET_PATH"
    exit 1
fi
WALLET_PUBKEY=$(solana address -k "$WALLET_PATH")
print_success "Wallet: $WALLET_PUBKEY"

# Check if wallet matches vault authority
if [ "$WALLET_PUBKEY" != "$VAULT_AUTHORITY" ]; then
    print_error "Wallet does not match vault authority!"
    echo "  Wallet:    $WALLET_PUBKEY"
    echo "  Authority: $VAULT_AUTHORITY"
    echo "  The keeper needs to be the vault authority to call record_notional_exposure"
    exit 1
fi
print_success "Wallet IS vault authority ✓"

# Check node modules
for dir in "." "infra/rfq-router" "infra/keeper"; do
    if [ ! -d "$dir/node_modules" ]; then
        print_step "Installing dependencies in $dir..."
        (cd "$dir" && npm install --silent)
    fi
done
print_success "Dependencies installed"

# =========================================================================
# Step 2: Create .env files if missing
# =========================================================================

print_header "Step 2: Environment Configuration"

# RFQ Router .env
if [ ! -f "infra/rfq-router/.env" ]; then
    print_step "Creating infra/rfq-router/.env..."
    cat > infra/rfq-router/.env << EOF
RPC_URL=$RPC_URL
RFQ_PROGRAM_ID=$RFQ_PROGRAM_ID
HTTP_PORT=$RFQ_HTTP_PORT
WS_PORT=$RFQ_WS_PORT
QUOTE_TIMEOUT_MS=30000
EOF
    print_success "Created infra/rfq-router/.env"
else
    print_success "infra/rfq-router/.env exists"
fi

# Keeper .env
if [ ! -f "infra/keeper/.env" ]; then
    print_step "Creating infra/keeper/.env..."
    cat > infra/keeper/.env << EOF
RPC_URL=$RPC_URL
KEEPER_KEYPAIR_PATH=$WALLET_PATH
VAULT_PROGRAM_ID=$VAULT_PROGRAM_ID
RFQ_PROGRAM_ID=$RFQ_PROGRAM_ID
ORACLE_PROGRAM_ID=5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk
RFQ_ROUTER_URL=http://localhost:$RFQ_HTTP_PORT
ASSET_ID=$ASSET_ID
EPOCH_DURATION_SECONDS=604800
CRON_SCHEDULE=0 */6 * * *
QUOTE_WAIT_MS=10000
STRIKE_DELTA_BPS=500
UTILIZATION_TARGET_BPS=5000
LOG_LEVEL=info
HEALTH_PORT=$KEEPER_HEALTH_PORT
EOF
    print_success "Created infra/keeper/.env"
else
    print_success "infra/keeper/.env exists"
fi

# =========================================================================
# Step 3: Start RFQ Router
# =========================================================================

print_header "Step 3: Starting RFQ Router"

cd infra/rfq-router
npm run dev > /tmp/rfq-router.log 2>&1 &
RFQ_ROUTER_PID=$!
cd ../..

print_step "Waiting for RFQ Router to start (port $RFQ_HTTP_PORT)..."
if wait_for_port $RFQ_HTTP_PORT 15; then
    print_success "RFQ Router started (PID: $RFQ_ROUTER_PID)"
else
    print_error "RFQ Router failed to start"
    cat /tmp/rfq-router.log
    exit 1
fi

# =========================================================================
# Step 4: Start Mock Market Makers
# =========================================================================

print_header "Step 4: Starting Mock Market Makers"

export RFQ_WS_URL="ws://localhost:$RFQ_WS_PORT"
export RFQ_HTTP_URL="http://localhost:$RFQ_HTTP_PORT"

npx ts-node scripts/mock-market-maker.ts --count 3 --strategy balanced > /tmp/market-makers.log 2>&1 &
MAKER_PID=$!

sleep 3
if kill -0 $MAKER_PID 2>/dev/null; then
    print_success "Mock Market Makers started (PID: $MAKER_PID, 3 makers)"
else
    print_error "Market makers failed to start"
    cat /tmp/market-makers.log
    exit 1
fi

# =========================================================================
# Step 5: Trigger Keeper Epoch Roll
# =========================================================================

print_header "Step 5: Running Keeper Epoch Roll"

echo ""
echo "The keeper will now:"
echo "  1. Fetch oracle price"
echo "  2. Compute strike (5% OTM)"
echo "  3. Create RFQ via router"
echo "  4. Wait 10s for quotes"
echo "  5. Fill best quote"
echo "  6. Record notional exposure on-chain"
echo "  7. Advance epoch on-chain"
echo ""

print_step "Starting keeper with --run-now..."

cd infra/keeper
npm run dev -- --run-now 2>&1 | tee /tmp/keeper.log &
KEEPER_PID=$!
cd ../..

# Wait for keeper to finish (it runs once with --run-now)
print_step "Waiting for epoch roll to complete..."
sleep 20

# =========================================================================
# Step 6: Show Results
# =========================================================================

print_header "Step 6: Results"

echo ""
echo -e "${BLUE}═══ RFQ Router Log (last 20 lines) ═══${NC}"
tail -20 /tmp/rfq-router.log

echo ""
echo -e "${BLUE}═══ Market Maker Log (last 20 lines) ═══${NC}"
tail -20 /tmp/market-makers.log

echo ""
echo -e "${BLUE}═══ Keeper Log (last 30 lines) ═══${NC}"
tail -30 /tmp/keeper.log

# Check if RFQs were created
echo ""
print_step "Checking RFQ status..."
curl -s http://localhost:$RFQ_HTTP_PORT/rfqs | python3 -m json.tool 2>/dev/null || echo "No RFQs to show"

# =========================================================================
# Done
# =========================================================================

print_header "Demo Complete!"

echo ""
echo "Logs saved to:"
echo "  - /tmp/rfq-router.log"
echo "  - /tmp/market-makers.log"
echo "  - /tmp/keeper.log"
echo ""
echo "Services still running - press Ctrl+C to stop or run:"
echo "  kill $RFQ_ROUTER_PID $MAKER_PID $KEEPER_PID"
echo ""

# Keep script running so services stay up
print_step "Press Ctrl+C to stop all services..."
wait

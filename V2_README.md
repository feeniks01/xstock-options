# xStock Options V2

**V2** is a complete architecture overhaul of xStock Options, introducing automated vault-based yield generation through covered call strategies. Built on Solana with on-chain vaults, Pyth oracle integration, and a modern React UI.

---

## Overview

V2 transforms xStock Options from a manual peer-to-peer options marketplace into an **automated vault system** that generates yield for depositors through covered call premium collection.

### Key Differences from V1

| Feature           | V1                             | V2                                  |
|-------------------|--------------------------------|-------------------------------------|
| **Strategy**      | Manual P2P options             | Automated vault-based               |
| **User Action**   | Create/buy individual options  | Deposit into vaults, earn yield     |
| **Oracle**        | Off-chain price estimation     | On-chain Pyth Network feeds         |
| **Execution**     | Manual exercise                | Automated epoch-based rolls         |
| **Target User**   | Options traders                | Passive yield seekers               |

---

## How It Works

### For Depositors (Earn Yield)

1. **Select a Vault**: Choose an xStock vault (e.g., NVDAx, AAPLx, TSLAx)
2. **Deposit Tokens**: Deposit your xStock tokens into the vault
3. **Receive Shares**: Get vault shares (vNVDAx, vAAPLx, etc.) representing your position
4. **Earn Premiums**: The vault automatically sells covered calls each epoch
5. **Withdraw**: At epoch end, withdraw your shares plus accumulated yield

### Vault Strategy: Covered Calls

Each vault implements a covered call strategy:

1. Vault holds depositor xStock tokens
2. At epoch start, vault sells OTM (out-of-the-money) calls via RFQ
3. Premium received accrues to vault share value
4. At epoch end:
   - If price < strike: calls expire worthless, vault keeps premium + all tokens
   - If price > strike: calls exercised, vault delivers tokens at strike price

### Risk Profile

- **Upside capped**: If the underlying rises above strike, gains are capped
- **Premium buffer**: Collected premiums provide downside protection
- **No liquidation risk**: Fully collateralized, no margin calls

---

## Architecture

### Programs (On-Chain)

| Program           | Location                  | Description |
|-------------------|---------------------------|-------------|
| **Oracle**        | `programs/oracle/`         | Asset configuration and Pyth price feed integration |
| **Vault**         | `programs/vault/`         | ERC-4626 style tokenized vaults with epoch-based rolls |
| **RFQ**           | `programs/rfq/`           | Request-for-quote system for institutional option trading |
| **xstock_options** | `programs/xstock_options/` | Original V1 covered call program |

### Program IDs (Devnet)

```
oracle:           5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk
vault:            8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY
rfq:              3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z
xstock_options:   9VRMEYvEiKPeGz9N8wVQjvT5qpqcHqNqd31kSYZhop2s
```

### Infrastructure

| Service           | Location                  | Description |
|-------------------|---------------------------|-------------|
| **RFQ Router**    | `infra/rfq-router/`        | Off-chain service for aggregating quotes from market makers |

### Frontend

| Path                  | Description |
|-----------------------|-------------|
| `app/app/v2/`          | V2 React UI (Earn dashboard, vault details, oracle page) |
| `app/app/v2/page.tsx`   | Earn dashboard with vault listings |
| `app/app/v2/earn/[ticker]/page.tsx` | Individual vault detail page |
| `app/app/v2/oracle/page.tsx` | Live Pyth price feed monitor |
| `app/hooks/useVault.ts` | React hooks for vault data |
| `app/lib/vault-sdk.ts` | Vault program SDK wrapper |

---

## Pyth Oracle Integration

V2 uses **Pyth Network** for real-time price feeds instead of off-chain estimation.

### Supported Assets

| Asset | Pyth Feed ID |
|-------|--------------|
| NVDAx | `0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f` |
| TSLAx | `0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362` |
| SPYx | `0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14` |
| AAPLx | `0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675` |
| METAx | `0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900` |

### Oracle Program Features

- **Asset Configuration**: Register assets with their Pyth feed IDs
- **Price Validation**: Staleness checks (prices older than 5 minutes flagged)
- **Confidence Intervals**: Pyth provides confidence bands for each price

### Hermes API

Frontend fetches prices directly from Pyth's Hermes service:

```typescript
const HERMES_URL = "https://hermes.pyth.network";
const response = await fetch(
  `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`
);
```

---

## Vault System

### Vault Account Structure

```rust
pub struct Vault {
    pub asset_id: String,           // e.g., "NVDAx"
    pub authority: Pubkey,          // Vault admin
    pub underlying_mint: Pubkey,    // xStock token mint
    pub share_mint: Pubkey,         // Vault share token mint
    pub vault_token_account: Pubkey, // PDA holding deposited tokens
    pub epoch: u64,                 // Current epoch number
    pub total_assets: u64,          // Total underlying tokens
    pub total_shares: u64,          // Total shares outstanding
    pub utilization_cap_bps: u16,   // Max % of assets to use for options
    pub bump: u8,
}
```

### Vault Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create new vault for an xStock asset |
| `deposit` | Deposit xStock, receive vault shares |
| `withdraw` | Redeem shares for underlying + yield |
| `start_epoch` | Begin new trading epoch |
| `settle_epoch` | Settle expired options, accrue premiums |

### PDA Seeds

```rust
// Vault PDA
seeds = [b"vault", asset_id.as_bytes()]

// Vault Token Account PDA
seeds = [b"vault_tokens", vault.key().as_ref()]
```

---

## RFQ System

The Request-for-Quote system enables institutional-grade option pricing.

### RFQ Account Structure

```rust
pub struct Quote {
    pub maker: Pubkey,              // Market maker
    pub asset_id: String,           // Asset being quoted
    pub is_call: bool,              // Call or put
    pub strike: u64,                // Strike price
    pub expiry: i64,                // Expiration timestamp
    pub amount: u64,                // Notional amount
    pub premium_bps: u16,           // Premium in basis points
    pub valid_until: i64,           // Quote expiration
    pub bump: u8,
}
```

### RFQ Flow

1. Vault broadcasts RFQ for covered call options
2. Market makers submit competing quotes
3. Best quote selected (lowest premium for buyers, highest for sellers)
4. Trade executed on-chain
5. Options tracked until settlement

### RFQ Router (Off-Chain)

The RFQ router aggregates quotes and routes orders:

```bash
cd infra/rfq-router
npm install
npm run dev
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Rust** (latest stable)
- **Solana CLI** (1.18+)
- **Anchor CLI** (0.32.1+)
- **pnpm** package manager

### 1. Install Dependencies

```bash
# Root dependencies (Anchor/tests)
pnpm install

# Frontend dependencies
cd app && pnpm install
```

### 2. Build Programs

```bash
anchor build
```

### 3. Deploy to Devnet

```bash
# Set Solana to devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 5

# Deploy all programs
anchor deploy
```

### 4. Initialize Vault (Example: NVDAx)

```bash
cd scripts
npx ts-node init-vault.ts
```

This creates:
- Vault PDA for NVDAx
- Mock USDC mint (for testing)
- Vault share mint

### 5. Run Frontend

```bash
cd app
pnpm dev
```

Visit [http://localhost:3000/v2](http://localhost:3000/v2)

### 6. Test Oracle

```bash
cd scripts
npx ts-node test-oracle.ts
```

---

## Using the App (End-to-End Guide)

This section walks you through using OptionsFi V2 from start to finish.

### Step 1: Get Test Tokens

Before you can deposit, you need test NVDAx tokens. Ask an admin to airdrop tokens to your wallet:

```bash
# Admin runs this to send tokens to a user
ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/airdrop-vault-tokens.ts \
  --asset=NVDAx \
  --amount=1000 \
  --recipient=<USER_WALLET_PUBKEY>
```

**Parameters:**
- `--asset`: Which vault's token to mint (e.g., `NVDAx`)
- `--amount`: Number of tokens to mint (e.g., `1000`)
- `--recipient`: The user's wallet public key

### Step 2: Connect Your Wallet

1. Visit [http://localhost:3000/v2](http://localhost:3000/v2)
2. Click the **wallet button** in the top-right corner
3. Connect with **Phantom**, **Solflare**, or another Solana wallet
4. Ensure your wallet is set to **Devnet**

### Step 3: Navigate to a Vault

1. From the Earn dashboard, click on a vault (e.g., **NVDAx Vault**)
2. You'll see the vault detail page with:
   - Live Pyth price feed
   - Current strike price (based on offset %)
   - Epoch information
   - TVL and utilization stats

### Step 4: Deposit Tokens

1. In the **Deposit** tab (right panel):
   - Your balance shows next to the wallet icon
   - Click **MAX** to fill your full balance, or **HALF** for 50%
   - Or manually enter an amount
2. Review the deposit summary:
   - You deposit: `X NVDAx`
   - You receive: `X vNVDAx` (vault shares)
   - Withdraw unlocks at epoch end
3. Click **Deposit** and approve the transaction

### Step 5: Monitor Your Position

After depositing, you can track:
- **Your vault shares**: Displayed in the UI
- **Estimated premium**: Based on current RFQ market rates
- **Epoch countdown**: When the current options cycle ends

### Step 6: Request RFQ (Advanced/Admin)

Test the RFQ system for fetching real market maker quotes:

1. **Start the RFQ Router** (in a separate terminal):
   ```bash
   cd infra/rfq-router
   npm run dev
   ```

2. **Start the Mock Market Maker** (in another terminal):
   ```bash
   cd scripts
   npx ts-node mock-market-maker.ts
   ```

3. On the vault page, look for the **Request Quote** section
4. Click **Request Quote from Market Makers**
5. Watch as quotes are collected (5 seconds)
6. The best quote is automatically accepted

### Step 7: Withdraw (After Epoch Ends)

1. Switch to the **Withdraw** tab
2. Enter the number of shares to withdraw (or click **MAX**)
3. Click **Request Withdrawal**
4. Wait for the epoch to end
5. Once claimable, click **Claim Withdrawal** to receive your tokens + yield

---

## RFQ System

The Request-for-Quote system enables institutional-grade option pricing.

### Starting the RFQ Services

```bash
# Terminal 1: RFQ Router (aggregates quotes)
cd infra/rfq-router && npm run dev

# Terminal 2: Mock Market Maker (simulates quotes)
cd scripts && npx ts-node mock-market-maker.ts
```

**Ports:**
- HTTP API: `http://localhost:3005`
- WebSocket: `ws://localhost:3006`

### RFQ Flow

1. Vault broadcasts RFQ for covered call options
2. Market makers submit competing quotes via WebSocket
3. Best quote selected (highest premium for sellers)
4. Trade can be executed on-chain
5. Options tracked until settlement

---

## Repository Structure (V2)

```
.
├── programs/
│   ├── oracle/              # Pyth oracle integration
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── vault/               # Tokenized vault system
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── rfq/                 # Request-for-quote system
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── xstock_options/      # V1 covered call program
├── app/
│   ├── app/
│   │   ├── v2/              # V2 UI
│   │   │   ├── layout.tsx   # V2 layout with sidebar
│   │   │   ├── page.tsx     # Earn dashboard
│   │   │   ├── oracle/      # Oracle price monitor
│   │   │   └── earn/        # Vault detail pages
│   │   └── ...
│   ├── hooks/
│   │   └── useVault.ts      # Vault React hooks
│   ├── lib/
│   │   └── vault-sdk.ts     # Vault SDK
│   └── ...
├── infra/
│   └── rfq-router/          # Off-chain quote router
│       ├── src/index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   ├── init-vault.ts        # Vault initialization script
│   └── test-oracle.ts       # Oracle test script
└── tests/
    ├── oracle.ts            # Oracle integration tests
    ├── vault.ts             # Vault integration tests
    └── rfq.ts               # RFQ integration tests
```

---

## UI Features

### Earn Dashboard (`/v2`)

- Vault listings with APY, TVL, tier
- Live status indicators (Live on Devnet / Coming Soon)
- Total TVL stats
- Latest updates section

### Vault Detail Page (`/v2/earn/[ticker]`)

- **Epoch Strip**: Strike, roll time, premium range, cap at a glance
- **KPI Cards**: TVL, epoch, utilization, estimated premium
- **Vault Status Panel**:
  - Oracle status (Healthy/Degraded)
  - RFQ status (Idle/Quoting/Filled)
  - Spot/strike prices with live updates
  - Position progress bar
  - Risk warnings
- **Payoff Chart**: Visual representation of covered call payoff
- **Deposit Panel**:
  - Outcome summary (deposit/receive/withdraw timing)
  - Premium estimate in USD
  - Trust signals (strategy type, cap)

### Oracle Page (`/v2/oracle`)

- Live Pyth price feeds for all supported assets
- Price, confidence interval, staleness status
- Auto-refresh every 10 seconds
- Feed IDs for verification

### UI Scale System

Adjustable UI scale for accessibility:

- **Compact**: 95%
- **Default**: 100%
- **Comfortable**: 108%
- **Large**: 115%

Settings icon in header, persisted to localStorage.

### Collapsible Sidebar

- Toggle between expanded (icons + labels) and collapsed (icons only)
- State persisted to localStorage
- Smooth transitions

---

## Environment Variables

### Frontend (`app/.env.local`)

```env
# Bitquery API (for V1 price data)
BITQUERY_CLIENT_ID=your_client_id
BITQUERY_CLIENT_SECRET=your_client_secret

# Solana RPC (optional, defaults to devnet)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### RFQ Router (`infra/rfq-router/.env`)

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_KEYPAIR_PATH=~/.config/solana/id.json
```

---

## Testing

### Run All Tests

```bash
anchor test
```

### Test Individual Programs

```bash
# Oracle tests
npx mocha tests/oracle.ts

# Vault tests
npx mocha tests/vault.ts

# RFQ tests
npx mocha tests/rfq.ts
```

### Test Scripts

```bash
# Test oracle price fetching
cd scripts && npx ts-node test-oracle.ts

# Initialize vault
cd scripts && npx ts-node init-vault.ts
```

---

## Roadmap

### Completed ✅

- [x] Oracle program with Pyth integration
- [x] Vault program with deposit/withdraw
- [x] RFQ program structure
- [x] V2 UI with Earn dashboard
- [x] Vault detail pages with live pricing
- [x] Oracle monitoring page (enhanced with search/sort/expand)
- [x] UI scale system
- [x] Collapsible sidebar
- [x] Devnet deployment (oracle, vault, rfq)
- [x] NVDAx vault initialization
- [x] Portfolio page with position breakdown
- [x] V2 Documentation page

### In Progress 🚧

- [ ] Deposit/withdraw transaction integration
- [ ] Full epoch lifecycle (start → roll → settle)
- [ ] RFQ router market maker integration
- [ ] Multiple vault initialization (AAPL, TSLA, SPY, META)

### Planned 📋

- [ ] Option settlement with Pyth prices
- [ ] Historical yield tracking
- [ ] Mainnet deployment
- [ ] Audit

---

## Stack

- **Blockchain**: Solana
- **Smart Contracts**: Anchor 0.32.1
- **Oracle**: Pyth Network
- **Frontend**: Next.js 15 (App Router), React 19
- **Styling**: Tailwind CSS 4
- **Wallet**: Solana Wallet Adapter
- **Data**: Pyth Hermes API, Bitquery (V1)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

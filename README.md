# xStock Options

xStock Options is a Solana-based covered call options protocol built on synthetic equities from xStocks, using USDC as collateral.

## How to Use

xStock Options allows you to trade covered call options on synthetic stocks (like synthetic AAPL, TSLA, NVDA, etc.) directly on Solana. Here's how to get started:

### For Option Sellers (Writing Covered Calls)

1. **Browse Available Stocks**: Visit the platform and browse synthetic stocks available for trading
2. **Select a Stock**: Choose a synthetic stock you own (e.g., xNVDA, xAAPL)
3. **Create a Covered Call**: 
   - Lock your synthetic stock into a vault
   - Set your strike price (the price at which the option can be exercised)
   - Choose an expiration date
   - Set your premium (the price you want to receive for selling the option)
4. **List Your Option**: Your option will appear in the marketplace for others to buy
5. **Receive Premium**: When someone buys your option, you immediately receive the premium in USDC
6. **Manage Your Position**:
   - If the option expires without being exercised, you can reclaim your stock
   - If the option is exercised, you receive the strike price in USDC and the buyer gets your stock

### For Option Buyers

1. **Browse Options Chain**: View available options for different synthetic stocks
2. **Select an Option**: Choose an option with your desired strike price and expiration
3. **Buy the Option**: Pay the premium in USDC to purchase the option
4. **Manage Your Position**:
   - **Exercise**: If the stock price exceeds the strike price before expiration, exercise the option to buy the stock at the strike price
   - **Resell**: You can list your option for resale at a new price if you don't want to exercise it
   - **Let it Expire**: If the stock price stays below the strike price, the option expires worthless

### Key Benefits

- **24/7 Trading**: Synthetic stocks trade continuously on Solana, even when traditional markets are closed
- **Transparent Pricing**: Option premiums are calculated using Black-Scholes pricing based on real-time volatility
- **Secondary Market**: Buy and sell options before expiration
- **No Intermediaries**: Direct peer-to-peer trading on the blockchain

---

## What It Does

**American-Style Options**: All options are American-style, meaning buyers can exercise their options at any time before expiration, not just at expiry. This provides flexibility to capture profits early, take advantage of dividend events, or manage risk proactively.

xStock Options enables users to:

- Lock xStock (synthetic AAPL, TSLA, etc.) into a vault
- List covered calls with strike, expiry, and premium
- Buy and resell options on a simple secondary market
- **Exercise options anytime before expiration** (American-style) to receive the underlying xStock
- Reclaim stock if the option was never sold or expires

## Architecture

### Program

**Location:** `programs/xstock_options/src/lib.rs`

Anchor program that:
- Locks xStock into a PDA vault when a covered call is created
- Handles premium payments when options are bought
- Settles exercise by moving USDC strike to the seller and xStock to the buyer
- Lets the seller reclaim xStock if the option expires or was never sold

### Frontend

**Location:** `app/`

Next.js App Router UI for:
- Viewing synthetic stocks and their option chains
- Creating covered calls
- Buying options
- Exercising or reclaiming positions

### Tests

**Location:** `tests/xstock.ts`

Anchor integration tests that:
- Create test mints for xStock and USDC
- Mint balances
- Walk through create, buy, exercise, and reclaim flows end to end

## Covered Call Lifecycle

1. **Create**
   - Seller calls `create_covered_call` with strike, expiry, amount, and premium
   - Program transfers `amount` of xStock from the seller to a PDA vault
   - CoveredCall account is initialized and marked as listed

2. **Buy**
   - Buyer calls `buy_option`
   - Program checks the option is listed, not expired, and not exercised
   - Buyer pays the premium in USDC to the current owner (seller or previous buyer)
   - CoveredCall records the buyer and is marked as unlisted

3. **List for Resale**
   - Current owner calls `list_for_sale` with a new ask price
   - CoveredCall is marked as listed again

4. **Exercise** (American-Style)
   - Buyer can call `exercise` **at any time** before the expiration timestamp
   - This is American-style exercise, allowing early exercise when profitable (e.g., deep ITM, dividend capture)
   - Program transfers strike amount in USDC from buyer to seller
   - PDA vault sends xStock to the buyer
   - CoveredCall is marked as exercised

5. **Reclaim**
   - If the option expired or was never sold, seller calls `reclaim`
   - PDA vault sends any remaining xStock back to seller
   - CoveredCall is marked as cancelled

## Pricing and Volatility

Option premiums are computed off-chain in the frontend.

For the hackathon, we estimate volatility from recent synthetic xStock price movements:

1. Pull recent prices of the xStock asset
2. Compute log returns `r_i = ln(S_i / S_{i-1})`
3. Compute the standard deviation of returns and annualize it
4. Plug the resulting volatility into a Black-Scholes call formula to obtain a fair premium
5. Use that premium as the initial `ask_price` when creating a covered call

This approach works 24/7 because synthetic xStocks trade continuously on Solana, even when the underlying equity markets are closed.

## Stack

- Solana
- Anchor
- xStocks synthetic assets
- USDC (Circle) as collateral
- Next.js (App Router) frontend
- TypeScript test suite with Anchor

## Getting Started

### Prerequisites

- **Node.js 18+** (or latest LTS version)
- **Rust** (latest stable version) - for building the Solana program
- **Solana CLI** - install from [solana.com/docs](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI** - install with `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force && avm install latest && avm use latest`
- **pnpm** - package manager (install with `npm install -g pnpm`)
- A **Solana wallet** browser extension (Phantom, Solflare, etc.)

### 1. Install Root Dependencies

From the repository root:

```bash
pnpm install
```

This installs dependencies for the Anchor program and tests.

### 2. Build and Deploy the Solana Program (Optional for UI-only)

If you want to deploy the program to devnet:

```bash
# Build the program
anchor build

# Deploy to devnet (make sure you have SOL in your devnet wallet)
anchor deploy

# Or run tests which will deploy to a local validator
anchor test
```

**Note:** The UI can work with an already-deployed program. Check `app/anchor/xstock_idl.json` for the program IDL.

### 3. Set Up the Frontend

Navigate to the app directory:

```bash
cd app
```

Install frontend dependencies:

```bash
pnpm install
```

### 4. Configure Environment Variables

Create a `.env.local` file in the `app/` directory:

```bash
cd app
touch .env.local
```

Add the following environment variables:

```env
BITQUERY_CLIENT_ID=your_client_id_here
BITQUERY_CLIENT_SECRET=your_client_secret_here
```

**To get Bitquery credentials:**
1. Go to [Bitquery](https://bitquery.io/) and create an account
2. Create a new **Automatic** application (for server use)
3. Copy the **Client ID** and **Client Secret**

The app uses Bitquery's xStocks API for real-time price data from the Solana blockchain.

### 5. Run the Development Server

Start the Next.js development server:

```bash
cd app
pnpm dev
```

The UI will be available at [http://localhost:3000](http://localhost:3000)

### 6. Connect Your Wallet

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Make sure your wallet is connected to **devnet** (the program is configured for devnet in `Anchor.toml`)

### Running Tests

To run the Anchor integration tests:

```bash
# From the root directory
pnpm run mocha
# or
anchor test
```

### Building for Production

Build the production-ready frontend:

```bash
cd app
pnpm build
pnpm start
```

## Repository Structure

```
.
├── .gitignore
├── Anchor.toml
├── Cargo.toml
├── COMPARISON.md
├── LICENSE
├── package.json
├── rust-toolchain.toml
├── tsconfig.json
├── app/
│   ├── .gitignore
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── postcss.config.mjs
│   ├── README.md
│   ├── tsconfig.json
│   ├── anchor/
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── types/
│   └── utils/
├── assets/
│   ├── nvidiax_test.json
│   └── usdc_test.json
├── migrations/
│   └── deploy.js
├── programs/
│   └── xstock_options/
└── tests/
    └── xstock.ts
```

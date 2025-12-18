# AGENTS.md - xStock Options Guide for Coding Agents

This file is the dedicated place for AI coding agents (Codex, Cursor, Copilot, etc.) to learn how to work with this repository.

Think of this as a README for agents: it describes how to set up the environment, run checks, and follow the project conventions.

---

## Project Overview

**Name**: xStock Options  
**Description**: A Solana-based covered call options protocol built on synthetic equities (xStocks) using USDC as collateral.

### Core Concept

xStock Options enables:
- **V1**: Manual peer-to-peer covered call trading
- **V2**: Automated vault-based yield generation through covered call strategies

### Key Features

- American-style options (exercise anytime before expiration)
- Tokenized vault shares (ERC-4626 style)
- Pyth Network oracle integration for real-time pricing
- Request-for-Quote (RFQ) system for institutional trading

---

## Setup Commands

Run these from the repo root.

### Install Root Dependencies

```bash
pnpm install
```

### Install Frontend Dependencies

```bash
cd app && pnpm install
```

### Build the Solana Programs

```bash
anchor build
```

### Run the Development Server (Frontend)

```bash
cd app && pnpm dev
```

### Run the RFQ Router (Off-chain Service)

```bash
cd infra/rfq-router && npm install && npm run dev
```

### Run the Mock Market Maker

```bash
cd scripts && npx ts-node mock-market-maker.ts
```

### Deploy to Devnet

```bash
# Set Solana CLI to devnet
solana config set --url devnet

# Airdrop SOL for deployment (if needed)
solana airdrop 5

# Deploy all programs
anchor deploy
```

### Initialize a Vault

```bash
cd scripts && npx ts-node init-vault.ts
```

### Test Oracle

```bash
cd scripts && npx ts-node test-oracle.ts
```

### Environment Variables

Frontend requires `app/.env.local`:

```env
# Bitquery API (for V1 price data)
BITQUERY_CLIENT_ID=your_client_id
BITQUERY_CLIENT_SECRET=your_client_secret

# Solana RPC (optional, defaults to devnet)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

RFQ Router requires `infra/rfq-router/.env`:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_KEYPAIR_PATH=~/.config/solana/id.json
```

Never hardcode secrets in code. Keep them in `.env` files.

---

## Testing Instructions

### Run All Tests

```bash
anchor test
```

Or run the mocha test suite directly:

```bash
pnpm run mocha
```

### Run Individual Program Tests

```bash
# V1 xStock Options tests
npx mocha tests/xstock.ts

# Oracle tests
npx mocha tests/oracle.ts

# Vault tests
npx mocha tests/vault.ts

# RFQ tests
npx mocha tests/rfq.ts
```

### Expectations

- Tests should be green before merging
- When you add or change functionality, add or update tests for it even if nobody asks
- Test files are in `tests/` directory using Mocha + Chai with TypeScript

---

## Dev Environment Tips

- Use `pnpm install` instead of yarn or npm. This project uses pnpm as the package manager.
- Use `cd app && pnpm dev` for the frontend dev server.
- For the RFQ router, run `cd infra/rfq-router && npm run dev`.
- Ensure Solana CLI is configured for devnet: `solana config set --url devnet`
- Wallet keypair is expected at `~/.config/solana/id.json`
- Anchor version must be 0.32.1 (specified in `Anchor.toml`)

---

## Code Style

### TypeScript / JavaScript

**Tools**:
- ESLint (configured in `app/eslint.config.mjs`)
- Prettier (for formatting)

**Format and lint**:

```bash
pnpm run lint:fix   # Root: format with Prettier
cd app && pnpm lint # Frontend: ESLint
```

**Guidelines**:
- Use TypeScript for all new code
- Use type hints where helpful
- Keep imports ordered: libraries, then local modules
- Prefer `async/await` over raw Promises

### Rust / Anchor Programs

**Guidelines**:
- Follow Anchor patterns for instruction handlers and account contexts
- Use descriptive names: `initialize_vault`, `deposit`, `request_withdrawal`
- Group code with clear section comments (`// === Account Structures ===`)
- Use proper error codes with `#[error_code]` macro
- Document public functions and complex logic

**Structure of an instruction**:

```rust
pub fn instruction_name(ctx: Context<InstructionContext>, arg: Type) -> Result<()> {
    // Validation logic
    // Business logic
    // State mutations
    // Emit events
    Ok(())
}
```

### Tailwind CSS (Frontend)

- Use Tailwind CSS 4
- Keep component styles contained within the component file
- Prefer utility classes over custom CSS
- Follow existing patterns in `app/components/`

---

## General Expectations

- Keep modules focused on one area (vault, oracle, rfq, UI components)
- Respect the existing folder layout and file naming conventions
- Avoid large, speculative refactors without a spec
- Keep changes small and clear
- Write short, focused functions with descriptive names
- Comments should explain *why* something is done, not just what

---

## Repository Structure

```
.
├── Anchor.toml              # Anchor configuration, program IDs
├── Cargo.toml               # Rust workspace config
├── package.json             # Root dependencies (Anchor tests)
├── programs/
│   ├── oracle/              # Pyth oracle integration program
│   │   └── src/lib.rs
│   ├── vault/               # ERC-4626 style tokenized vault program
│   │   └── src/lib.rs
│   ├── rfq/                 # Request-for-quote system program
│   │   └── src/lib.rs
│   └── xstock_options/      # V1 covered call program
│       └── src/lib.rs
├── app/                     # Next.js 15 frontend (React 19)
│   ├── app/                 # App Router pages
│   │   ├── v2/              # V2 vault-based UI
│   │   │   ├── page.tsx     # Earn dashboard
│   │   │   ├── oracle/      # Oracle price monitor
│   │   │   └── earn/        # Vault detail pages
│   │   └── stock/           # V1 options UI
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks (useVault, useRfq, etc.)
│   ├── lib/                 # SDK wrappers (vault-sdk.ts)
│   ├── anchor/              # IDL files and generated types
│   └── utils/               # Utility functions
├── infra/
│   └── rfq-router/          # Off-chain quote aggregation service
│       ├── src/index.ts
│       └── package.json
├── scripts/
│   ├── init-vault.ts        # Initialize vault script
│   ├── test-oracle.ts       # Test oracle prices
│   ├── airdrop-vault-tokens.ts
│   ├── advance-epoch.ts
│   └── mock-market-maker.ts # Simulate market maker quotes
├── tests/
│   ├── xstock.ts            # V1 covered call tests
│   ├── oracle.ts            # Oracle program tests
│   ├── vault.ts             # Vault program tests
│   └── rfq.ts               # RFQ program tests
└── docs/
    ├── README.md            # Main project overview
    ├── V2_README.md         # V2 architecture docs
    ├── HOW_IT_WORKS.md      # Detailed explanation
    └── PYTH_INTEGRATION.md  # Oracle integration guide
```

When adding new files, place them in the logical directory instead of creating new top-level folders.

---

## Programs (On-Chain)

### Program IDs (Devnet)

| Program         | ID |
|-----------------|-----|
| `oracle`        | `5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk` |
| `vault`         | `8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY` |
| `rfq`           | `3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z` |
| `xstock_options`| `9VRMEYvEiKPeGz9N8wVQjvT5qpqcHqNqd31kSYZhop2s` |

### Vault Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create new vault for an xStock asset |
| `deposit` | Deposit xStock tokens, receive vault shares |
| `request_withdrawal` | Queue withdrawal (processed at epoch end) |
| `process_withdrawal` | Redeem shares for underlying + yield |
| `advance_epoch` | Move to next trading epoch |
| `record_notional_exposure` | Record RFQ fill for fractional options |
| `create_share_metadata` | Add Metaplex metadata to share token |

### PDA Seeds

```rust
// Vault PDA
seeds = [b"vault", asset_id.as_bytes()]

// Vault Token Account PDA
seeds = [b"vault_tokens", vault.key().as_ref()]
```

### Pyth Oracle Integration

V2 uses Pyth Network for real-time price feeds:

| Asset | Pyth Feed ID |
|-------|--------------|
| NVDAx | `0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f` |
| TSLAx | `0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362` |
| SPYx  | `0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14` |
| AAPLx | `0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675` |
| METAx | `0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900` |

Fetch prices from Pyth Hermes:

```typescript
const HERMES_URL = "https://hermes.pyth.network";
const response = await fetch(
  `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`
);
```

---

## Frontend Patterns

### React Hooks

Use existing hooks in `app/hooks/`:
- `useVault.ts` - Vault data and operations
- `useRfq.ts` - RFQ quote requests

### SDK Usage

Use the SDK wrappers in `app/lib/`:
- `vault-sdk.ts` - Vault program interactions

### Component Patterns

- Components live in `app/components/`
- Use TypeScript interfaces for props
- Follow existing naming conventions

---

## How Agents Should Behave

When editing or adding code in this repo:

### Respect the Architecture

- Use existing layers: `programs/`, `app/`, `infra/`, `tests/`
- Do not create new top-level folders unless absolutely necessary
- Keep Anchor programs separate from TypeScript code

### Follow Code Standards

- Use TypeScript for frontend and tests
- Use Rust with Anchor patterns for programs
- Lint and format before committing

### Use Existing Helpers

- Reuse hooks like `useVault` and `useRfq`
- Use SDK wrappers in `app/lib/` instead of raw RPC calls
- Use existing utilities in `app/utils/`

### Keep Changes Small and Clear

- Write short, focused functions with descriptive names
- Prefer incremental improvements over large refactors
- Add comments explaining *why*, not just *what*

### Keep Docs in Sync

- Update README.md or V2_README.md when adding major features
- Update this AGENTS.md if adding new conventions or scripts

### Be Honest About TODOs

- If behavior is unclear, create minimal implementation with `// TODO` comment
- Don't guess at complex structures

---

## Do Not

- Do not change the package manager (use pnpm)
- Do not hardcode credentials or secrets
- Do not change Anchor version without updating Anchor.toml
- Do not rewrite the overall architecture without a written spec
- Do not modify program IDs in Anchor.toml unless redeploying

---

## PR Instructions

**PR title format**: `[xstock-options] <short description>`

Before opening a PR:

1. Build programs: `anchor build`
2. Run tests: `anchor test`
3. Lint frontend: `cd app && pnpm lint`
4. Document any new instructions or endpoints

---

## Example Prompts That Work Well

These are examples of tasks you can give an agent:

- "Add a `get_vault_stats` instruction to the vault program that returns total assets, shares, and current epoch"
- "Create a React hook `useOraclePrice` that fetches live Pyth prices for a given asset"
- "Add a test case to `tests/vault.ts` that verifies withdrawal requests are queued correctly"
- "Implement a `/api/vault/[ticker]` route that returns vault information as JSON"
- "Add error handling to `vault-sdk.ts` for when the RPC connection fails"

Agents should use all of the guidance in this AGENTS.md file when completing these tasks so their changes fit the project style and structure.

---

## Stack Summary

| Layer | Technology |
|-------|------------|
| Blockchain | Solana |
| Smart Contracts | Anchor 0.32.1 (Rust) |
| Oracle | Pyth Network |
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Wallet | Solana Wallet Adapter |
| Data | Pyth Hermes API, Bitquery |
| Package Manager | pnpm |
| Testing | Mocha, Chai, ts-mocha |

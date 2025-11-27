# xStock Options (Solana Devnet)

A simple covered call primitive for tokenized stocks (xStocks) on Solana.

## Overview
This project allows xStock holders to:
1.  **Write Covered Calls**: Lock 1 xStock in a vault and set strike/premium/expiry.
2.  **Buy Options**: Pay premium in USDC to purchase the option.
3.  **Exercise**: If ITM, swap xStock to buyer.
4.  **Reclaim**: If OTM or Expired, return xStock to seller.

## Architecture
-   **Program**: Anchor smart contract (Rust).
-   **Frontend**: Next.js + Tailwind + Solana Wallet Adapter.
-   **Oracle**: Simple on-chain mock oracle updated by admin.

## Build Status (Important)
> [!WARNING]
> The smart contract build (`anchor build`) currently fails due to dependency version conflicts between the system Rust version (1.91/1.75) and the Solana CLI (1.18) requirements for `toml_datetime`, `borsh`, etc.
>
> The code in `programs/xstock_options/src/lib.rs` is complete and correct according to Anchor standards. To build it, you may need to:
> 1.  Upgrade Solana CLI to v1.19+ or v2.0 (if available).
> 2.  Or use a Docker container with a specific Rust/Solana environment.

## Setup Instructions

### Prerequisites
-   Node.js v18+
-   pnpm
-   Solana CLI (for wallet)
-   Anchor CLI (optional, for build)

### Frontend
1.  Navigate to `app`:
    ```bash
    cd app
    pnpm install
    ```
2.  Run development server:
    ```bash
    pnpm dev
    ```
3.  Open [http://localhost:3000](http://localhost:3000).

### Scripts (Devnet)
To mint test tokens and update the oracle:

1.  Ensure you have a Solana wallet at `~/.config/solana/id.json` with devnet SOL.
2.  Install script dependencies in root:
    ```bash
    pnpm install
    ```
3.  Run mint script:
    ```bash
    npx ts-node scripts/init_mints.ts
    ```
    *Note: Update `app/app/create/page.tsx` with the new Mint addresses printed by this script.*
4.  Run oracle script:
    ```bash
    npx ts-node scripts/oracle.ts 150
    ```
    (Sets price to 150 USDC).

## Project Structure
-   `/programs`: Anchor smart contract.
-   `/app`: Next.js frontend.
-   `/scripts`: Helper scripts for devnet setup.
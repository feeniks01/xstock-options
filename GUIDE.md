# xStock Options - Comprehensive Guide

This guide will walk you through setting up the environment, getting Devnet SOL, deploying the smart contract, and running the frontend application.

## 1. Prerequisites

Ensure you have the following installed:
*   **Node.js** (v18+) & **pnpm**
*   **Rust** (v1.75.0 recommended for Solana 1.18)
*   **Solana CLI** (v1.18+)
*   **Anchor CLI** (v0.29.0 or v0.30.1)

## 2. Wallet Setup & Devnet SOL

1.  **Generate a new wallet** (if you don't have one):
    ```bash
    solana-keygen new -o ~/.config/solana/id.json
    ```
    *Save the seed phrase securely!*

2.  **Set config to Devnet**:
    ```bash
    solana config set --url https://api.devnet.solana.com
    ```

3.  **Airdrop Devnet SOL**:
    ```bash
    solana airdrop 2
    ```
    *If this fails (common due to rate limits), use a faucet website like [faucet.solana.com](https://faucet.solana.com) and paste your public key (`solana address`).*

## 3. Smart Contract Deployment

1.  **Build the Program**:
    ```bash
    anchor build
    ```
    *Note: If you encounter Rust version errors, ensure your `rustc --version` matches the Solana CLI requirements (usually 1.75.0 for CLI 1.18).*

2.  **Get Program ID**:
    After building, get the keypair address:
    ```bash
    solana address -k target/deploy/xstock_options-keypair.json
    ```

3.  **Update Configs**:
    *   Update `Anchor.toml`: `xstock_options = "<YOUR_PROGRAM_ID>"`
    *   Update `programs/xstock_options/src/lib.rs`: `declare_id!("<YOUR_PROGRAM_ID>");`
    *   Update `app/anchor/setup.ts`: `programId = new PublicKey("<YOUR_PROGRAM_ID>");`

4.  **Rebuild & Deploy**:
    ```bash
    anchor build
    anchor deploy
    ```

## 4. Initialize Test Data (Mints & Oracle)

1.  **Install Script Dependencies**:
    ```bash
    pnpm install
    ```

2.  **Mint Test Tokens**:
    This script creates a mock xStock mint and a mock USDC mint, and mints them to your wallet.
    ```bash
    npx ts-node scripts/init_mints.ts
    ```
    **Important**: Copy the `xStock Mint` and `USDC Mint` addresses output by this script.

3.  **Update Frontend Constants**:
    Open `app/utils/constants.ts` and replace `MOCK_MINT` and `QUOTE_MINT` with the addresses from step 2.

4.  **Initialize Oracle**:
    This sets the initial price of the xStock (e.g., $150).
    ```bash
    npx ts-node scripts/oracle.ts 150
    ```

## 5. Testing Tools
    
1.  **Mint Tokens Interactively**:
    Use this script to mint xStock or Quote tokens to any wallet.
    ```bash
    npx ts-node scripts/mint.ts
    ```
    *Follow the prompts to select the token and quantity.*

2.  **Simulate Price Movement**:
    Run this script to simulate live price updates (random walk).
    ```bash
    npx ts-node scripts/simulate_price.ts
    ```
    *This will update the on-chain oracle price every 10 seconds.*

## 6. Running the Frontend

1.  **Navigate to App**:
    ```bash
    cd app
    pnpm install
    ```

2.  **Start Dev Server**:
    ```bash
    pnpm dev
    ```

3.  **Open Browser**:
    Go to [http://localhost:3000](http://localhost:3000).

4.  **Connect Wallet**:
    Use Phantom or Solflare (set to Devnet) to connect.

## 7. Using the App

1.  **Create a Covered Call**:
    *   Go to **Create Call**.
    *   Select an Asset (e.g., xSPY).
    *   Enter Strike Price (e.g., 160 USDC).
    *   Enter Premium (e.g., 5 USDC).
    *   Select Expiry.
    *   Click **Create Listing**. (You must have the xStock token in your wallet).

2.  **Buy an Option**:
    *   Switch to a different wallet (or use the same one for testing).
    *   Go to **Marketplace**.
    *   Find your listing and click **Buy Option**. (You must have USDC).

3.  **Exercise / Reclaim**:
    *   **Exercise**: If you bought an option and the price is > Strike (update oracle to test), click **Exercise**.
    *   **Reclaim**: If you sold an option and it expired OTM, click **Reclaim**.

## Troubleshooting

*   **Build Errors**: Check `rustc` version. Use `rustup override set 1.75.0` in the project root.
*   **Transaction Failures**: Ensure you have enough SOL for rent and fees.
*   **"Account not found"**: Make sure you are on Devnet and have run the initialization scripts.

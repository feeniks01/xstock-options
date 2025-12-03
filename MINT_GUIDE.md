# Mint Script Usage Guide

This guide explains how to use the `mint.ts` script to mint test tokens (xStock and USDC) to wallets on Solana devnet.

## Prerequisites

1. **Node.js and TypeScript**: Ensure you have Node.js installed and TypeScript configured
2. **Solana CLI**: The script uses your default Solana keypair from `~/.config/solana/id.json`
3. **Dependencies**: Make sure all npm/pnpm dependencies are installed
4. **Devnet Access**: The script connects to Solana devnet (`https://api.devnet.solana.com`)

## Setup

1. **Install dependencies** (if not already done):
   ```bash
   cd app
   npm install
   # or
   pnpm install
   ```

2. **Configure Solana CLI** (if not already done):
   ```bash
   solana config set --url devnet
   ```

3. **Ensure your keypair exists**:
   The script expects your Solana keypair at `~/.config/solana/id.json`
   
   If you don't have one, generate it:
   ```bash
   solana-keygen new
   ```

4. **Fund your deployer wallet** (if needed):
   ```bash
   solana airdrop 2
   ```

## Running the Script

From the project root directory:

```bash
npx tsx scripts/mint.ts
```

Or if you have ts-node installed:

```bash
ts-node scripts/mint.ts
```

## Token Mint Addresses

The script uses these pre-configured mint addresses:

- **xStock (Mock Stock)**: `6a57JJHxnTkbb6YDWmZPtWirFpfdxLcpNqeD5zqjziiD`
- **USDC (Mock Quote)**: `5AuU5y36pg19rnVoXepsVXcoeQiX36hvAk2EGcBhktbp`

## Step-by-Step Usage

### 1. Start the Script

Run the script using one of the commands above. You'll see:

```
--- xStock Options Minting Script ---
```

### 2. Enter Wallet Address

The script will prompt you for a wallet address:

```
Enter wallet address to mint to: 
```

Enter a valid Solana public key (base58 encoded). The script will validate the address.

### 3. Select Token Type

Choose which token(s) to mint:

```
Which token do you want to mint?
1. xStock (Mock Stock)
2. USDC (Mock Quote)
3. Both
Enter choice (1, 2, or 3): 
```

- **Option 1**: Mint only xStock tokens
- **Option 2**: Mint only USDC tokens
- **Option 3**: Mint both tokens in a single transaction

### 4. Enter Quantity

Depending on your selection, you'll be prompted for quantities:

- If you chose **xStock** or **Both**: 
  ```
  Enter quantity of xStock to mint: 
  ```

- If you chose **USDC** or **Both**:
  ```
  Enter quantity of USDC to mint: 
  ```

**Note**: The script multiplies your input by 1,000,000 (6 decimals). For example:
- Entering `100` will mint 100 tokens (100,000,000 raw units)
- Entering `0.5` will mint 0.5 tokens (500,000 raw units)

### 5. Transaction Execution

The script will:
1. Create or get the associated token account (ATA) for the recipient
2. Build and send the mint transaction
3. Wait for confirmation
4. Display success message with transaction link

Example output:
```
Minting 100 xStock and 50 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU...
Transaction sent. Confirming...
✅ Successfully minted!
Tx: https://explorer.solana.com/tx/...?cluster=devnet
```

### 6. Next Steps

After a successful mint, you'll see:

```
What would you like to do next?
1. Mint another token to the SAME wallet
2. Mint to a DIFFERENT wallet
3. Finish and Exit
Enter choice (1, 2, or 3): 
```

- **Option 1**: Continue minting to the current wallet (no need to re-enter address)
- **Option 2**: Switch to a different wallet address
- **Option 3**: Exit the script

## Example Session

```
--- xStock Options Minting Script ---

Enter wallet address to mint to: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

Which token do you want to mint?
1. xStock (Mock Stock)
2. USDC (Mock Quote)
3. Both
Enter choice (1, 2, or 3): 3
Enter quantity of xStock to mint: 1000
Enter quantity of USDC to mint: 5000

Minting 1000 xStock and 5000 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU...
Transaction sent. Confirming...
✅ Successfully minted!
Tx: https://explorer.solana.com/tx/...?cluster=devnet

What would you like to do next?
1. Mint another token to the SAME wallet
2. Mint to a DIFFERENT wallet
3. Finish and Exit
Enter choice (1, 2, or 3): 3
Goodbye! 👋
```

## Troubleshooting

### Error: "Invalid public key"
- Ensure you're entering a valid Solana public key (base58 encoded, typically 32-44 characters)
- Check for typos or extra spaces

### Error: "Minting failed"
Common causes:
- **Insufficient SOL**: Your deployer wallet needs SOL for transaction fees
  - Solution: Run `solana airdrop 2` to get devnet SOL
- **Network issues**: Connection to devnet might be unstable
  - Solution: Try again or check your internet connection
- **Invalid mint authority**: The deployer wallet must be the mint authority
  - Solution: Verify the mint addresses are correct and the deployer has authority

### Error: Cannot find keypair
- Ensure your Solana keypair exists at `~/.config/solana/id.json`
- If using a different keypair, modify the script or use `solana config set --keypair <path>`

### Transaction takes too long
- Devnet can be slow. The script waits for confirmation, which may take 10-30 seconds
- If it times out, check the transaction on Solana Explorer using the provided link

## Notes

- **Decimals**: Both tokens use 6 decimals (1,000,000 raw units = 1 token)
- **Network**: This script only works on **devnet**
- **Mint Authority**: The script assumes your deployer wallet (`~/.config/solana/id.json`) is the mint authority for both tokens
- **ATA Creation**: The script automatically creates associated token accounts if they don't exist
- **Transaction Fees**: Each transaction costs a small amount of SOL (paid by the deployer wallet)

## Security Reminders

- This script is for **development and testing only**
- Never commit your keypair file (`id.json`) to version control
- The script uses your default Solana keypair - ensure it's the correct one
- Always verify transaction details on Solana Explorer before confirming


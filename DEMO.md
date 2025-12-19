# 🚀 OptionsFi - Hackathon Demo Guide

This guide helps team members quickly set up and demo the OptionsFi V2 platform.

**Current Status:** ✅ Live on Devnet | 5 Vaults | $17K+ TVL | Real Pyth Oracle

---

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
git clone <repo-url>
cd xstock-options

# Install dependencies
pnpm install
cd app && pnpm install
```

### 2. Set Up Your Wallet

You need a Solana devnet wallet. Choose one method:

**Option A: Use Phantom (Recommended for Demo)**
1. Install [Phantom](https://phantom.app/) browser extension
2. Create/import a wallet
3. Switch to **Devnet** in Phantom settings (Settings → Developer Settings → Network → Devnet)
4. Get devnet SOL: https://faucet.solana.com/ (paste your wallet address)

**Option B: Create a CLI Wallet**
```bash
# Install Solana CLI first: https://docs.solana.com/cli/install-solana-cli-tools
solana-keygen new -o my-wallet.json
solana config set --url devnet
solana airdrop 2 $(solana-keygen pubkey my-wallet.json)
```

### 3. Start the Frontend

```bash
cd app
pnpm dev
```

Open http://localhost:3000/v2

### 4. Connect & Test

1. Click **"Select Wallet"** → Connect Phantom
2. Go to **Earn** → Click any vault (e.g., **"NVDAx Vault"**)
3. View real-time Pyth prices, TVL, and utilization
4. If you have test tokens, try depositing

**That's it! You're ready to demo.**

---

## Demo Flow for Presentations

### Quick Reference - Key Numbers for Judges

| Metric | Value |
|--------|-------|
| Live TVL | $17,646 |
| NVDAx deposited | 100 tokens |
| Current NVDA price | ~$176 |
| Strike price | ~$194 (10% OTM) |
| Est. APY | 12.4% |
| Premium range | 0.8-1.2% per epoch |
| Oracle feeds | 5/5 healthy (Pyth) |
| Epoch length | ~7 days |

---

### 🎬 Professional Demo Flow (5-7 minutes)

#### Opening (30 seconds)

> "OptionsFi brings institutional-grade options strategies to tokenized stocks on Solana. Today I'll show you our V2 vault system that automates covered call yield generation."

---

#### Part 1: Earn Dashboard (60 seconds)

**Navigate to:** http://localhost:3000/v2

**Key talking points:**
- "Our Earn dashboard shows all available vaults - NVDAx, TSLAx, SPYx, and more"
- "Each vault has different risk profiles: Conservative, Normal, or Aggressive"
- "The NVDAx vault is live with $17,646 TVL earning an estimated 12.4% APY"
- "Users simply deposit their xStock tokens and the vault handles the rest"

---

#### Part 2: Oracle Integration (60 seconds)

**Navigate to:** http://localhost:3000/v2/oracle

**Key talking points:**
- "We integrate Pyth Network for real-time price feeds"
- "All 5 feeds are healthy with sub-10-second latency"
- "This powers our dynamic strike price calculation - currently NVDA spot is $176, with the covered call strike at $194 (10% OTM)"
- "The EMA comparison helps detect market momentum"

---

#### Part 3: Vault Deep Dive (90 seconds) ⭐ THE MONEY SHOT

**Navigate to:** http://localhost:3000/v2/earn/nvdax

**Key talking points:**
- "Let me show you the NVDAx Vault in detail"
- "TVL of $17,646 with 100 NVDAx tokens deposited"
- "The covered call strategy automatically calculates a 10% out-of-the-money strike"
- "Current strike is $194 based on live Pyth price of $176"
- "The payoff chart shows users earn 0.8-1.2% premium while capping upside at +10%"
- "Each epoch is ~7 days - when it ends, premium is distributed and new options are rolled"

---

#### Part 4: Deposit Flow (60 seconds)

**Click:** "Select Wallet" → Connect Phantom

**Key talking points:**
- "To participate, users connect their Solana wallet"
- "The deposit form shows the token conversion - NVDAx to vNVDAx vault shares"
- "Deposits are instant, withdrawals queue until epoch end to protect active positions"

---

#### Part 5: Faucet Demo (Optional - 30 seconds)

**Navigate to:** http://localhost:3000/v2/faucet

**Key talking points:**
- "For devnet testing, users can claim free NVDAx tokens here"
- "This lets anyone try the vault system without real assets"

---

#### Closing (30 seconds)

> "OptionsFi V2 brings automated yield generation to tokenized stocks. Our ERC-4626 style vaults, Pyth oracle integration, and covered call automation make institutional strategies accessible to everyone. Questions?"

---

### What's Working Well ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Main Dashboard | ✅ | Shows 5 vaults, TVL, APY, live indicators |
| NVDAx Vault | ✅ | Live with 100 tokens ($17,646 TVL) deposited |
| Oracle Integration | ✅ | 5/5 Pyth feeds healthy, real-time prices |
| Vault Detail Page | ✅ | TVL, epoch, utilization, Pyth pricing, payoff chart |
| Faucet | ✅ | Ready for token distribution |
| Portfolio | ✅ | Shows wallet connection prompt |
| Deposit Form | ✅ | Clean UX with share conversion display |

### Notes for Presenter

- **RFQ Status:** Shows "RFQ Offline" - just mention it's "institutional market maker integration coming in V2.1"
- **Loading States:** TVL may show $0 briefly before data loads - this is normal
- **Epoch Timer:** Shows countdown like "1d 18h" - great visual indicator

---

## Live Vaults on Devnet

| Vault | APY | Risk Profile | Features |
|-------|-----|--------------|----------|
| **NVDAx** | 12.4% | Normal | Main demo vault, $17K TVL |
| **TSLAx** | 18.6% | Aggressive | High volatility = higher premium |
| **AAPLx** | 8.2% | Conservative | Stable, lower risk |
| **SPYx** | 6.5% | Conservative | Index tracking |
| **METAx** | 15.2% | Normal | Tech sector exposure |

---

## Simulating Yield (Epoch Advancement)

### ⚠️ Important: Vault Authority Requirement

Each vault has an **authority** (the wallet that created it). Only the authority can advance epochs.

**Current Vault Authorities:**
| Vault | Authority | Can You Advance? |
|-------|-----------|------------------|
| NVDAx | `5cyhT...iLpX` | ❌ Need original deployer's key |
| TSLAx | TBD | Check with team |
| Your Vault | Your wallet | ✅ Yes |

### Option 1: Demo Without Epoch Advance

For demos, you can show the existing vault state and explain:
> "In production, our keeper service automatically advances epochs and distributes yield weekly."

The current NVDAx vault already shows:
- $17K+ TVL
- 80% utilization
- Live Pyth prices
- Epoch payoff chart

### Option 2: Create Your Own Vault (Full Control)

If you need to demonstrate epoch advancement:

```bash
# 1. Convert your Phantom key (if needed)
npx ts-node scripts/convert-phantom-key.ts YOUR_PHANTOM_KEY

# 2. Create your own vault
KEYPAIR=./my-wallet.json npx ts-node scripts/setup-demo-vault.ts

# 3. Add it to the frontend (optional)
# Edit app/lib/vault-sdk.ts to add your vault

# 4. Now you can advance epochs!
KEYPAIR=./my-wallet.json npx ts-node scripts/demo-epoch.ts --asset=YOUR_ASSET_ID --premium=2
```

### Option 3: Use Original Authority Key

If you have access to the wallet that deployed NVDAx (`5cyhTaQ5A7gxwF5zmpn4zJHsyiLBQV9ffPvtNPYNiLpX`):

```bash
KEYPAIR=/path/to/original-deployer-wallet.json npx ts-node scripts/demo-epoch.ts --asset=NVDAx --premium=1.5
```

---

## Setting Up Your Own Demo Vault (Optional)

If you want complete control for your own demo:

### 1. Export Your Phantom Private Key

In Phantom: Settings → Security & Privacy → Export Private Key

### 2. Convert to JSON Format

```bash
npx ts-node scripts/convert-phantom-key.ts YOUR_BASE58_KEY
```

This saves to `my-wallet.json` automatically.

### 3. Create Your Vault

```bash
KEYPAIR=./my-wallet.json npx ts-node scripts/setup-demo-vault.ts
```

This creates:
- A new token mint (you're the mint authority)
- A new vault for that token
- Mints initial tokens to your wallet

### 4. Add to Frontend

Edit `app/lib/vault-sdk.ts` to add your vault to the `VAULTS` object, then edit the page files to include your vault metadata.

---

## Environment Variables

### Frontend (`app/.env.local`)

```env
# Optional: Custom RPC (defaults to devnet)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# For faucet (if you're mint authority)
MINT_AUTHORITY_PRIVATE_KEY=[1,2,3,...your,key,array]
```

### Using Your Own Wallet for Scripts

```bash
# Use specific wallet file
KEYPAIR=./my-wallet.json npx ts-node scripts/demo-epoch.ts --asset=NVDAx --premium=1

# Use default Solana CLI wallet
npx ts-node scripts/demo-epoch.ts --asset=NVDAx --premium=1
```

---

## Troubleshooting

### "No wallet found"
```bash
solana-keygen new -o my-wallet.json
```

### "Insufficient SOL"
```bash
solana airdrop 2 $(solana-keygen pubkey my-wallet.json) --url devnet
```
Or use https://faucet.solana.com/

### "Transaction simulation failed: Blockhash not found"
Devnet issue - just retry the transaction.

### "Vault not found"
The vault might not be initialized. Use the existing NVDAx vault or create your own.

### Frontend not loading vault data
1. Check Phantom is on devnet
2. Hard refresh the page (Cmd+Shift+R)
3. Check browser console for errors

### Oracle showing "—" prices
Wait 5-10 seconds for Pyth to connect. Prices auto-refresh.

---

## Key URLs

| Resource | URL |
|----------|-----|
| Demo App | http://localhost:3000/v2 |
| NVDAx Vault | http://localhost:3000/v2/earn/nvdax |
| Oracle | http://localhost:3000/v2/oracle |
| Docs | http://localhost:3000/v2/docs |
| Solana Explorer | https://explorer.solana.com/?cluster=devnet |
| Pyth Price Feeds | https://pyth.network/price-feeds |
| Devnet Faucet | https://faucet.solana.com/ |

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Solana RPC    │
│   (Next.js)     │     │   (Devnet)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │  Vault Program  │
         │              │  (Anchor)       │
         │              └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Pyth Oracle   │     │   RFQ Program   │
│   (Price Feeds) │     │   (Quotes)      │
└─────────────────┘     └─────────────────┘
```

---

## What's Working vs Mock

| Feature | Status |
|---------|--------|
| Vault deposits | ✅ Real on-chain |
| Vault withdrawals | ✅ Real on-chain |
| Share token minting | ✅ Real on-chain |
| Oracle prices | ✅ Real Pyth feeds (5 assets) |
| Epoch payoff chart | ✅ Dynamic based on live prices |
| Strike price calculation | ✅ 10% OTM from Pyth spot |
| Epoch advancement | ✅ Real on-chain (manual trigger) |
| RFQ system | ⚠️ UI shows offline (router not running) |
| Market makers | ⚠️ Not connected |
| Automated keeper | ⚠️ Not running |

**For hackathon:** The core vault + oracle integration is fully functional. RFQ is shown as "offline" which is acceptable - explain it as "institutional market maker integration coming soon."

---

## Team Contact

Questions? Reach out on Discord/Slack.

**Good luck with the demo! 🎉**

# OptionsFi: How It Works

**A Comprehensive Guide for Investors and Users**

---

## Table of Contents

1. [Overview](#overview)
2. [What Are Covered Calls?](#what-are-covered-calls)
3. [How the Vault Works](#how-the-vault-works)
4. [Epoch Lifecycle](#epoch-lifecycle)
5. [Yield Generation](#yield-generation)
6. [Risk Profile](#risk-profile)
7. [User Journey](#user-journey)
8. [For Investors](#for-investors)
9. [Technical Architecture](#technical-architecture)
10. [Glossary](#glossary)

---

## Overview

OptionsFi is a **DeFi covered call vault** built on Solana. It enables users to earn yield on their xStock tokens (synthetic stock tokens) by automatically writing covered call options.

### Key Value Proposition

| For Users | For Investors |
|-----------|---------------|
| Passive yield on idle stock tokens | Novel DeFi primitive for tokenized equities |
| Professional-grade options strategies | Institutional RFQ infrastructure |
| No options knowledge required | Scalable vault architecture |
| Transparent on-chain execution | Multiple revenue streams (fees, spreads) |

---

## What Are Covered Calls?

A **covered call** is an options strategy where you:

1. **Own** an underlying asset (e.g., NVDA stock)
2. **Sell** a call option against that asset
3. **Collect** a premium (upfront payment) from the buyer
4. **Agree** to sell your asset at a fixed "strike" price if exercised

### Example: NVDAx Covered Call

```
You own: 100 NVDAx (worth $17,710 at $177.10/share)
You sell: 1 call option with strike $195 expiring in 7 days
You receive: $150 premium (0.85% yield)

Scenarios at expiry:
├── NVDA at $180 → Keep shares + $150 premium ✅
├── NVDA at $190 → Keep shares + $150 premium ✅
└── NVDA at $200 → Sell shares at $195, keep $150 premium (missed $5 upside) ⚠️
```

### Why Covered Calls?

- **Income Generation**: Collect premiums regardless of price movement
- **Reduced Volatility**: Premium cushions small downturns
- **Defined Risk**: You already own the underlying, no unlimited loss

---

## How the Vault Works

The OptionsFi vault automates covered call writing for depositors.

### Vault Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         VAULT LIFECYCLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [User Deposits NVDAx]                                         │
│          │                                                      │
│          ▼                                                      │
│   ┌──────────────┐                                              │
│   │  Vault Pool  │ ◄── Holds all deposited xStock tokens        │
│   └──────┬───────┘                                              │
│          │                                                      │
│          ▼                                                      │
│   [Epoch Starts - Vault Writes Covered Calls]                   │
│          │                                                      │
│          ▼                                                      │
│   ┌──────────────┐     RFQ Request      ┌───────────────────┐   │
│   │   RFQ Router │ ──────────────────►  │  Market Makers    │   │
│   └──────┬───────┘                      └─────────┬─────────┘   │
│          │                                        │             │
│          │◄───────── Premium Quotes ──────────────┘             │
│          │                                                      │
│          ▼                                                      │
│   [Best Quote Accepted - Premium Received]                      │
│          │                                                      │
│          ▼                                                      │
│   [Epoch Ends - Options Settle]                                 │
│          │                                                      │
│          ├── If ITM: Vault pays difference                      │
│          └── If OTM: Vault keeps all premium                    │
│          │                                                      │
│          ▼                                                      │
│   [User Withdraws Principal + Yield]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Description |
|-----------|-------------|
| **Vault** | Smart contract holding deposited tokens |
| **Share Token** | Receipt token (vNVDAx) representing your vault share |
| **RFQ Router** | Off-chain service aggregating quotes from market makers |
| **Oracle** | Pyth price feed providing real-time stock prices |

---

## Epoch Lifecycle

The vault operates in **epochs** - fixed time periods during which options are active.

### Epoch Timeline (7 Days)

```
Day 0: Epoch Start
├── Deposits accepted
├── Strike price calculated (Spot + 10% OTM)
├── RFQ broadcast to market makers
└── Best quote accepted, premium collected

Days 1-6: Epoch Active
├── Options positions open
├── Price monitored via Pyth oracle
├── New deposits queue for next epoch
└── Withdrawals locked

Day 7: Epoch Settlement
├── Options settle based on final price
├── Premium distributed to depositors
├── Withdrawals processed
└── Next epoch begins
```

### Deposit/Withdrawal Cycle

| Action | When Available |
|--------|----------------|
| Deposit | Anytime (enters next epoch) |
| Request Withdrawal | Anytime |
| Claim Withdrawal | After epoch ends |
| Receive Yield | After epoch ends |

---

## Yield Generation

### Where Does Yield Come From?

The yield comes from **option premiums** paid by market makers who want to buy call options.

```
Premium Formula (Simplified):

Premium = Notional × Base Rate × Time Factor × Volatility Factor

Where:
- Notional = Value of options sold
- Base Rate = ~0.5-1.5% per week
- Time Factor = √(days to expiry / 7)
- Volatility Factor = Higher volatility = higher premium
```

### Expected Returns

| Market Condition | Weekly Premium | Annualized APY |
|------------------|---------------|----------------|
| Low Volatility | 0.3-0.5% | 15-25% |
| Normal Volatility | 0.8-1.2% | 40-60% |
| High Volatility | 1.5-2.5% | 75-130% |

**Note**: These are estimates. Actual yields depend on market conditions.

### Fee Structure

| Fee | Rate | Description |
|-----|------|-------------|
| Management Fee | 0% | No ongoing fees |
| Performance Fee | 10% | On premium earned |
| Withdrawal Fee | 0% | No exit fees |

---

## Risk Profile

### Risks to Understand

#### 1. Upside Cap Risk (Primary Risk)
When the underlying rises above the strike price, you miss gains beyond the strike.

```
Example:
- You deposit at $177
- Strike set at $195 (10% OTM)
- Price rises to $220

Your Return: ($195 - $177) + Premium = ~13% ✅
Max Possible: ($220 - $177) = 24% ❌

Missed Upside: ~11%
```

#### 2. Downside Risk (Same as Holding)
If the underlying drops, your tokens lose value. The premium provides a small buffer.

```
Example:
- Deposit at $177
- Price drops to $150
- Premium earned: $5

Your Loss: ($177 - $150) - $5 = $22 (12.4%)
Without Vault: $27 (15.3%)

Premium cushioned loss by 2.9%
```

#### 3. Liquidity Risk
Withdrawals are only available at epoch end. You cannot exit mid-epoch.

#### 4. Smart Contract Risk
Bugs in the protocol could result in loss of funds. Code is audited and open-source.

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Upside Cap | 10% OTM strikes allow significant upside |
| Downside | Premium income cushions drops |
| Liquidity | 7-day epochs, not long lock-ups |
| Smart Contract | Audits, open-source, insurance pools |

---

## User Journey

### Step 1: Get xStock Tokens

Obtain NVDAx (or other xStock) tokens through:
- Minting on Devnet (testing)
- Purchasing on DEXs (future)
- Bridging from other chains (future)

### Step 2: Connect Wallet

1. Visit the OptionsFi app
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Ensure you're on the correct network (Devnet for testing)

### Step 3: Deposit into Vault

1. Navigate to a vault (e.g., NVDAx Vault)
2. Enter the amount to deposit
3. Approve the transaction
4. Receive vault shares (vNVDAx)

### Step 4: Monitor Your Position

- Track your share balance
- View estimated premium for current epoch
- Check time until epoch end

### Step 5: Withdraw

1. Request withdrawal during an epoch
2. Wait for epoch to end
3. Claim your tokens + accumulated yield

---

## For Investors

### Market Opportunity

| Metric | Value |
|--------|-------|
| Total Stock Options Market | $12T+ notional |
| DeFi Options TVL | $500M+ |
| Covered Call Strategy AUM (TradFi) | $100B+ |
| Tokenized Equities Market (Growing) | $500M+ |

### Why OptionsFi?

1. **First Mover**: First covered call vault for tokenized equities on Solana
2. **Institutional Infrastructure**: RFQ system enables real market maker participation
3. **Scalable Architecture**: Vault structure extends to any tokenized asset
4. **Regulatory Clarity**: Options on synthetic assets, not securities

### Revenue Model

| Revenue Stream | Description |
|----------------|-------------|
| Performance Fees | 10% of premium earned |
| Spread Capture | Difference between bid/ask quotes |
| Market Making | LP for options order book (future) |

### Competitive Landscape

| Protocol | Chain | Strategy | Difference |
|----------|-------|----------|------------|
| Ribbon Finance | Ethereum | DOV on crypto | High gas, crypto-only |
| Friktion | Solana (deprecated) | DOV vaults | Shut down |
| Lyra | Optimism | Options AMM | No covered call vaults |
| **OptionsFi** | Solana | xStock covered calls | Equities focus, RFQ |

### Technical Moat

- **Pyth Integration**: Real-time, reliable stock price feeds
- **RFQ Router**: Institutional quote aggregation
- **Anchor Framework**: Battle-tested smart contract framework
- **Multi-asset**: Architecture supports any xStock token

---

## Technical Architecture

### Smart Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| Vault | `8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY` | Core vault logic, deposits, withdrawals |
| RFQ | `3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z` | Request-for-quote on-chain settlement |
| Oracle Reader | `Pyth Network` | Price feed integration |

### Off-Chain Infrastructure

| Service | Purpose |
|---------|---------|
| RFQ Router | Aggregates quotes from market makers |
| Price Publisher | Fetches and caches Pyth prices |
| Keeper | Triggers epoch transitions, settlements |

### Data Flow

```
Pyth Oracle ──► Price Reader ──► Vault Contract
                                      │
Market Makers ◄──► RFQ Router ◄───────┘
                       │
                       ▼
                 Quote Selection
                       │
                       ▼
               Premium Settlement
```

---

## Glossary

| Term | Definition |
|------|------------|
| **xStock** | Synthetic stock token on Solana (e.g., NVDAx for NVIDIA) |
| **Covered Call** | Options strategy: sell calls against owned stock |
| **Strike Price** | Price at which option buyer can exercise |
| **OTM (Out-of-the-Money)** | Strike is above current price (for calls) |
| **Premium** | Payment received for selling an option |
| **Epoch** | Fixed period during which options are active |
| **Vault Share (vToken)** | Receipt token representing deposit ownership |
| **RFQ** | Request-for-Quote: mechanism to get competitive quotes |
| **Settlement** | Final resolution of options at expiry |
| **Pyth** | Oracle network providing price feeds |
| **TVL** | Total Value Locked: assets deposited in protocol |
| **APY** | Annualized Percentage Yield: projected yearly return |

---

## Contact & Resources

- **Website**: [Coming Soon]
- **Documentation**: [V2_README.md](./V2_README.md)
- **GitHub**: [xstock-options](https://github.com/feeniks01/xstock-options)
- **Twitter**: [Coming Soon]
- **Discord**: [Coming Soon]

---

**Disclaimer**: This document is for informational purposes only. Covered call strategies involve risk. Past performance does not guarantee future results. Not financial advice.

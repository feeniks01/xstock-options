# Financial Modeling & Calculations Audit

> **Last Updated:** December 5, 2025  
> **Purpose:** Document all financial calculations, data sources, and identify any mocked/synthetic data

---

## Table of Contents

1. [Data Sources](#1-data-sources)
2. [Black-Scholes Option Pricing](#2-black-scholes-option-pricing)
3. [Greeks Calculations](#3-greeks-calculations)
4. [Implied Volatility Calculations](#4-implied-volatility-calculations)
5. [Historical Volatility Calculations](#5-historical-volatility-calculations)
6. [Volatility Surface Adjustments](#6-volatility-surface-adjustments)
7. [Synthetic/Estimated Data](#7-syntheticestimated-data)
8. [Constants & Assumptions](#8-constants--assumptions)
9. [Audit Summary](#9-audit-summary)

---

## 1. Data Sources

### 1.1 Real Data Sources ✅

| Data                       | Source        | API                    | Refresh Rate                    |
|----------------------------|---------------|------------------------|---------------------------------|
| xStock Spot Price          | Bitquery      | GraphQL Streaming API  | Real-time (configurable 15s-5m) |
| xStock Trade History       | Bitquery      | DEXTradeByTokens query | Per request                     |
| xStock OHLC Candles        | Bitquery      | Aggregated from trades | Per interval                    |
| xStock Volume (24h)        | Bitquery      | Aggregated USD volume  | Per request                     |
| xStock Token Supply        | Bitquery      | TokenSupplyUpdates     | Per request                     |
| NVDA Stock Prices          | Yahoo Finance | `yahoo-finance2` npm   | Cached 24 hours                 |
| NVDA Historical Volatility | Yahoo Finance | Calculated from prices | Cached 24 hours                 |

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REAL DATA SOURCES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Yahoo Finance (NVDA)              Bitquery (xStock)                │
│  ├─ 120-day price history          ├─ Real-time trades              │
│  ├─ Daily OHLC                     ├─ Trade prices (PriceInUSD)     │
│  └─ Volume data                    ├─ 24h volume                    │
│         │                          └─ Token supply                  │
│         │                                   │                       │
│         ▼                                   ▼                       │
│  ┌──────────────┐                  ┌──────────────┐                 │
│  │ Calculate HV │                  │ Current Price│                 │
│  │ (10/20/30/   │                  │ OHLC, Volume │                 │
│  │  60/90 day)  │                  │ Market Cap   │                 │
│  └──────┬───────┘                  └───────┬──────┘                 │
│         │                                  │                        │
│         ▼                                  ▼                        │
│  ┌──────────────┐                  ┌──────────────┐                 │
│  │  Base IV     │───────┬──────────│ Options Chain│                 │
│  │  (~41.7%)    │       │          │ Strike Grid  │                 │
│  └──────────────┘       │          └──────────────┘                 │
│                         │                                           │
│                         ▼                                           │
│              ┌─────────────────────┐                                │
│              │  BLACK-SCHOLES      │                                │
│              │  Option Pricing     │                                │
│              │  + Greeks           │                                │
│              └─────────────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Black-Scholes Option Pricing

### 2.1 Call Option Formula

**File:** `app/lib/options-math.ts` → `blackScholesCall()`

```
C = S × e^(-qT) × N(d₁) - K × e^(-rT) × N(d₂)
```

Where:
- `C` = Call option price
- `S` = Spot price (from Bitquery xStock data) ✅ REAL
- `K` = Strike price (user-selected or generated grid)
- `r` = Risk-free rate (hardcoded 5%) ⚠️ CONSTANT
- `q` = Dividend yield (default 0) ⚠️ ASSUMPTION
- `T` = Time to expiration in years
- `N(x)` = Standard normal CDF

### 2.2 Put Option Formula

**File:** `app/lib/options-math.ts` → `blackScholesPut()`

```
P = K × e^(-rT) × N(-d₂) - S × e^(-qT) × N(-d₁)
```

### 2.3 d₁ and d₂ Calculations

**File:** `app/lib/options-math.ts` → `calculateD1D2()`

```
d₁ = [ln(S/K) + (r - q + σ²/2) × T] / (σ × √T)

d₂ = d₁ - σ × √T
```

Where:
- `σ` = Implied volatility (from NVDA HV + adjustments) ✅ REAL-BASED
- `ln` = Natural logarithm

### 2.4 Normal Distribution Functions

**File:** `app/lib/options-math.ts`

#### Standard Normal CDF (N(x))
```typescript
function normCdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2));
}
```

#### Error Function (erf) - Abramowitz-Stegun Approximation
```typescript
// Maximum error: 1.5 × 10^−7
function erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    // ... implementation
}
```

---

## 3. Greeks Calculations

**File:** `app/lib/options-math.ts` → `callGreeks()` / `putGreeks()`

### 3.1 Delta (Δ)

Rate of change of option price with respect to underlying price.

**Call Delta:**
```
Δ_call = e^(-qT) × N(d₁)
```

**Put Delta:**
```
Δ_put = -e^(-qT) × N(-d₁)
```

### 3.2 Gamma (Γ)

Rate of change of delta with respect to underlying price.

```
Γ = e^(-qT) × n(d₁) / (S × σ × √T)
```

Where `n(x)` is the standard normal PDF:
```
n(x) = (1/√(2π)) × e^(-x²/2)
```

### 3.3 Theta (Θ)

Rate of change of option price with respect to time (time decay).

**Call Theta (per day):**
```
Θ_call = [-S × e^(-qT) × n(d₁) × σ / (2√T) 
          - r × K × e^(-rT) × N(d₂) 
          + q × S × e^(-qT) × N(d₁)] / 365
```

**Put Theta (per day):**
```
Θ_put = [-S × e^(-qT) × n(d₁) × σ / (2√T) 
         + r × K × e^(-rT) × N(-d₂) 
         - q × S × e^(-qT) × N(-d₁)] / 365
```

### 3.4 Vega (ν)

Rate of change of option price with respect to volatility.

```
ν = S × e^(-qT) × √T × n(d₁) / 100
```
(Divided by 100 to express per 1% IV change)

### 3.5 Rho (ρ)

Rate of change of option price with respect to interest rate.

**Call Rho:**
```
ρ_call = K × T × e^(-rT) × N(d₂) / 100
```

**Put Rho:**
```
ρ_put = -K × T × e^(-rT) × N(-d₂) / 100
```

---

## 4. Implied Volatility Calculations

### 4.1 Bisection Method

**File:** `app/lib/options-math.ts` → `impliedVolBisection()`

Used to reverse-engineer IV from observed option market prices.

```
Algorithm:
1. Set bounds: low = 0.0001 (0.01%), high = 5.0 (500%)
2. For each iteration:
   a. mid = (low + high) / 2
   b. price = BlackScholes(S, K, r, mid, T)
   c. If |price - marketPrice| < tolerance: return mid
   d. If price > marketPrice: high = mid
   e. Else: low = mid
3. Return best guess after maxIterations
```

**Parameters:**
- `tolerance`: 0.0001 (default)
- `maxIterations`: 100 (default)

### 4.2 Newton-Raphson Method (Alternative)

**File:** `app/lib/options-math.ts` → `impliedVolNewtonRaphson()`

Faster convergence using vega as derivative:

```
σ_new = σ - (BS_price - market_price) / vega
```

**Initial guess:** Brenner-Subrahmanyam approximation:
```
σ₀ = √(2π/T) × (market_price / S)
```

---

## 5. Historical Volatility Calculations

### 5.1 NVDA Historical Volatility

**File:** `app/lib/nvda-volatility.ts` → `calculateHV()`

**Data Source:** Yahoo Finance (REAL) ✅

```
Algorithm:
1. Get closing prices for period (10/20/30/60/90 days)
2. Calculate log returns: r_i = ln(P_i / P_{i-1})
3. Calculate mean return: μ = Σr_i / n
4. Calculate sample variance: σ² = Σ(r_i - μ)² / (n-1)
5. Standard deviation: σ_daily = √σ²
6. Annualize: σ_annual = σ_daily × √252
```

**Annualization Factor:** √252 (trading days per year)

### 5.2 Weighted Base IV

**File:** `app/lib/nvda-volatility.ts`

```typescript
// Weighted HV calculation
const weightedHV = hv10 * 0.25 + hv20 * 0.30 + hv30 * 0.25 + hv60 * 0.15 + hv90 * 0.05;

// IV Premium (IV typically > HV by 10-30%)
const IV_PREMIUM = 0.15; // 15%

// Final Base IV
const baseIV = weightedHV * (1 + IV_PREMIUM);
```

### 5.3 xStock Historical Volatility (Fallback)

**File:** `app/app/api/price/route.ts` → `calculateHistoricalVolatility()`

**Data Source:** Bitquery candle data (REAL) ✅

Same algorithm as NVDA HV, but using xStock trade data.

**Note:** xStock HV is often unreliable due to sparse trading data. NVDA data is preferred.

---

## 6. Volatility Surface Adjustments

### 6.1 Term Structure Adjustment

**File:** `app/lib/options-math.ts` → `adjustIVForSmile()`

Short-term options have higher IV due to gamma/event risk.

| Days to Expiry | IV Multiplier     |
|----------------|-------------------|
| < 1 day        | ×1.50 (+50%)      |
| 1-7 days       | ×1.25 (+25%)      |
| 7-30 days      | ×1.10 (+10%)      |
| 30-90 days     | ×1.00 (no change) |
| > 90 days      | ×0.95 (-5%)       |

### 6.2 Volatility Smile/Skew Adjustment

**File:** `app/lib/options-math.ts` → `adjustIVForSmile()`

OTM options (especially puts) have elevated IV.

```typescript
const moneyness = strike / spot;
const logMoneyness = Math.log(moneyness);
const moneynessDistance = Math.abs(logMoneyness);

// Put skew (crash protection premium)
if (type === 'put' && moneyness < 1) {
    iv *= 1 + moneynessDistance * 3.5;  // OTM put
} else if (type === 'put') {
    iv *= 1 + moneynessDistance * 0.8;  // ITM put
}

// Call smile
if (type === 'call' && moneyness > 1) {
    iv *= 1 + moneynessDistance * 2.0;  // OTM call
} else if (type === 'call') {
    iv *= 1 + moneynessDistance * 0.5;  // ITM call
}
```

### 6.3 IV Bounds

**File:** `app/lib/options-math.ts`

```typescript
// Minimum IV floor (before adjustments)
const MIN_BASE_IV = 0.30; // 30%

// Final bounds (after all adjustments)
return Math.max(0.20, Math.min(3.0, iv)); // 20% to 300%
```

---

## 7. Synthetic/Estimated Data

### ⚠️ Items That Are NOT Real Market Data

| Item                        | Current Value   | Source     | Notes                                     |
|-----------------------------|-----------------|------------|-------------------------------------------|
| **Risk-Free Rate**          | 5.0%            | Hardcoded  | Should be fetched from Treasury rates     |
| **Dividend Yield**          | 0%              | Default    | NVDA pays ~0.03% dividend, negligible     |
| **Bid/Ask Spread**          | 1.5-7% of mid   | Calculated | Based on moneyness formula                |
| **Strike Grid**             | $5 intervals    | Generated  | Not from real order book                  |
| **Expiration Dates**        | 15m to 1 month  | Predefined | Synthetic expiry schedule                 |
| **Volume/OI**               | 0 or from chain | Mixed      | Only real for on-chain options            |
| **52-Week Range**           | ±30% of current | Estimated  | `high * 1.3`, `low * 0.7`                 |
| **Performance (1w/1m/ytd)** | Extrapolated    | Calculated | Based on 1d change × multiplier           |
| **Market Depth Bar**        | Sentiment-based | Synthetic  | `bidPercent = priceChange >= 0 ? 58 : 42` |

### 7.1 Bid/Ask Spread Calculation

**File:** `app/app/stock/components/OptionsChain.tsx` → `generateOptionData()`

```typescript
const moneyness = Math.abs(currentPrice - strike) / currentPrice;
const timeAdjustment = T < 0.01 ? 1.5 : T < 0.05 ? 1.2 : 1.0;
const spreadPct = (0.015 + moneyness * 0.04) * timeAdjustment;
const spread = Math.max(0.01, price * spreadPct);

const bid = Math.max(0.01, mid - spread / 2);
const ask = mid + spread / 2;
```

### 7.2 Last Trade Price

**File:** `app/app/stock/components/OptionsChain.tsx`

```typescript
// Synthetic with small random variation
last = mid + (Math.random() - 0.5) * spread * 0.3;
```

⚠️ **This is synthetic data** - real last trade would come from on-chain history.

---

## 8. Constants & Assumptions

### 8.1 Hardcoded Constants

**File:** `app/lib/options-math.ts`

```typescript
export const DEFAULT_RISK_FREE_RATE = 0.05; // 5% annual
```

**File:** `app/lib/nvda-volatility.ts`

```typescript
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const IV_PREMIUM = 0.15; // 15% over HV
```

**File:** `app/app/api/price/route.ts`

```typescript
const CACHE_TTL = 8000; // 8 seconds for price cache
const spreadBps = 10; // 10 basis points spread estimate
```

### 8.2 Trading Day Assumptions

| Context                | Value    | Notes                     |
|------------------------|----------|---------------------------|
| Annualization (NVDA)   | 252 days | Standard US equity market |
| Annualization (xStock) | 365 days | Crypto trades 24/7        |
| Hours per day (xStock) | 24       | Continuous trading        |

---

## 9. Audit Summary

### ✅ Real Data (Verified)

1. **xStock Spot Price** - Bitquery DEXTradeByTokens
2. **xStock OHLC** - Aggregated from real trades
3. **xStock Volume** - Sum of AmountInUSD
4. **xStock Market Cap** - Token supply × price
5. **NVDA Historical Prices** - Yahoo Finance chart API
6. **NVDA Historical Volatility** - Calculated from real prices
7. **On-Chain Option Prices** - From Solana program accounts

### ⚠️ Derived/Estimated Data

1. **Base IV** - NVDA HV + 15% premium (reasonable estimate)
2. **Term Structure** - Industry-standard adjustments
3. **Volatility Smile** - Realistic but not from options market
4. **Bid/Ask Spread** - Formula-based, not real order book

### ❌ Synthetic/Mocked Data

1. **Risk-Free Rate** - Hardcoded 5%
2. **Strike Grid** - Generated, not from real order book
3. **Expiry Schedule** - Predefined intervals
4. **52-Week Range** - Estimated ±30%
5. **Performance Metrics** - Extrapolated from 1-day change
6. **Last Trade Price** - Random variation around mid
7. **Volume/OI for Synthetic Options** - Zero (honest)

### Recommendations for Production

1. **Risk-Free Rate**: Fetch from Treasury yield API (e.g., FRED)
2. **Real Options IV**: Use Tradier or CBOE API for actual NVDA options IV
3. **Order Book**: Integrate real DEX order book for bid/ask
4. **Historical Data**: Store on-chain option trade history for accurate volume/OI

---

## Appendix: File References

| File | Purpose |
|--------------------------------------------|-------------------------------------------|
| `app/lib/options-math.ts`                  | Black-Scholes, Greeks, IV calculations    |
| `app/lib/nvda-volatility.ts`               | Yahoo Finance integration, HV calculation |
| `app/app/api/price/route.ts`               | Bitquery integration, price API           |
| `app/app/api/nvda-volatility/route.ts`     | NVDA volatility API endpoint              |
| `app/app/stock/components/OptionsChain.tsx`| Options chain generation                  |
| `app/types/stock.ts`                       | Type definitions                          |
| `app/utils/constants.ts`                   | xStock mint addresses                     |

---

*This document should be updated whenever financial calculations are modified.*

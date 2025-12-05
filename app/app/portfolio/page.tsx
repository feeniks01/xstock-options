"use client";

import React from "react";
import { useMemo, useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { getProgram } from "../../anchor/setup";
import { XSTOCKS } from "../../utils/constants";
import { StockData } from "../../types/stock";
import { priceOption, DEFAULT_RISK_FREE_RATE, normCdf, calculateD1D2 } from "../../lib/options-math";

type PositionData = {
  symbol: string;
  label: string;
  side: "BUYER" | "SELLER";
  contracts: number;
  status: "OPEN" | "EXERCISED" | "EXPIRED";
  optionPrice: number;
  optionPriceChange: number;
  optionPriceChangePct: number;
  positionValue: number;
  creditToClose: number;
  marketValueTheoretical: number;
  costBasis: number;
  totalPnL: number;
  totalPnLPct: number;
  dailyPnL?: number;
  underlyingPrice: number;
  strikePrice: number;
  expirationDate: string;
  breakevenPrice: number;
  contractsCount: number;
  avgCostPerShare: number;
  dateBought?: string; // Date when position was acquired
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  impliedVol: number;
  ivRank: number;
  probITM: number;
  probOTM: number;
  probProfit: number;
  daysToExpiry: number;
  thetaProjection?: {
    today: number;
    in30Days: number;
    in90Days: number;
  };
};

type CloseOrder = {
  side: "SELL_TO_CLOSE" | "BUY_TO_CLOSE";
  orderType: "MARKET" | "LIMIT" | "MID";
  limitPrice?: number;
  quantity: number;
};



export default function PortfolioPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const stock = XSTOCKS[0]; // Use first stock (NVDAx)

  // State
  const [userPositions, setUserPositions] = useState<any[]>([]);
  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [positionData, setPositionData] = useState<PositionData | null>(null);

  const [order, setOrder] = useState<CloseOrder>({
    side: "SELL_TO_CLOSE",
    orderType: "LIMIT",
    limitPrice: 0,
    quantity: 1,
  });

  // Fetch positions from blockchain
  const fetchUserPositions = async () => {
    if (!wallet.publicKey) {
      setIsLoading(false);
      return;
    }
    try {
      const program = getProgram(connection, wallet);
      // @ts-ignore
      const accountClient = program.account.coveredCall || program.account.CoveredCall;
      if (!accountClient) {
        console.error("Could not find coveredCall or CoveredCall in program.account");
        setIsLoading(false);
        return;
      }
      const memcmpResult = accountClient.coder.accounts.memcmp("coveredCall");
      const discriminator = memcmpResult.bytes ? memcmpResult.bytes : memcmpResult;
      const discriminatorEncoded = typeof discriminator === 'string' ? discriminator : bs58.encode(discriminator);

      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: discriminatorEncoded
            }
          }
        ]
      });

      // Fetch account info to get creation time
      const accountInfos = await Promise.all(
        accounts.map(async (acc) => {
          try {
            const accountInfo = await connection.getAccountInfo(acc.pubkey);
            return {
              account: acc.account,
              pubkey: acc.pubkey,
              accountInfo: accountInfo
            };
          } catch (e) {
            return null;
          }
        })
      );

      const allCalls = accountInfos.map((accInfo) => {
        if (!accInfo) return null;
        try {
          if (accInfo.account.data.length < 173) {
            return null;
          }
          return {
            publicKey: accInfo.pubkey,
            account: accountClient.coder.accounts.decode("coveredCall", accInfo.account.data),
            accountInfo: accInfo.accountInfo // Store account info for creation time
          };
        } catch (e) {
          return null;
        }
      }).filter(a => a !== null);

      // Filter to only show positions for the current stock's mint that belong to the user
      // Ownership logic:
      // - If you're the seller AND there's no buyer → you own it (you wrote it and haven't sold it)
      // - If you're the buyer → you own it
      // - If you're the seller AND there's a buyer → you DON'T own it (you sold it to someone else)
      const positions = allCalls.filter((a: any) => {
        if (a.account.xstockMint.toString() !== stock.mint.toString()) return false;
        
        const isSeller = a.account.seller.toString() === wallet.publicKey?.toString();
        const isBuyer = a.account.buyer?.toString() === wallet.publicKey?.toString();
        const hasBuyer = a.account.buyer !== null;
        
        // You own it if:
        // 1. You're the buyer (you bought it)
        // 2. You're the seller AND there's no buyer (you wrote it and haven't sold it)
        return isBuyer || (isSeller && !hasBuyer);
      });

      // Filter to only open positions
      const openPositions = positions.filter((pos: any) => {
        const isBuyer = pos.account.buyer?.toString() === wallet.publicKey?.toString();
        const isExercised = pos.account.exercised;
        const isExpired = new Date() > new Date(pos.account.expiryTs.toNumber() * 1000);

        if (isBuyer) {
          // Buyers: show if not exercised and not expired
          return !isExercised && !isExpired;
        } else {
          // Sellers (who haven't sold): show if not exercised
          return !isExercised;
        }
      });

      setUserPositions(openPositions);
      
      // Auto-select first position if available
      if (openPositions.length > 0 && selectedPositionIndex === null) {
        setSelectedPositionIndex(0);
      }
    } catch (e) {
      console.error("Error fetching positions:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stock price
  const fetchStockPrice = async () => {
    try {
      const priceMint = stock.priceMint || stock.mint;
      const params = new URLSearchParams({
        mint: priceMint.toBase58(),
        symbol: stock.symbol,
        name: stock.name,
        interval: "1D",
      });
      const res = await fetch(`/api/price?${params}`);
      const data: StockData = await res.json();

      if (data.error) {
        console.error("Price API error:", data.error);
        return;
      }

      setStockData(data);
    } catch (err) {
      console.error("Failed to fetch price:", err);
    }
  };

  // Transform position to PositionData
  const transformPositionToData = (position: any, currentPrice: number): PositionData | null => {
    if (!position || !currentPrice) return null;

    const strike = position.account.strike.toNumber() / 100_000_000;
    const premium = position.account.premium.toNumber() / 1_000_000;
    const expiry = new Date(position.account.expiryTs.toNumber() * 1000);
    const contracts = position.account.amount 
      ? position.account.amount.toNumber() / (100 * 1_000_000)
      : 1;
    
    // Determine ownership: buyer takes precedence over seller
    const isBuyer = position.account.buyer?.toString() === wallet.publicKey?.toString();
    const isSeller = position.account.seller.toString() === wallet.publicKey?.toString() && !isBuyer;
    const isExercised = position.account.exercised;
    const isExpired = new Date() > expiry;
    
    // Get date bought: use account creation time if available
    let dateBought: string | undefined;
    if (position.accountInfo) {
      // Account creation time is not directly available, but we can estimate from rent epoch
      // For now, we'll try to get it from the account's slot or use a fallback
      // In a production system, you'd fetch the transaction signature when the account was created
      try {
        // Try to get the transaction that created this account
        // For now, we'll leave it undefined and show "N/A" in the UI
        // TODO: Fetch creation transaction signature to get accurate date
      } catch (e) {
        // Fallback: leave undefined
      }
    }
    
    const status: "OPEN" | "EXERCISED" | "EXPIRED" = isExercised ? "EXERCISED" : isExpired ? "EXPIRED" : "OPEN";

    // Calculate time to expiry in years
    const now = new Date();
    const timeToExpiryMs = expiry.getTime() - now.getTime();
    const T = Math.max(0, timeToExpiryMs / (365 * 24 * 60 * 60 * 1000));

    // Get base IV from stock data (historical volatility)
    const baseIV = stockData?.historicalVolatility?.baseIV || 0.35;

    // Calculate option pricing with Greeks
    const optionPricing = priceOption(
      currentPrice,
      strike,
      DEFAULT_RISK_FREE_RATE,
      baseIV,
      T,
      'call'
    );

    // Cost basis calculations
    const costPerShare = premium;
    const costBasis = costPerShare * 100 * contracts;
    const optionPricePerShare = optionPricing.price;
    const marketValue = optionPricePerShare * 100 * contracts;

    // PnL calculations
    const totalPnL = isSeller
      ? costBasis - marketValue // Seller profits if option value decreases
      : marketValue - costBasis; // Buyer profits if option value increases
    const totalPnLPct = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0;

    // Price change from entry
    const optionPriceChange = optionPricePerShare - costPerShare;
    const optionPriceChangePct = costPerShare > 0 ? (optionPriceChange / costPerShare) * 100 : 0;

    // Breakeven
    const breakevenPrice = isSeller ? strike - costPerShare : strike + costPerShare;

    // Days to expiry
    const daysToExpiry = Math.max(0, Math.ceil(timeToExpiryMs / (24 * 60 * 60 * 1000)));

    // Calculate probabilities using Black-Scholes
    const params = {
      S: currentPrice,
      K: strike,
      r: DEFAULT_RISK_FREE_RATE,
      sigma: optionPricing.iv,
      T: T
    };
    const { d2 } = calculateD1D2(params);
    
    // Probability ITM = N(d2) for calls
    const probITM = T > 0 ? normCdf(d2) : (currentPrice > strike ? 1 : 0);
    const probOTM = 1 - probITM;

    // Probability of profit: probability that underlying > breakeven at expiry
    const probProfitParams = {
      S: currentPrice,
      K: breakevenPrice,
      r: DEFAULT_RISK_FREE_RATE,
      sigma: optionPricing.iv,
      T: T
    };
    const { d2: d2Profit } = calculateD1D2(probProfitParams);
    const probProfit = T > 0 ? normCdf(d2Profit) : (currentPrice > breakevenPrice ? 1 : 0);

    // IV Rank (simplified - would need historical IV data for accurate calculation)
    const ivRank = Math.min(1, Math.max(0, (optionPricing.iv - 0.1) / 0.4)); // Normalize between 0-1 assuming IV range 10-50%

    // Theta projection (simulate theta at different time points)
    const thetaProjection = T > 0 ? {
      today: optionPricing.theta * 100 * contracts,
      in30Days: T > 30/365 ? (() => {
        const theta30 = priceOption(currentPrice, strike, DEFAULT_RISK_FREE_RATE, baseIV, T - 30/365, 'call');
        return theta30.theta * 100 * contracts;
      })() : 0,
      in90Days: T > 90/365 ? (() => {
        const theta90 = priceOption(currentPrice, strike, DEFAULT_RISK_FREE_RATE, baseIV, T - 90/365, 'call');
        return theta90.theta * 100 * contracts;
      })() : 0,
    } : undefined;

    return {
      symbol: stock.symbol,
      label: `${stock.symbol} $${strike.toFixed(0)} Call`,
      side: isBuyer ? "BUYER" : "SELLER",
      contracts: contracts,
      status: status,
      optionPrice: optionPricePerShare,
      optionPriceChange: optionPriceChange,
      optionPriceChangePct: optionPriceChangePct,
      positionValue: marketValue,
      creditToClose: marketValue,
      marketValueTheoretical: marketValue,
      costBasis: costBasis,
      totalPnL: totalPnL,
      totalPnLPct: totalPnLPct,
      dailyPnL: undefined, // Would need previous day's price
      underlyingPrice: currentPrice,
      strikePrice: strike,
      expirationDate: expiry.toISOString().split('T')[0],
      breakevenPrice: breakevenPrice,
      contractsCount: contracts,
      avgCostPerShare: costPerShare,
      dateBought: dateBought, // Will be undefined for now, shown as "N/A" in UI
      delta: optionPricing.delta,
      gamma: optionPricing.gamma,
      theta: optionPricing.theta,
      vega: optionPricing.vega,
      impliedVol: optionPricing.iv,
      ivRank: ivRank,
      probITM: probITM,
      probOTM: probOTM,
      probProfit: probProfit,
      daysToExpiry: daysToExpiry,
      thetaProjection: thetaProjection,
    };
  };

  // Update position data when selection or stock price changes
  useEffect(() => {
    if (selectedPositionIndex !== null && userPositions[selectedPositionIndex] && stockData) {
      const pos = transformPositionToData(userPositions[selectedPositionIndex], stockData.currentPrice);
      setPositionData(pos);
      
      if (pos) {
        setOrder({
          side: pos.side === "SELLER" ? "BUY_TO_CLOSE" : "SELL_TO_CLOSE",
          orderType: "LIMIT",
          limitPrice: pos.optionPrice,
          quantity: pos.contractsCount,
        });
      }
    }
  }, [selectedPositionIndex, userPositions, stockData, wallet.publicKey]);

  // Initial data fetch
  useEffect(() => {
    if (wallet.publicKey) {
      fetchUserPositions();
      fetchStockPrice();
    } else {
      setIsLoading(false);
    }
  }, [wallet.publicKey]);

  // Calculate payoff range - must be before early returns to maintain hook order
  const payoffRange = useMemo(() => {
    if (!positionData) return [];
    const start = Math.max(0, positionData.underlyingPrice * 0.5);
    const end = positionData.underlyingPrice * 1.5;
    const step = (end - start) / 4;
    const points = [];
    for (let x = start; x <= end + 0.001; x += step) {
      const intrinsic = Math.max(0, x - positionData.strikePrice);
      const payoff = positionData.side === "BUYER"
        ? intrinsic * positionData.contractsCount * 100 - positionData.costBasis
        : positionData.costBasis - intrinsic * positionData.contractsCount * 100;
      points.push({ price: x, payoff });
    }
    return points;
  }, [positionData]);

  const cardClass = "bg-[#0c0f15] border border-white/5 rounded-2xl p-4 md:p-5";
  const titleClass = "text-xs uppercase tracking-[0.12em] text-white/60";
  const mono = "font-mono text-white";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Loading positions...</p>
        </div>
      </div>
    );
  }

  // Show message if no wallet connected
  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5]">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-foreground">Connect Your Wallet</h1>
            <p className="text-white/60">
              Please connect your wallet to view your portfolio positions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if wallet connected but no positions
  if (userPositions.length === 0) {
    return (
      <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5]">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-foreground">No Open Positions</h1>
            <p className="text-white/60">
              You don't have any open positions for {stock.symbol}. Connect to a wallet with positions to view them here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no position data available
  if (!positionData) {
    return (
      <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Loading position data...</p>
        </div>
      </div>
    );
  }

  const displayPosition = positionData;

  const priceChangeColor = displayPosition.optionPriceChange >= 0 ? "text-green-500" : "text-red-500";
  const pnlColor = displayPosition.totalPnL >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5]">
      <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-white/60">
              Position Details
            </p>
            <h1 className="text-3xl font-bold text-foreground mt-1">{displayPosition.label}</h1>
            <p className="text-white/60 text-sm">
              Viewing position {selectedPositionIndex !== null ? selectedPositionIndex + 1 : ''} of {userPositions.length}
            </p>
          </div>
          {wallet.publicKey && userPositions.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/60">Position:</label>
              <select
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={selectedPositionIndex ?? ''}
                onChange={(e) => setSelectedPositionIndex(parseInt(e.target.value))}
              >
                {userPositions.map((pos, idx) => {
                  const strike = pos.account.strike.toNumber() / 100_000_000;
                  const isBuyer = pos.account.buyer?.toString() === wallet.publicKey?.toString();
                  const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString() && !isBuyer;
                  return (
                    <option key={idx} value={idx}>
                      {stock.symbol} ${strike} Call ({isBuyer ? 'BUYER' : 'SELLER'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-8 space-y-6">
            {/* PositionHeader */}
            <div className={cardClass}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-lg font-semibold">{displayPosition.label}</p>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded bg-white/10 text-white`}>
                  {displayPosition.side}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded ${
                  displayPosition.status === "OPEN" ? "bg-green-500/15 text-green-400" :
                  displayPosition.status === "EXERCISED" ? "bg-blue-500/15 text-blue-400" :
                  "bg-red-500/15 text-red-400"
                }`}>
                  {displayPosition.status}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <span className={`text-4xl font-bold ${mono}`}>${displayPosition.optionPrice.toFixed(2)}</span>
                <span className={`${priceChangeColor} text-sm font-semibold`}>
                  {displayPosition.optionPriceChange >= 0 ? "+" : "-"}${Math.abs(displayPosition.optionPriceChange).toFixed(2)} (
                  {displayPosition.optionPriceChangePct.toFixed(2)}%)
                </span>
                <span className="text-sm text-white/60">Contracts: {displayPosition.contracts.toFixed(2)}</span>
              </div>
            </div>

            {/* GreeksBar */}
            <div className={`${cardClass} flex flex-wrap gap-3`}>
              {[
                { label: "Delta", value: displayPosition.delta },
                { label: "Gamma", value: displayPosition.gamma },
                { label: "Theta / day", value: displayPosition.theta },
                { label: "Vega", value: displayPosition.vega },
                { label: "IV", value: displayPosition.impliedVol * 100, suffix: "%" },
                { label: "IV Rank", value: displayPosition.ivRank * 100, suffix: "%" },
                { label: "POP", value: displayPosition.probProfit * 100, suffix: "%" },
              ].map((chip) => (
                <div key={chip.label} className="bg-white/5 rounded-lg px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-white/60">{chip.label}</p>
                  <p className={`${mono} text-sm font-semibold`}>
                    {chip.value.toFixed(chip.suffix ? 0 : 3)}
                    {chip.suffix || ""}
                  </p>
                </div>
              ))}
            </div>

            {/* SummaryCardsRow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={cardClass}>
                <p className={titleClass}>Theoretical value</p>
                <p className={`${mono} text-2xl font-semibold mt-1`}>${displayPosition.marketValueTheoretical.toFixed(2)}</p>
                <p className="text-sm text-white/60 mt-1">Based on Black–Scholes estimate</p>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Total return</p>
                <p className={`${mono} text-2xl font-semibold mt-1 ${pnlColor}`}>
                  {displayPosition.totalPnL >= 0 ? "+" : "-"}${Math.abs(displayPosition.totalPnL).toFixed(2)}
                </p>
                <p className="text-sm text-white/60 mt-1">From cost basis ${displayPosition.costBasis.toFixed(2)}</p>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Underlying price</p>
                <p className={`${mono} text-2xl font-semibold mt-1`}>${displayPosition.underlyingPrice.toFixed(2)}</p>
                <p className="text-sm text-white/60 mt-1">Spot price</p>
              </div>
            </div>

            {/* RiskSection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cardClass}>
                <p className={titleClass}>Time decay (Theta)</p>
                <div className="mt-3 space-y-2">
                  <Row label="Today" value={displayPosition.thetaProjection?.today} />
                  <Row label="In 30 days" value={displayPosition.thetaProjection?.in30Days} />
                  <Row label="In 90 days" value={displayPosition.thetaProjection?.in90Days} />
                  <p className="text-xs text-white/60 mt-2">
                    Negative values = expected daily loss from time decay.
                  </p>
                </div>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Probabilities (model-based)</p>
                <div className="mt-3 space-y-2">
                  <Row label="Probability ITM at expiry" value={displayPosition.probITM * 100} suffix="%" />
                  <Row label="Probability OTM at expiry" value={displayPosition.probOTM * 100} suffix="%" />
                  <Row label="Probability of profit" value={displayPosition.probProfit * 100} suffix="%" />
                </div>
              </div>
            </div>

            {/* SpecsSection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cardClass}>
                <p className={titleClass}>Contract specs</p>
                <div className="mt-3 space-y-2">
                  <Row label="Strike" value={displayPosition.strikePrice} prefix="$" />
                  <Row label="Breakeven" value={displayPosition.breakevenPrice} prefix="$" />
                  <Row label="Expiration" valueLabel={new Date(displayPosition.expirationDate).toLocaleDateString()} />
                  <Row label="Days to expiry" value={displayPosition.daysToExpiry} />
                  <Row label="Multiplier" valueLabel="100 shares / contract" />
                </div>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Your position</p>
                <div className="mt-3 space-y-2">
                  <Row label="Contracts" value={displayPosition.contractsCount} />
                  <Row label="Avg cost / share" value={displayPosition.avgCostPerShare} prefix="$" />
                  <Row label="Cost basis" value={displayPosition.costBasis} prefix="$" />
                  <Row 
                    label="Date bought" 
                    valueLabel={displayPosition.dateBought ? new Date(displayPosition.dateBought).toLocaleDateString() : "N/A"} 
                  />
                  <Row label="Total return" value={displayPosition.totalPnL} prefix="$" valueClass={pnlColor} />
                  <Row label="Total return %" value={displayPosition.totalPnLPct} suffix="%" valueClass={pnlColor} />
                </div>
              </div>
            </div>

            {/* PayoffChart placeholder */}
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-3">
                <p className={titleClass}>Payoff at expiry</p>
                <p className="text-xs text-white/50">Placeholder — P/L curve pending</p>
              </div>
              <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-xl text-white/60 text-sm">
                P/L vs underlying payoff chart (long call)
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-white/60">
                {payoffRange.map((p) => (
                  <div key={p.price} className="bg-white/5 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em]">Underlying</p>
                    <p className={`${mono}`}>${p.price.toFixed(2)}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] mt-1">P/L</p>
                    <p className={`${mono} ${p.payoff >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {p.payoff >= 0 ? "+" : "-"}${Math.abs(p.payoff).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="xl:col-span-4 space-y-6">
            {/* OrderTicketCard */}
            <div className={cardClass}>
              <p className={titleClass}>Close position</p>
              <div className="mt-3 space-y-3">
                <LabeledField label="Order type">
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    value={order.orderType}
                    onChange={(e) => setOrder((o) => ({ ...o, orderType: e.target.value as CloseOrder["orderType"] }))}
                  >
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                    <option value="MID">Mid</option>
                  </select>
                </LabeledField>

                <LabeledField label="Limit price">
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    value={order.limitPrice}
                    onChange={(e) => setOrder((o) => ({ ...o, limitPrice: parseFloat(e.target.value) }))}
                  />
                </LabeledField>

                <div className="grid grid-cols-2 gap-3">
                  <LabeledField label="Estimated credit">
                    <p className={`${mono} text-lg`}>${displayPosition.creditToClose.toFixed(2)}</p>
                  </LabeledField>
                  <LabeledField label="Contracts">
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      value={order.quantity}
                      onChange={(e) => setOrder((o) => ({ ...o, quantity: parseInt(e.target.value || "0", 10) }))}
                    />
                  </LabeledField>
                </div>

                <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
                  Review order
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueLabel,
  prefix,
  suffix,
  valueClass,
}: {
  label: string;
  value?: number;
  valueLabel?: string;
  prefix?: string;
  suffix?: string;
  valueClass?: string;
}) {
  const mono = "font-mono text-white";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <span className={`${mono} text-sm font-semibold ${valueClass || ""}`}>
        {valueLabel ?? `${prefix || ""}${value?.toFixed(suffix ? 2 : 2) ?? "--"}${suffix || ""}`}
      </span>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="w-full flex flex-col gap-1 text-sm text-white/70">
      {label}
      {children}
    </label>
  );
}

"use client";

import React from "react";
import { useMemo, useState } from "react";

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

type RollSuggestion = {
  label: string;
  newStrike: number;
  newExpirationDate: string;
  estNetCredit: number;
};

type ChainRow = {
  strike: number;
  bid: number;
  ask: number;
  delta: number;
  impliedVol: number;
  isCurrentPosition: boolean;
};

const mockPosition: PositionData = {
  symbol: "AMZN",
  label: "AMZN $250 Call",
  side: "BUYER",
  contracts: 1,
  status: "OPEN",
  optionPrice: 24.39,
  optionPriceChange: 4.99,
  optionPriceChangePct: 25.7,
  positionValue: 2438.56,
  creditToClose: 2438.56,
  marketValueTheoretical: 2438.56,
  costBasis: 1940.0,
  totalPnL: 498.56,
  totalPnLPct: 25.7,
  dailyPnL: 145.0,
  underlyingPrice: 229.75,
  strikePrice: 250,
  expirationDate: "2026-05-14",
  breakevenPrice: 269.4,
  contractsCount: 1,
  avgCostPerShare: 19.4,
  delta: 0.58,
  gamma: 0.012,
  theta: -0.13,
  vega: 0.21,
  impliedVol: 0.347,
  ivRank: 0.62,
  probITM: 0.61,
  probOTM: 0.39,
  probProfit: 0.58,
  daysToExpiry: 523,
  thetaProjection: {
    today: -13.2,
    in30Days: -22.8,
    in90Days: -29.1,
  },
};

const rollSuggestions: RollSuggestion[] = [
  { label: "Roll out 1 month, same strike", newStrike: 250, newExpirationDate: "2026-06-14", estNetCredit: 1.15 },
  { label: "Roll up $10, same expiry", newStrike: 260, newExpirationDate: "2026-05-14", estNetCredit: 0.35 },
  { label: "Roll out 3 months, +$5 strike", newStrike: 255, newExpirationDate: "2026-08-14", estNetCredit: 1.85 },
];

const miniChain: ChainRow[] = [
  { strike: 240, bid: 27.9, ask: 28.3, delta: 0.65, impliedVol: 0.33, isCurrentPosition: false },
  { strike: 245, bid: 26.1, ask: 26.6, delta: 0.61, impliedVol: 0.34, isCurrentPosition: false },
  { strike: 250, bid: 24.0, ask: 24.8, delta: 0.58, impliedVol: 0.347, isCurrentPosition: true },
  { strike: 255, bid: 22.1, ask: 22.8, delta: 0.54, impliedVol: 0.35, isCurrentPosition: false },
  { strike: 260, bid: 20.4, ask: 21.0, delta: 0.50, impliedVol: 0.36, isCurrentPosition: false },
];

export default function StockPreviewPage() {
  const [order, setOrder] = useState<CloseOrder>({
    side: mockPosition.side === "SELLER" ? "BUY_TO_CLOSE" : "SELL_TO_CLOSE",
    orderType: "LIMIT",
    limitPrice: mockPosition.optionPrice,
    quantity: mockPosition.contractsCount,
  });

  const priceChangeColor = mockPosition.optionPriceChange >= 0 ? "text-green-500" : "text-red-500";
  const pnlColor = mockPosition.totalPnL >= 0 ? "text-green-500" : "text-red-500";

  const payoffRange = useMemo(() => {
    const start = Math.max(0, mockPosition.underlyingPrice * 0.5);
    const end = mockPosition.underlyingPrice * 1.5;
    const step = (end - start) / 4;
    const points = [];
    for (let x = start; x <= end + 0.001; x += step) {
      const payoff = Math.max(0, x - mockPosition.strikePrice) * mockPosition.contractsCount * 100 - mockPosition.costBasis;
      points.push({ price: x, payoff });
    }
    return points;
  }, []);

  const cardClass = "bg-[#0c0f15] border border-white/5 rounded-2xl p-4 md:p-5";
  const titleClass = "text-xs uppercase tracking-[0.12em] text-white/60";
  const mono = "font-mono text-white";

  return (
    <div className="min-h-screen bg-[#070a0d] text-[#f5f5f5]">
      <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-white/60">Testing endpoint</p>
            <h1 className="text-3xl font-bold text-foreground mt-1">{mockPosition.label}</h1>
            <p className="text-white/60 text-sm">Mock owned position UI preview—no wallet or on-chain data required.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="xl:col-span-8 space-y-6">
            {/* PositionHeader */}
            <div className={cardClass}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <p className="text-lg font-semibold">{mockPosition.label}</p>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded bg-white/10 text-white`}>
                  {mockPosition.side}
                </span>
                <span className="text-[10px] font-semibold px-2 py-1 rounded bg-green-500/15 text-green-400">
                  {mockPosition.status}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <span className={`text-4xl font-bold ${mono}`}>${mockPosition.optionPrice.toFixed(2)}</span>
                <span className={`${priceChangeColor} text-sm font-semibold`}>
                  {mockPosition.optionPriceChange >= 0 ? "+" : "-"}${Math.abs(mockPosition.optionPriceChange).toFixed(2)} (
                  {mockPosition.optionPriceChangePct.toFixed(2)}%)
                </span>
                <span className="text-sm text-white/60">Contracts: {mockPosition.contracts}</span>
              </div>
            </div>

            {/* GreeksBar */}
            <div className={`${cardClass} flex flex-wrap gap-3`}>
              {[
                { label: "Delta", value: mockPosition.delta },
                { label: "Gamma", value: mockPosition.gamma },
                { label: "Theta / day", value: mockPosition.theta },
                { label: "Vega", value: mockPosition.vega },
                { label: "IV", value: mockPosition.impliedVol * 100, suffix: "%" },
                { label: "IV Rank", value: mockPosition.ivRank * 100, suffix: "%" },
                { label: "POP", value: mockPosition.probProfit * 100, suffix: "%" },
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
                <p className={`${mono} text-2xl font-semibold mt-1`}>${mockPosition.marketValueTheoretical.toFixed(2)}</p>
                <p className="text-sm text-white/60 mt-1">Based on Black–Scholes estimate</p>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Total return</p>
                <p className={`${mono} text-2xl font-semibold mt-1 ${pnlColor}`}>
                  {mockPosition.totalPnL >= 0 ? "+" : "-"}${Math.abs(mockPosition.totalPnL).toFixed(2)}
                </p>
                <p className="text-sm text-white/60 mt-1">From cost basis ${mockPosition.costBasis.toFixed(2)}</p>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Underlying price</p>
                <p className={`${mono} text-2xl font-semibold mt-1`}>${mockPosition.underlyingPrice.toFixed(2)}</p>
                <p className="text-sm text-white/60 mt-1">Spot price</p>
              </div>
            </div>

            {/* RiskSection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cardClass}>
                <p className={titleClass}>Time decay (Theta)</p>
                <div className="mt-3 space-y-2">
                  <Row label="Today" value={mockPosition.thetaProjection?.today} />
                  <Row label="In 30 days" value={mockPosition.thetaProjection?.in30Days} />
                  <Row label="In 90 days" value={mockPosition.thetaProjection?.in90Days} />
                  <p className="text-xs text-white/60 mt-2">
                    Negative values = expected daily loss from time decay.
                  </p>
                </div>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Probabilities (model-based)</p>
                <div className="mt-3 space-y-2">
                  <Row label="Probability ITM at expiry" value={mockPosition.probITM * 100} suffix="%" />
                  <Row label="Probability OTM at expiry" value={mockPosition.probOTM * 100} suffix="%" />
                  <Row label="Probability of profit" value={mockPosition.probProfit * 100} suffix="%" />
                </div>
              </div>
            </div>

            {/* SpecsSection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cardClass}>
                <p className={titleClass}>Contract specs</p>
                <div className="mt-3 space-y-2">
                  <Row label="Strike" value={mockPosition.strikePrice} prefix="$" />
                  <Row label="Breakeven" value={mockPosition.breakevenPrice} prefix="$" />
                  <Row label="Expiration" valueLabel={new Date(mockPosition.expirationDate).toLocaleDateString()} />
                  <Row label="Days to expiry" value={mockPosition.daysToExpiry} />
                  <Row label="Multiplier" valueLabel="100 shares / contract" />
                </div>
              </div>
              <div className={cardClass}>
                <p className={titleClass}>Your position</p>
                <div className="mt-3 space-y-2">
                  <Row label="Contracts" value={mockPosition.contractsCount} />
                  <Row label="Avg cost / share" value={mockPosition.avgCostPerShare} prefix="$" />
                  <Row label="Cost basis" value={mockPosition.costBasis} prefix="$" />
                  <Row label="Total return" value={mockPosition.totalPnL} prefix="$" valueClass={pnlColor} />
                  <Row label="Total return %" value={mockPosition.totalPnLPct} suffix="%" valueClass={pnlColor} />
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
                    <p className={`${mono} text-lg`}>${mockPosition.creditToClose.toFixed(2)}</p>
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

            {/* RollSuggestionsCard */}
            <div className={cardClass}>
              <p className={titleClass}>Roll suggestions</p>
              <div className="mt-3 space-y-2">
                {rollSuggestions.map((s) => (
                  <button
                    key={s.label}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                    onClick={() =>
                      setOrder({
                        side: mockPosition.side === "SELLER" ? "BUY_TO_CLOSE" : "SELL_TO_CLOSE",
                        orderType: "LIMIT",
                        limitPrice: mockPosition.optionPrice + s.estNetCredit,
                        quantity: mockPosition.contractsCount,
                      })
                    }
                  >
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-white/60">
                      New strike ${s.newStrike} • Exp {new Date(s.newExpirationDate).toLocaleDateString()} • Est. net credit{" "}
                      {s.estNetCredit >= 0 ? "+" : "-"}${Math.abs(s.estNetCredit).toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* MiniChainCard */}
            <div className={cardClass}>
              <p className={titleClass}>Mini chain</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-white/5">
                <div className="grid grid-cols-5 text-xs uppercase tracking-[0.08em] text-white/60 bg-white/5 px-3 py-2">
                  <span>Strike</span>
                  <span>Bid</span>
                  <span>Ask</span>
                  <span>Delta</span>
                  <span>IV%</span>
                </div>
                <div className="divide-y divide-white/5">
                  {miniChain.map((row) => (
                    <div
                      key={row.strike}
                      className={`grid grid-cols-5 px-3 py-2 text-sm ${
                        row.isCurrentPosition ? "bg-orange-500/10 border-l-2 border-orange-500" : ""
                      }`}
                    >
                      <span className={mono}>${row.strike.toFixed(0)}</span>
                      <span className={mono}>${row.bid.toFixed(2)}</span>
                      <span className={mono}>${row.ask.toFixed(2)}</span>
                      <span className={mono}>{row.delta.toFixed(2)}</span>
                      <span className={mono}>{(row.impliedVol * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
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

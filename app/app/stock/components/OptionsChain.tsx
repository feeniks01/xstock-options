"use client";

import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface OptionData {
    strike: number;
    type: "call" | "put";
    bid: number;
    ask: number;
    mid: number;
    last: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
    volume: number;
    openInterest: number;
    isITM: boolean;
    expiration: string;
    // Reference to original on-chain option if exists
    rawOption?: any;
}

export interface OptionChainRow {
    strike: number;
    call: OptionData | null;
    put: OptionData | null;
    isATM: boolean;
}

interface OptionsChainProps {
    options: any[];
    selectedOption: any | null;
    onSelectOption: (option: any, type: "call" | "put", side: "buy" | "sell") => void;
    currentPrice: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const EXPIRATION_TABS = [
    { label: "15m", value: 15 * 60 * 1000 },
    { label: "1h", value: 60 * 60 * 1000 },
    { label: "24h", value: 24 * 60 * 60 * 1000 },
    { label: "72h", value: 72 * 60 * 60 * 1000 },
    { label: "1w", value: 7 * 24 * 60 * 60 * 1000 },
    { label: "2w", value: 14 * 24 * 60 * 60 * 1000 },
    { label: "1m", value: 30 * 24 * 60 * 60 * 1000 },
];

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function calculateGreeks(strike: number, spot: number, timeToExpiry: number, iv: number = 0.35): { delta: number; gamma: number; theta: number; vega: number } {
    // Simplified Black-Scholes approximations
    const moneyness = spot / strike;
    const t = Math.max(timeToExpiry / 365, 0.001); // Convert to years
    const sqrtT = Math.sqrt(t);
    
    // Delta approximation
    const d1 = (Math.log(moneyness) + (0.05 + (iv * iv) / 2) * t) / (iv * sqrtT);
    const delta = 0.5 * (1 + erf(d1 / Math.sqrt(2)));
    
    // Gamma approximation
    const gamma = Math.exp(-d1 * d1 / 2) / (strike * iv * sqrtT * Math.sqrt(2 * Math.PI));
    
    // Theta approximation (per day)
    const theta = -(spot * iv * Math.exp(-d1 * d1 / 2)) / (2 * sqrtT * Math.sqrt(2 * Math.PI) * 365);
    
    // Vega approximation
    const vega = spot * sqrtT * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI) / 100;
    
    return { delta, gamma, theta, vega };
}

// Error function approximation
function erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

function generateMockOptionData(strike: number, currentPrice: number, type: "call" | "put", expiryMs: number): OptionData {
    const daysToExpiry = expiryMs / (24 * 60 * 60 * 1000);
    const iv = 0.25 + Math.random() * 0.25; // 25-50% IV
    const greeks = calculateGreeks(strike, currentPrice, daysToExpiry, iv);
    
    // Calculate intrinsic value
    const intrinsicCall = Math.max(0, currentPrice - strike);
    const intrinsicPut = Math.max(0, strike - currentPrice);
    const intrinsic = type === "call" ? intrinsicCall : intrinsicPut;
    
    // Calculate time value
    const timeValue = currentPrice * iv * Math.sqrt(daysToExpiry / 365) * 0.4;
    const optionPrice = intrinsic + timeValue;
    
    // Bid/Ask spread (tighter for ATM, wider for OTM)
    const moneyness = Math.abs(currentPrice - strike) / currentPrice;
    const spreadPct = 0.02 + moneyness * 0.05;
    const spread = optionPrice * spreadPct;
    
    const mid = Math.max(0.01, optionPrice);
    const bid = Math.max(0.01, mid - spread / 2);
    const ask = mid + spread / 2;
    
    return {
        strike,
        type,
        bid: parseFloat(bid.toFixed(2)),
        ask: parseFloat(ask.toFixed(2)),
        mid: parseFloat(mid.toFixed(2)),
        last: parseFloat((mid + (Math.random() - 0.5) * spread * 0.5).toFixed(2)),
        delta: type === "call" ? greeks.delta : greeks.delta - 1,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
        iv: iv,
        volume: Math.floor(Math.random() * 500),
        openInterest: Math.floor(Math.random() * 5000),
        isITM: type === "call" ? currentPrice > strike : currentPrice < strike,
        expiration: new Date(Date.now() + expiryMs).toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function OptionsChain({ options, selectedOption, onSelectOption, currentPrice }: OptionsChainProps) {
    // State
    const [selectedExpiry, setSelectedExpiry] = useState<number>(24 * 60 * 60 * 1000);
    const [viewMode, setViewMode] = useState<"calls" | "puts" | "both">("both");
    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
    const [selectedType, setSelectedType] = useState<"call" | "put" | null>(null);

    // Generate chain data
    const chainData = useMemo(() => {
        if (!currentPrice) return [];
        
        const centerPrice = Math.round(currentPrice);
        const strikes: number[] = [];
        
        // Generate strikes: $5 intervals for a range around current price
        const interval = currentPrice > 100 ? 5 : currentPrice > 20 ? 2.5 : 1;
        const range = currentPrice > 100 ? 50 : currentPrice > 20 ? 25 : 10;
        
        for (let s = centerPrice - range; s <= centerPrice + range; s += interval) {
            if (s > 0) strikes.push(s);
        }
        
        // Add any existing option strikes
        options.forEach(o => {
            const s = o.account.strike.toNumber() / 100_000_000;
            if (!strikes.includes(s)) strikes.push(s);
        });
        
        strikes.sort((a, b) => a - b);
        
        // Build rows
        const rows: OptionChainRow[] = strikes.map(strike => {
            const isATM = Math.abs(strike - currentPrice) <= interval / 2;
            
            // Check for real options at this strike
            const matchingOptions = options.filter(o => {
                const optionStrike = o.account.strike.toNumber() / 100_000_000;
                return Math.abs(optionStrike - strike) < 0.001;
            });
            
            const realOption = matchingOptions[0];
            
            // Generate mock data (or use real if available)
            const callData = generateMockOptionData(strike, currentPrice, "call", selectedExpiry);
            const putData = generateMockOptionData(strike, currentPrice, "put", selectedExpiry);
            
            // If there's a real option, override with its data
            if (realOption) {
                const premium = realOption.account.isListed 
                    ? realOption.account.askPrice.toNumber() / 1_000_000
                    : realOption.account.premium.toNumber() / 1_000_000;
                
                // For now, treat all real options as calls
                callData.ask = premium;
                callData.mid = premium * 0.98;
                callData.bid = premium * 0.96;
                callData.rawOption = realOption;
            }
            
            return {
                strike,
                call: callData,
                put: putData,
                isATM,
            };
        });
        
        return rows;
    }, [options, currentPrice, selectedExpiry]);

    // Handle row click
    const handleRowClick = useCallback((row: OptionChainRow, type: "call" | "put") => {
        const option = type === "call" ? row.call : row.put;
        if (!option) return;
        
        setSelectedStrike(row.strike);
        setSelectedType(type);
        
        // Call parent handler with option data
        onSelectOption(option, type, side);
    }, [side, onSelectOption]);

    // Check if row is selected
    const isRowSelected = (strike: number, type: "call" | "put") => {
        return selectedStrike === strike && selectedType === type;
    };

    return (
        <div className="bg-[#0a0b0d] rounded-2xl border border-white/5 overflow-hidden">
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* HEADER ROW */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="p-4 border-b border-white/5 space-y-4">
                {/* Top Row: Buy/Sell + View Mode */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Buy/Sell Toggle */}
                        <div className="flex bg-white/5 rounded-lg p-1">
                            <button
                                onClick={() => setSide("buy")}
                                className={`px-5 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    side === "buy"
                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                                        : "text-white/60 hover:text-white"
                                }`}
                            >
                                Buy
                            </button>
                            <button
                                onClick={() => setSide("sell")}
                                className={`px-5 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    side === "sell"
                                        ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                        : "text-white/60 hover:text-white"
                                }`}
                            >
                                Sell
                            </button>
                        </div>
                        
                        {/* Calls/Puts/Both Toggle */}
                        <div className="flex bg-white/5 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("calls")}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    viewMode === "calls"
                                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                        : "text-white/60 hover:text-white"
                                }`}
                            >
                                Calls
                            </button>
                            <button
                                onClick={() => setViewMode("puts")}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    viewMode === "puts"
                                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                        : "text-white/60 hover:text-white"
                                }`}
                            >
                                Puts
                            </button>
                            <button
                                onClick={() => setViewMode("both")}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    viewMode === "both"
                                        ? "bg-white/10 text-white border border-white/20"
                                        : "text-white/60 hover:text-white"
                                }`}
                            >
                                Both
                            </button>
                        </div>
                    </div>
                    
                    {/* Current Price Badge */}
                    <div className="bg-orange-500/10 border border-orange-500/30 px-4 py-2 rounded-lg">
                        <span className="text-xs text-orange-400/80 uppercase tracking-wider">Spot</span>
                        <span className="ml-2 text-lg font-bold text-orange-400">${currentPrice.toFixed(2)}</span>
                    </div>
                </div>
                
                {/* Expiration Tabs */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 uppercase tracking-wider mr-2">Expiry:</span>
                    {EXPIRATION_TABS.map((tab) => (
                        <button
                            key={tab.label}
                            onClick={() => setSelectedExpiry(tab.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                selectedExpiry === tab.value
                                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* OPTIONS TABLE */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    {/* Table Header */}
                    <thead>
                        <tr className="bg-white/[0.02]">
                            {/* CALLS HEADER */}
                            {(viewMode === "calls" || viewMode === "both") && (
                                <>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">OI</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">Vol</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">IV</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">Vega</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">Θ</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">Γ</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-blue-400/80 uppercase tracking-wider">Δ</th>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-green-500/80 uppercase tracking-wider">Bid</th>
                                    <th className="px-2 py-3 text-center text-[10px] font-medium text-white/60 uppercase tracking-wider">Mid</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-red-500/80 uppercase tracking-wider">Ask</th>
                                </>
                            )}
                            
                            {/* STRIKE COLUMN */}
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-white uppercase tracking-wider bg-white/[0.03] border-x border-white/5">
                                Strike
                            </th>
                            
                            {/* PUTS HEADER (Mirrored) */}
                            {(viewMode === "puts" || viewMode === "both") && (
                                <>
                                    <th className="px-2 py-3 text-right text-[10px] font-medium text-green-500/80 uppercase tracking-wider">Bid</th>
                                    <th className="px-2 py-3 text-center text-[10px] font-medium text-white/60 uppercase tracking-wider">Mid</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-red-500/80 uppercase tracking-wider">Ask</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">Δ</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">Γ</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">Θ</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">Vega</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">IV</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">Vol</th>
                                    <th className="px-2 py-3 text-left text-[10px] font-medium text-purple-400/80 uppercase tracking-wider">OI</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    
                    {/* Table Body */}
                    <tbody className="divide-y divide-white/[0.02]">
                        {chainData.map((row) => {
                            const callSelected = isRowSelected(row.strike, "call");
                            const putSelected = isRowSelected(row.strike, "put");
                            
                            // ITM styling
                            const callITM = row.call?.isITM;
                            const putITM = row.put?.isITM;
                            
                            return (
                                <tr
                                    key={row.strike}
                                    className={`
                                        transition-colors
                                        ${row.isATM ? "bg-yellow-500/[0.03]" : ""}
                                    `}
                                >
                                    {/* CALLS DATA */}
                                    {(viewMode === "calls" || viewMode === "both") && row.call && (
                                        <>
                                            <CallRow
                                                data={row.call}
                                                isATM={row.isATM}
                                                isITM={callITM || false}
                                                isSelected={callSelected}
                                                onClick={() => handleRowClick(row, "call")}
                                            />
                                        </>
                                    )}
                                    
                                    {/* STRIKE COLUMN */}
                                    <td className={`
                                        px-4 py-2 text-center font-bold border-x border-white/5
                                        ${row.isATM 
                                            ? "bg-yellow-500/10 text-yellow-400 border-l-2 border-l-yellow-500" 
                                            : "bg-white/[0.02] text-white/90"
                                        }
                                    `}>
                                        ${row.strike.toFixed(2)}
                                    </td>
                                    
                                    {/* PUTS DATA */}
                                    {(viewMode === "puts" || viewMode === "both") && row.put && (
                                        <PutRow
                                            data={row.put}
                                            isATM={row.isATM}
                                            isITM={putITM || false}
                                            isSelected={putSelected}
                                            onClick={() => handleRowClick(row, "put")}
                                        />
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Legend */}
            <div className="p-3 border-t border-white/5 flex items-center gap-6 text-[10px] text-white/40">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/50"></div>
                    <span>ATM (At The Money)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500/10"></div>
                    <span>Call ITM</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500/10"></div>
                    <span>Put ITM</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-orange-500"></div>
                    <span>Selected</span>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// CALL ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════

interface RowProps {
    data: OptionData;
    isATM: boolean;
    isITM: boolean;
    isSelected: boolean;
    onClick: () => void;
}

function CallRow({ data, isATM, isITM, isSelected, onClick }: RowProps) {
    const bgClass = isSelected 
        ? "bg-blue-500/10" 
        : isITM 
            ? "bg-green-500/[0.05] hover:bg-green-500/10" 
            : "hover:bg-white/[0.03]";
    
    return (
        <>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.openInterest.toLocaleString()}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.volume.toLocaleString()}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/70 cursor-pointer ${bgClass}`} onClick={onClick}>
                {(data.iv * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.vega.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-red-400/80 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.theta.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.gamma.toFixed(3)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-blue-400 font-medium cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.delta.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-green-500 font-medium cursor-pointer ${bgClass}`} onClick={onClick}>
                ${data.bid.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-center tabular-nums text-white/60 cursor-pointer ${bgClass}`} onClick={onClick}>
                ${data.mid.toFixed(2)}
            </td>
            <td 
                className={`
                    px-2 py-2 text-left tabular-nums font-medium cursor-pointer transition-all
                    ${isSelected 
                        ? "text-white bg-orange-500 rounded-l-none rounded-r-md" 
                        : "text-red-500"
                    }
                    ${bgClass}
                `} 
                onClick={onClick}
            >
                ${data.ask.toFixed(2)}
            </td>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PUT ROW COMPONENT (Mirrored)
// ═══════════════════════════════════════════════════════════════════

function PutRow({ data, isATM, isITM, isSelected, onClick }: RowProps) {
    const bgClass = isSelected 
        ? "bg-purple-500/10" 
        : isITM 
            ? "bg-red-500/[0.05] hover:bg-red-500/10" 
            : "hover:bg-white/[0.03]";
    
    return (
        <>
            <td 
                className={`
                    px-2 py-2 text-right tabular-nums font-medium cursor-pointer transition-all
                    ${isSelected 
                        ? "text-white bg-orange-500 rounded-r-none rounded-l-md" 
                        : "text-green-500"
                    }
                    ${bgClass}
                `} 
                onClick={onClick}
            >
                ${data.bid.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-center tabular-nums text-white/60 cursor-pointer ${bgClass}`} onClick={onClick}>
                ${data.mid.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-red-500 font-medium cursor-pointer ${bgClass}`} onClick={onClick}>
                ${data.ask.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-purple-400 font-medium cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.delta.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.gamma.toFixed(3)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-red-400/80 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.theta.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.vega.toFixed(2)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/70 cursor-pointer ${bgClass}`} onClick={onClick}>
                {(data.iv * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.volume.toLocaleString()}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.openInterest.toLocaleString()}
            </td>
        </>
    );
}

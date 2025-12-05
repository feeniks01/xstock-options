"use client";

import { useState, useMemo, useCallback } from "react";
import {
    priceOption,
    impliedVolBisection,
    timeToYears,
    DEFAULT_RISK_FREE_RATE,
    adjustIVForSmile,
    type OptionPriceWithGreeks
} from "../../../lib/options-math";

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
    rho: number;
    iv: number;
    volume: number;
    openInterest: number;
    isITM: boolean;
    expiration: string;
    intrinsicValue: number;
    timeValue: number;
    // Reference to original on-chain option if exists
    rawOption?: any;
    // Computed IV from market price (if available)
    computedIV?: number;
}

export interface OptionChainRow {
    strike: number;
    call: OptionData | null;
    put: OptionData | null;
    isATM: boolean;
}

interface HistoricalVolatility {
    hv20: number;
    hv60: number;
    hvAll: number;
    baseIV: number;
}

interface OptionsChainProps {
    options: any[];
    selectedOption: any | null;
    onSelectOption: (option: any, type: "call" | "put", side: "buy" | "sell") => void;
    currentPrice: number;
    historicalVolatility?: HistoricalVolatility;
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
// HELPER FUNCTIONS (Using options-math library)
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate option data using the comprehensive Black-Scholes library
 * This provides accurate pricing, Greeks, and IV calculations
 */
function generateOptionData(
    strike: number, 
    currentPrice: number, 
    type: "call" | "put", 
    expiryMs: number,
    baseIV: number = 0.35 // Default fallback if no HV data from Bitquery
): OptionData {
    // Convert expiry to years for Black-Scholes
    const T = expiryMs / (365 * 24 * 60 * 60 * 1000); // Time in years
    
    // Use the options-math library for accurate pricing
    const result: OptionPriceWithGreeks = priceOption(
        currentPrice,  // spot
        strike,        // strike
        DEFAULT_RISK_FREE_RATE, // risk-free rate (5%)
        baseIV,        // base IV from historical volatility
        T,             // time to expiry in years
        type           // call or put
    );
    
    // Calculate bid/ask spread based on moneyness and time
    // Tighter spreads for ATM, wider for OTM and short-dated
    const moneyness = Math.abs(currentPrice - strike) / currentPrice;
    const timeAdjustment = T < 0.01 ? 1.5 : T < 0.05 ? 1.2 : 1.0; // Wider for short-dated
    const spreadPct = (0.015 + moneyness * 0.04) * timeAdjustment;
    const spread = Math.max(0.01, result.price * spreadPct);
    
    const mid = Math.max(0.01, result.price);
    const bid = Math.max(0.01, mid - spread / 2);
    const ask = mid + spread / 2;
    
    return {
        strike,
        type,
        bid: parseFloat(bid.toFixed(2)),
        ask: parseFloat(ask.toFixed(2)),
        mid: parseFloat(mid.toFixed(2)),
        last: parseFloat((mid + (Math.random() - 0.5) * spread * 0.3).toFixed(2)),
        delta: result.delta,
        gamma: result.gamma,
        theta: result.theta,
        vega: result.vega,
        rho: result.rho,
        iv: result.iv, // Adjusted IV with smile and term structure
        volume: 0, // No mock volume - only show for real options
        openInterest: 0, // No mock OI - only show for real options
        isITM: result.isITM,
        expiration: new Date(Date.now() + expiryMs).toISOString(),
        intrinsicValue: result.intrinsicValue,
        timeValue: result.timeValue,
    };
}

/**
 * Reverse-engineer Implied Volatility from a market price
 * Used when we have actual option market prices (from on-chain data)
 */
function computeIVFromMarketPrice(
    marketPrice: number,
    spot: number,
    strike: number,
    expiryMs: number,
    type: "call" | "put"
): number | null {
    const T = expiryMs / (365 * 24 * 60 * 60 * 1000);
    
    if (T <= 0 || marketPrice <= 0) {
        return null;
    }
    
    const result = impliedVolBisection(
        marketPrice,
        spot,
        strike,
        DEFAULT_RISK_FREE_RATE,
        T,
        type
    );
    
    if (result.converged) {
        return result.iv;
    }
    
    // Return best guess even if not fully converged
    return result.iv > 0.01 ? result.iv : null;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function OptionsChain({ options, selectedOption, onSelectOption, currentPrice, historicalVolatility }: OptionsChainProps) {
    // State
    const [selectedExpiry, setSelectedExpiry] = useState<number>(24 * 60 * 60 * 1000);
    const [viewMode, setViewMode] = useState<"calls" | "puts" | "both">("both");
    const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
    const [selectedType, setSelectedType] = useState<"call" | "put" | null>(null);
    
    // Use base IV from historical volatility, or default to 35%
    const baseIV = historicalVolatility?.baseIV || 0.35;

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
            
            // Generate option data using real historical volatility
            const callData = generateOptionData(strike, currentPrice, "call", selectedExpiry, baseIV);
            const putData = generateOptionData(strike, currentPrice, "put", selectedExpiry, baseIV);
            
            // If there's a real option, override with its data and compute IV
            if (realOption) {
                const premium = realOption.account.isListed 
                    ? realOption.account.askPrice.toNumber() / 1_000_000
                    : realOption.account.premium.toNumber() / 1_000_000;
                
                // Calculate contracts from amount (100 shares per contract with 6 decimals)
                const contracts = realOption.account.amount 
                    ? Math.round(realOption.account.amount.toNumber() / (100 * 1_000_000))
                    : 1;
                
                // Calculate time to expiry for the real option
                const expiryTs = realOption.account.expiryTs?.toNumber() * 1000;
                const timeToExpiryMs = expiryTs ? expiryTs - Date.now() : selectedExpiry;
                
                // ═══════════════════════════════════════════════════════════════════
                // REVERSE ENGINEER IMPLIED VOLATILITY FROM MARKET PRICE
                // This is the key Black-Scholes inversion using bisection method
                // ═══════════════════════════════════════════════════════════════════
                const computedIV = computeIVFromMarketPrice(
                    premium,           // Market price of the option
                    currentPrice,      // Current spot price from Bitquery
                    strike,            // Strike price
                    timeToExpiryMs,    // Time to expiry in ms
                    "call"             // Option type (real options are covered calls)
                );
                
                // Override synthetic data with real market data
                callData.ask = premium;
                callData.mid = premium * 0.98;
                callData.bid = premium * 0.96;
                callData.openInterest = Math.max(1, contracts);
                callData.rawOption = realOption;
                callData.expiration = expiryTs ? new Date(expiryTs).toISOString() : callData.expiration;
                
                // Update IV if we successfully computed it from market price
                if (computedIV !== null) {
                    callData.computedIV = computedIV;
                    callData.iv = computedIV; // Use computed IV for display
                    
                    // Re-price Greeks with the computed IV for consistency
                    const T = timeToExpiryMs / (365 * 24 * 60 * 60 * 1000);
                    if (T > 0) {
                        const repriced = priceOption(currentPrice, strike, DEFAULT_RISK_FREE_RATE, computedIV, T, "call");
                        callData.delta = repriced.delta;
                        callData.gamma = repriced.gamma;
                        callData.theta = repriced.theta;
                        callData.vega = repriced.vega;
                        callData.rho = repriced.rho;
                    }
                }
            }
            
            return {
                strike,
                call: callData,
                put: putData,
                isATM,
            };
        });
        
        return rows;
    }, [options, currentPrice, selectedExpiry, baseIV]);

    // Handle row click
    const handleRowClick = useCallback((row: OptionChainRow, type: "call" | "put") => {
        const option = type === "call" ? row.call : row.put;
        if (!option) return;
        
        setSelectedStrike(row.strike);
        setSelectedType(type);
        
        // Call parent handler with option data (default to "buy" - order form handles buy/sell)
        onSelectOption(option, type, "buy");
    }, [onSelectOption]);

    // Check if row is selected
    const isRowSelected = (strike: number, type: "call" | "put") => {
        return selectedStrike === strike && selectedType === type;
    };

    return (
        <div className="bg-[#0a0b0d] rounded-2xl border border-white/5 overflow-hidden">
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* HEADER ROW */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="p-4 border-b border-white/5">
                {/* Single Row: View Mode + Expiration Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-3">
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
                    
                    {/* Expiration Tabs */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40 uppercase tracking-wider mr-1">Expiry:</span>
                        {EXPIRATION_TABS.map((tab) => (
                            <button
                                key={tab.label}
                                onClick={() => setSelectedExpiry(tab.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

// Helper to format small numbers appropriately
function formatGreek(value: number, decimals: number = 2): string {
    if (Math.abs(value) < 0.001) return '< 0.01';
    if (Math.abs(value) >= 1) return value.toFixed(decimals);
    // For small values, show more precision
    return value.toFixed(Math.max(decimals, 3));
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
                {data.openInterest > 0 ? data.openInterest.toLocaleString() : '—'}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.volume > 0 ? data.volume.toLocaleString() : '—'}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/70 cursor-pointer ${bgClass}`} onClick={onClick}>
                {(data.iv * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.vega)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-red-400/80 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.theta)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.gamma, 3)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums text-blue-400 font-medium cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.delta)}
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
                {formatGreek(data.delta)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.gamma, 3)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-red-400/80 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.theta)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {formatGreek(data.vega)}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/70 cursor-pointer ${bgClass}`} onClick={onClick}>
                {(data.iv * 100).toFixed(1)}%
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.volume > 0 ? data.volume.toLocaleString() : '—'}
            </td>
            <td className={`px-2 py-2 text-left tabular-nums text-white/50 cursor-pointer ${bgClass}`} onClick={onClick}>
                {data.openInterest > 0 ? data.openInterest.toLocaleString() : '—'}
            </td>
        </>
    );
}

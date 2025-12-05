"use client";

import { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { calculateOptionPremium } from "../../../utils/pricing";
import type { OptionData } from "./OptionsChain";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface SelectedOptionInfo {
    strike: number;
    premium: number;
    expiration: string;
    type: "call" | "put";
    side: "buy" | "sell";
    delta?: number;
    iv?: number;
    rawOption?: any;
}

interface OrderFormProps {
    currentPrice: number;
    selectedOption: any | null;
    selectedInfo?: SelectedOptionInfo | null;
    onSell: (params: { strike: number; expiry: Date; contracts: number; premium: number }) => void;
    onBuy: (params: { option: any; contracts: number }) => void;
    isProcessing: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// EXPIRATION OPTIONS
// ═══════════════════════════════════════════════════════════════════

const EXPIRY_OPTIONS = [
    { label: "15m", value: 15 * 60 * 1000 },
    { label: "1h", value: 60 * 60 * 1000 },
    { label: "24h", value: 24 * 60 * 60 * 1000 },
    { label: "72h", value: 72 * 60 * 60 * 1000 },
    { label: "1w", value: 7 * 24 * 60 * 60 * 1000 },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function OrderForm({ 
    currentPrice, 
    selectedOption, 
    selectedInfo,
    onSell, 
    onBuy, 
    isProcessing 
}: OrderFormProps) {
    const [activeTab, setActiveTab] = useState<"buy" | "sell">("sell");

    // Sell State
    const [strikePrice, setStrikePrice] = useState<string>("");
    const [expiryInterval, setExpiryInterval] = useState<number>(24 * 60 * 60 * 1000);
    const [sellContracts, setSellContracts] = useState<number>(1);
    const [customPremium, setCustomPremium] = useState<string>("");
    const [optionType, setOptionType] = useState<"call" | "put">("call");

    // Buy State
    const [buyContracts, setBuyContracts] = useState<number>(1);

    // Initialize defaults when price loads
    useEffect(() => {
        if (currentPrice && !strikePrice) {
            setStrikePrice((Math.ceil(currentPrice * 1.1)).toString());
        }
    }, [currentPrice]);

    // Auto-fill from chain selection
    useEffect(() => {
        if (selectedInfo) {
            setStrikePrice(selectedInfo.strike.toString());
            setCustomPremium(selectedInfo.premium.toFixed(2));
            setOptionType(selectedInfo.type);
            setActiveTab(selectedInfo.side);
            
            // If it's a buy with a real option, switch to buy tab
            if (selectedInfo.rawOption) {
                setActiveTab("buy");
            }
        }
    }, [selectedInfo]);

    // Calculate estimated premium for suggestion
    const calculatedExpiryDate = new Date(Date.now() + expiryInterval);
    const estimatedPremium = (currentPrice && strikePrice)
        ? calculateOptionPremium(currentPrice, parseFloat(strikePrice), calculatedExpiryDate) * 100
        : 0;

    // Update custom premium when estimate changes
    useEffect(() => {
        if (estimatedPremium > 0 && !customPremium && !selectedInfo) {
            setCustomPremium(estimatedPremium.toFixed(2));
        }
    }, [estimatedPremium]);

    // Switch to buy tab if an option is selected
    useEffect(() => {
        if (selectedOption) {
            setActiveTab("buy");
        }
    }, [selectedOption]);

    const handleSell = () => {
        if (!strikePrice || !customPremium) return;
        const expiryDate = new Date(Date.now() + expiryInterval);
        onSell({
            strike: parseFloat(strikePrice),
            expiry: expiryDate,
            contracts: sellContracts,
            premium: parseFloat(customPremium)
        });
    };

    const handleBuy = () => {
        if (!selectedOption && !selectedInfo?.rawOption) return;
        const optionToBuy = selectedOption || selectedInfo?.rawOption;
        onBuy({
            option: optionToBuy,
            contracts: buyContracts
        });
    };

    const estimatedCost = activeTab === "buy" && (selectedOption || selectedInfo)
        ? (selectedInfo?.premium || (selectedOption?.account?.premium?.toNumber() / 1_000_000)) * buyContracts
        : 0;

    // Determine if there's a real option to buy
    const hasBuyableOption = selectedOption || selectedInfo?.rawOption;

    return (
        <div className="bg-[#0a0b0d] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header Tabs */}
            <div className="flex border-b border-white/5">
                <button
                    onClick={() => setActiveTab("buy")}
                    className={`flex-1 py-4 text-sm font-medium transition-all relative ${
                        activeTab === "buy"
                            ? "text-white bg-green-500/10"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <span className={activeTab === "buy" ? "text-green-400" : ""}>Buy to Open</span>
                    {activeTab === "buy" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("sell")}
                    className={`flex-1 py-4 text-sm font-medium transition-all relative ${
                        activeTab === "sell"
                            ? "text-white bg-red-500/10"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <span className={activeTab === "sell" ? "text-red-400" : ""}>Sell to Open</span>
                    {activeTab === "sell" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                    )}
                </button>
            </div>

            <div className="p-5 space-y-5">
                {activeTab === "sell" ? (
                    /* ════════════════════════════════════════════════════════════════ */
                    /* SELL FORM */
                    /* ════════════════════════════════════════════════════════════════ */
                    <div className="space-y-4">
                        {/* Option Type Toggle */}
                        <div>
                            <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Option Type</label>
                            <div className="flex bg-white/5 rounded-lg p-1">
                                <button
                                    onClick={() => setOptionType("call")}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                        optionType === "call"
                                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                            : "text-white/60 hover:text-white"
                                    }`}
                                >
                                    Call
                                </button>
                                <button
                                    onClick={() => setOptionType("put")}
                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                        optionType === "put"
                                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                            : "text-white/60 hover:text-white"
                                    }`}
                                >
                                    Put
                                </button>
                            </div>
                        </div>

                        {/* Contracts */}
                        <div>
                            <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">
                                Contracts <span className="text-white/30">(100 Shares Each)</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={sellContracts}
                                onChange={(e) => setSellContracts(parseInt(e.target.value) || 1)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
                            />
                        </div>

                        {/* Strike Price */}
                        <div>
                            <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Strike Price (USDC)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={strikePrice}
                                    onChange={(e) => setStrikePrice(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
                                />
                            </div>
                            <p className="text-[10px] text-white/40 mt-1.5">
                                Spot: ${currentPrice?.toFixed(2)} • {strikePrice && currentPrice ? (
                                    parseFloat(strikePrice) > currentPrice 
                                        ? <span className="text-green-400">OTM ({((parseFloat(strikePrice) / currentPrice - 1) * 100).toFixed(1)}%)</span>
                                        : <span className="text-red-400">ITM ({((1 - parseFloat(strikePrice) / currentPrice) * 100).toFixed(1)}%)</span>
                                ) : '—'}
                            </p>
                        </div>

                        {/* Expiration */}
                        <div>
                            <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Expiration</label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {EXPIRY_OPTIONS.map((interval) => (
                                    <button
                                        key={interval.label}
                                        onClick={() => setExpiryInterval(interval.value)}
                                        className={`py-2.5 text-xs font-medium rounded-lg border transition-all ${
                                            expiryInterval === interval.value
                                                ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                                                : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        {interval.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Premium Section */}
                        <div className="pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-white">Premium / Contract</span>
                                <div className="relative w-28">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={customPremium}
                                        onChange={(e) => setCustomPremium(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-2 text-right font-bold text-white focus:outline-none focus:border-orange-500/50 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/40">Suggested: ${estimatedPremium.toFixed(2)}</span>
                                <span className="text-green-400 font-medium">
                                    Credit: ${(parseFloat(customPremium || "0") * sellContracts).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Greeks Preview */}
                        {selectedInfo && (
                            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                                <div className="grid grid-cols-4 gap-3 text-center">
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase">Delta</p>
                                        <p className="text-sm font-mono text-white/80">{selectedInfo.delta?.toFixed(2) || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase">IV</p>
                                        <p className="text-sm font-mono text-white/80">{selectedInfo.iv ? `${(selectedInfo.iv * 100).toFixed(1)}%` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase">Type</p>
                                        <p className={`text-sm font-medium ${selectedInfo.type === 'call' ? 'text-blue-400' : 'text-purple-400'}`}>
                                            {selectedInfo.type.toUpperCase()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase">Moneyness</p>
                                        <p className={`text-sm font-medium ${
                                            parseFloat(strikePrice) > currentPrice ? 'text-white/60' : 'text-green-400'
                                        }`}>
                                            {parseFloat(strikePrice) > currentPrice ? 'OTM' : 'ITM'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSell}
                            disabled={isProcessing || !strikePrice || !customPremium}
                            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing...
                                </span>
                            ) : (
                                "Review Sell Order"
                            )}
                        </button>
                    </div>
                ) : (
                    /* ════════════════════════════════════════════════════════════════ */
                    /* BUY FORM */
                    /* ════════════════════════════════════════════════════════════════ */
                    <div className="space-y-4">
                        {!hasBuyableOption ? (
                            <div className="text-center py-12 space-y-3">
                                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                    </svg>
                                </div>
                                <p className="text-white/60">Select an option from the chain to buy</p>
                                <p className="text-white/30 text-sm">Click on any row to auto-fill this form</p>
                            </div>
                        ) : (
                            <>
                                {/* Selected Option Summary */}
                                <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                            (selectedInfo?.type || 'call') === 'call' 
                                                ? 'bg-blue-500/20 text-blue-400' 
                                                : 'bg-purple-500/20 text-purple-400'
                                        }`}>
                                            {(selectedInfo?.type || 'CALL').toUpperCase()}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {selectedInfo?.rawOption ? 'On-chain Option' : 'Synthetic Quote'}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Strike</p>
                                            <p className="text-xl font-bold text-white">
                                                ${selectedInfo?.strike?.toFixed(2) || (selectedOption?.account?.strike?.toNumber() / 100_000_000).toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Premium</p>
                                            <p className="text-xl font-bold text-green-400">
                                                ${selectedInfo?.premium?.toFixed(2) || (selectedOption?.account?.premium?.toNumber() / 1_000_000).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-white/5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/50">Expiry</span>
                                            <span className="text-white font-medium">
                                                {selectedInfo?.expiration 
                                                    ? new Date(selectedInfo.expiration).toLocaleDateString() 
                                                    : selectedOption?.account?.expiryTs 
                                                        ? new Date(selectedOption.account.expiryTs.toNumber() * 1000).toLocaleDateString()
                                                        : '—'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Greeks Summary */}
                                {selectedInfo && (
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-white/40 uppercase">Δ</p>
                                            <p className="text-sm font-mono text-blue-400">{selectedInfo.delta?.toFixed(2) || '—'}</p>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-white/40 uppercase">IV</p>
                                            <p className="text-sm font-mono text-white/70">{selectedInfo.iv ? `${(selectedInfo.iv * 100).toFixed(0)}%` : '—'}</p>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-white/40 uppercase">B/E</p>
                                            <p className="text-sm font-mono text-white/70">
                                                ${((selectedInfo?.strike || 0) + (selectedInfo?.premium || 0)).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 text-center">
                                            <p className="text-[10px] text-white/40 uppercase">Max Loss</p>
                                            <p className="text-sm font-mono text-red-400">
                                                ${((selectedInfo?.premium || 0) * buyContracts * 100).toFixed(0)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Contracts */}
                                <div>
                                    <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">Contracts</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={buyContracts}
                                        onChange={(e) => setBuyContracts(parseInt(e.target.value) || 1)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-all"
                                    />
                                </div>

                                {/* Cost Summary */}
                                <div className="pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-white">Total Cost</span>
                                        <span className="text-2xl font-bold text-white">${estimatedCost.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-white/40 text-right">
                                        = {buyContracts} × ${(selectedInfo?.premium || (selectedOption?.account?.premium?.toNumber() / 1_000_000) || 0).toFixed(2)} premium
                                    </p>
                                </div>

                                <button
                                    onClick={handleBuy}
                                    disabled={isProcessing || !hasBuyableOption}
                                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : (
                                        "Submit Buy Order"
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pt-2">
                    <p className="text-[10px] text-white/30">
                        {activeTab === "sell" 
                            ? "Collateral required: 100 shares per contract" 
                            : "Premium paid upfront in USDC"
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}

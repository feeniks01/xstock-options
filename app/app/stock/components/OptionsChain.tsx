"use client";

import { useState } from "react";

interface OptionsChainProps {
    options: any[];
    selectedOption: any | null;
    onSelectOption: (option: any) => void;
    currentPrice: number;
}

export default function OptionsChain({ options, selectedOption, onSelectOption, currentPrice }: OptionsChainProps) {
    const [selectedExpiry, setSelectedExpiry] = useState<string>("all");
    const [optionType, setOptionType] = useState<"call" | "put">("call");
    const [side, setSide] = useState<"buy" | "sell">("buy");

    // Sort options by strike price descending
    const sortedOptions = [...options].sort((a, b) => {
        const strikeA = a.account.strike.toNumber();
        const strikeB = b.account.strike.toNumber();
        return strikeB - strikeA;
    });

    // Mock data generators for missing fields
    const getDelta = (strike: number, price: number) => {
        const diff = (price - strike) / price;
        return Math.min(Math.max(0.5 + diff * 2, 0), 1).toFixed(4);
    };

    const getIV = () => (30 + Math.random() * 20).toFixed(2) + "%";

    return (
        <div className="bg-black text-white min-h-[600px]">
            {/* Filters Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex bg-[#1e2124] rounded-full p-1">
                    <button className="px-4 py-1.5 rounded-full text-sm font-medium bg-[#1e2124] hover:bg-[#2a2e39] transition-colors">
                        Builder
                    </button>
                </div>

                <div className="flex bg-[#1e2124] rounded-full p-1">
                    <button
                        onClick={() => setSide("buy")}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-colors ${side === "buy" ? "bg-[#ff5500] text-white" : "text-gray-400 hover:text-white"}`}
                    >
                        Buy
                    </button>
                    <button
                        onClick={() => setSide("sell")}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-colors ${side === "sell" ? "bg-[#ff5500] text-white" : "text-gray-400 hover:text-white"}`}
                    >
                        Sell
                    </button>
                </div>

                <div className="flex bg-[#1e2124] rounded-full p-1">
                    <button
                        onClick={() => setOptionType("call")}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-colors ${optionType === "call" ? "bg-[#1e2124] text-white" : "text-gray-400 hover:text-white"}`}
                    >
                        Call
                    </button>
                    <button
                        onClick={() => setOptionType("put")}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-colors ${optionType === "put" ? "bg-[#1e2124] text-white" : "text-gray-400 hover:text-white"}`}
                    >
                        Put
                    </button>
                </div>

                <select
                    className="bg-[#1e2124] text-white px-4 py-2 rounded-md border-none outline-none text-sm"
                    value={selectedExpiry}
                    onChange={(e) => setSelectedExpiry(e.target.value)}
                >
                    <option value="all">Expiring All</option>
                    {/* Add dynamic expiries here */}
                </select>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-6 text-xs text-gray-500 font-medium mb-4 px-4">
                <div>Strike price</div>
                <div>Delta</div>
                <div>Implied volatility</div>
                <div>% Change</div>
                <div>Change</div>
                <div className="text-right">Ask Price</div>
            </div>

            {/* Options List */}
            <div className="space-y-1">
                {(() => {
                    const centerPrice = Math.round(currentPrice);
                    const maxStrike = centerPrice + 10;
                    const minStrike = centerPrice - 10;

                    // Create a set of unique strikes
                    const allStrikes = new Set<number>();

                    // 1. Add standard range ($1 intervals)
                    for (let s = maxStrike; s >= minStrike; s--) {
                        allStrikes.add(s);
                    }

                    // 2. Add any existing option strikes (even if outside range)
                    options.forEach(o => {
                        const s = o.account.strike.toNumber() / 100_000_000;
                        allStrikes.add(s);
                    });

                    // Convert to array and sort descending
                    const strikes = Array.from(allStrikes).sort((a, b) => b - a);

                    return strikes.map((strike, idx) => {
                        // Find options for this strike
                        const matchingOptions = options.filter(o => {
                            const optionStrike = o.account.strike.toNumber() / 100_000_000;
                            return Math.abs(optionStrike - strike) < 0.001; // Float comparison safety
                        });

                        // Sort by price (lowest first)
                        matchingOptions.sort((a, b) => {
                            const priceA = a.account.isListed ? a.account.askPrice.toNumber() : a.account.premium.toNumber();
                            const priceB = b.account.isListed ? b.account.askPrice.toNumber() : b.account.premium.toNumber();
                            return priceA - priceB;
                        });

                        const option = matchingOptions[0];
                        const hasOption = !!option;

                        let premium = 0;
                        let isResale = false;
                        let isSelected = false;

                        if (hasOption) {
                            isResale = option.account.isListed;
                            premium = isResale
                                ? option.account.askPrice.toNumber() / 1_000_000
                                : option.account.premium.toNumber() / 1_000_000;
                            isSelected = selectedOption?.publicKey.toString() === option.publicKey.toString();
                        }

                        // Share Price Line Logic
                        const nextStrike = strikes[idx + 1] || 0;
                        const showSharePrice = currentPrice <= strike && currentPrice > nextStrike;

                        return (
                            <div key={strike}>
                                <div
                                    onClick={() => hasOption && onSelectOption(option)}
                                    className={`grid grid-cols-6 items-center px-4 py-3 transition-colors ${hasOption
                                        ? `cursor-pointer hover:bg-[#1e2124] ${isSelected ? 'bg-[#1e2124]' : ''}`
                                        : 'opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    <div className={`font-bold ${hasOption ? 'text-white' : 'text-gray-600'}`}>${strike.toFixed(1)}</div>
                                    <div className="text-gray-400">{hasOption ? getDelta(strike, currentPrice) : '-'}</div>
                                    <div className="text-gray-400">{hasOption ? getIV() : '-'}</div>
                                    <div className="text-red-500">{hasOption ? `-${(Math.random() * 10).toFixed(2)}%` : '-'}</div>
                                    <div className="text-red-500">{hasOption ? `-$${(Math.random() * 0.5).toFixed(2)}` : '-'}</div>
                                    <div className="text-right">
                                        {hasOption ? (
                                            <div className={`inline-block px-3 py-1 rounded min-w-[60px] text-center font-medium ${isSelected ? 'bg-[#ff5500] text-white' : 'bg-[#2a2e39] text-[#ff5500]'}`}>
                                                ${premium.toFixed(2)}
                                                {isResale && <span className="ml-1 text-[10px] text-yellow-500">R</span>}
                                            </div>
                                        ) : (
                                            <div className="inline-block px-3 py-1 rounded min-w-[60px] text-center font-medium text-gray-600 bg-[#2a2e39]/50">
                                                -
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {showSharePrice && (
                                    <div className="relative flex items-center justify-center py-4">
                                        <div className="absolute w-full h-px bg-[#2a2e39]"></div>
                                        <div className="relative bg-[#ff5500] text-white px-4 py-1 rounded-full text-sm font-bold z-10">
                                            Share price: ${currentPrice.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
}

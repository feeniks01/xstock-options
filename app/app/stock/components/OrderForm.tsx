"use client";

import { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { calculateOptionPremium } from "../../../utils/pricing";

interface OrderFormProps {
    currentPrice: number;
    selectedOption: any | null; // Replace 'any' with proper type later
    onSell: (params: { strike: number; expiry: Date; contracts: number; premium: number }) => void;
    onBuy: (params: { option: any; contracts: number }) => void;
    isProcessing: boolean;
}

export default function OrderForm({ currentPrice, selectedOption, onSell, onBuy, isProcessing }: OrderFormProps) {
    const [activeTab, setActiveTab] = useState<"buy" | "sell">("sell");

    // Sell State
    const [strikePrice, setStrikePrice] = useState<string>("");
    const [expiryInterval, setExpiryInterval] = useState<number>(24 * 60 * 60 * 1000); // Default 24h
    const [sellContracts, setSellContracts] = useState<number>(1);
    const [customPremium, setCustomPremium] = useState<string>("");

    // Buy State
    const [buyContracts, setBuyContracts] = useState<number>(1);

    // Initialize defaults when price loads
    useEffect(() => {
        if (currentPrice && !strikePrice) {
            setStrikePrice((Math.ceil(currentPrice * 1.1)).toString()); // Default 10% OTM
        }
    }, [currentPrice]);

    // Calculate estimated premium for suggestion
    const calculatedExpiryDate = new Date(Date.now() + expiryInterval);
    const estimatedPremium = (currentPrice && strikePrice)
        ? calculateOptionPremium(currentPrice, parseFloat(strikePrice), calculatedExpiryDate) * 100 // Total premium per contract (100 shares)
        : 0;

    // Update custom premium when estimate changes (only if user hasn't manually edited it? Or just suggest it?)
    // For now, let's just set it initially or if it's empty.
    useEffect(() => {
        if (estimatedPremium > 0 && !customPremium) {
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
        if (!selectedOption) return;
        onBuy({
            option: selectedOption,
            contracts: buyContracts
        });
    };

    // Calculations
    // calculatedExpiryDate and estimatedPremium are now calculated above

    const estimatedCredit = activeTab === "sell"
        ? (parseFloat(customPremium || "0") * sellContracts)
        : 0;

    const estimatedCost = activeTab === "buy" && selectedOption
        ? (selectedOption.account.premium.toNumber() / 1_000_000) * buyContracts
        : 0;

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg sticky top-6">
            {/* Header Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab("buy")}
                    className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === "buy"
                        ? "text-foreground border-b-2 border-primary bg-secondary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/5"
                        }`}
                >
                    Buy to Open
                </button>
                <button
                    onClick={() => setActiveTab("sell")}
                    className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === "sell"
                        ? "text-foreground border-b-2 border-primary bg-secondary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/5"
                        }`}
                >
                    Sell to Open
                </button>
            </div>

            <div className="p-6 space-y-6">
                {activeTab === "sell" ? (
                    /* SELL FORM */
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contracts (100 Shares Each)</label>
                            <input
                                type="number"
                                min="1"
                                value={sellContracts}
                                onChange={(e) => setSellContracts(parseInt(e.target.value) || 1)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Strike Price (USDC)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={strikePrice}
                                    onChange={(e) => setStrikePrice(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Current Price: ${currentPrice?.toFixed(2)}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Expiration</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: "15m", value: 15 * 60 * 1000 },
                                    { label: "1h", value: 60 * 60 * 1000 },
                                    { label: "24h", value: 24 * 60 * 60 * 1000 },
                                    { label: "72h", value: 72 * 60 * 60 * 1000 },
                                    { label: "1w", value: 7 * 24 * 60 * 60 * 1000 },
                                ].map((interval) => (
                                    <button
                                        key={interval.label}
                                        onClick={() => setExpiryInterval(interval.value)}
                                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors ${expiryInterval === interval.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-foreground border-border hover:bg-secondary/20"
                                            }`}
                                    >
                                        {interval.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-foreground">Premium per Contract</span>
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={customPremium}
                                        onChange={(e) => setCustomPremium(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg pl-6 pr-2 py-1 text-right font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>Suggested: ${estimatedPremium.toFixed(2)}</span>
                                <span>Total Credit: ${(parseFloat(customPremium || "0") * sellContracts).toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSell}
                            disabled={isProcessing}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? "Processing..." : "Review Order"}
                        </button>
                    </div>
                ) : (
                    /* BUY FORM */
                    <div className="space-y-4">
                        {!selectedOption ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Select an option from the chain below to buy.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-secondary/20 p-4 rounded-lg border border-border">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm text-muted-foreground">Strike</span>
                                        <span className="font-medium">${(selectedOption.account.strike.toNumber() / 100_000_000).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Expiry</span>
                                        <span className="font-medium">
                                            {new Date(selectedOption.account.expiryTs.toNumber() * 1000).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contracts</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={buyContracts}
                                        onChange={(e) => setBuyContracts(parseInt(e.target.value) || 1)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                    />
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium text-foreground">Estimated Cost</span>
                                        <span className="text-xl font-bold text-foreground">${estimatedCost.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleBuy}
                                    disabled={isProcessing}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? "Processing..." : "Submit Buy Order"}
                                </button>
                            </>
                        )}
                    </div>
                )}

                <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                        {activeTab === "sell" ? "Collateral required: 100 shares per contract" : "Premium paid upfront"}
                    </p>
                </div>
            </div>
        </div >
    );
}

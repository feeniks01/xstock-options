"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateOptionPremium } from "../../../utils/pricing";

interface PositionCardProps {
    position: any; // Replace with proper type
    currentPrice: number;
    isSeller: boolean;
    onExercise: () => void;
    onReclaim: () => void;
    onListForSale: (price: number) => void;
    onCancelListing: () => void;
    symbol?: string;
    readOnly?: boolean;
}

export default function PositionCard({
    position,
    currentPrice,
    isSeller,
    onExercise,
    onReclaim,
    onListForSale,
    onCancelListing,
    symbol,
    readOnly = false
}: PositionCardProps) {
    const router = useRouter();
    const strike = position.account.strike.toNumber() / 100_000_000;
    const premium = position.account.premium.toNumber() / 1_000_000;
    const expiry = new Date(position.account.expiryTs.toNumber() * 1000);
    const contracts = 1; // Assuming 1 contract per position entry for now, or aggregate later

    // Calculations
    // Market Value: Use Black-Scholes to estimate current value of the option
    const premiumPerShare = calculateOptionPremium(currentPrice, strike, expiry);
    const marketValue = premiumPerShare * 100;
    const optionPricePerShare = marketValue / 100;

    // Cost Basis: The premium stored is already the total premium for the contract
    const costBasis = premium;
    const costPerShare = costBasis / 100;

    const totalReturn = isSeller
        ? costBasis - marketValue // Seller makes money if market value drops
        : marketValue - costBasis; // Buyer makes money if market value rises

    const returnPercent = (totalReturn / costBasis) * 100;
    const breakeven = isSeller ? strike - costPerShare : strike + costPerShare;

    const isExpired = new Date() > expiry;
    const isExercised = position.account.exercised;
    const statusLabel = isSeller ? "SELLER" : "BUYER";

    const listedLabel = useMemo(() => {
        if (!position.account.isListed) return null;
        return `$${(position.account.askPrice.toNumber() / 1_000_000).toFixed(2)}`;
    }, [position.account.isListed, position.account.askPrice]);

    const changeLabel = useMemo(() => {
        const diff = optionPricePerShare - costPerShare;
        const pct = (diff / costPerShare) * 100;
        return { diff, pct };
    }, [optionPricePerShare, costPerShare]);

    const [isListing, setIsListing] = useState(false);
    const [listPrice, setListPrice] = useState("");

    const handleListClick = () => {
        if (!listPrice) return;
        onListForSale(parseFloat(listPrice));
        setIsListing(false);
    };

    return (
        <div className="bg-[#0a0b0f] border border-border/60 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex flex-col lg:flex-row">
                {/* Left: Overview */}
                <div className="flex-1 p-6 lg:p-8 space-y-8">
                    {/* Top header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-orange-400">
                                    {symbol ? `${symbol} $${strike.toFixed(0)} Call` : `Call @ $${strike.toFixed(2)}`}
                                </p>
                                <span className="text-[10px] font-semibold px-2 py-1 rounded bg-border/50 text-muted-foreground">
                                    {statusLabel}
                                </span>
                                {position.account.isListed && (
                                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-yellow-500/15 text-yellow-400">
                                        LISTED {listedLabel}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-bold text-foreground">${optionPricePerShare.toFixed(2)}</span>
                                <span className={`${changeLabel.diff >= 0 ? "text-green-500" : "text-red-500"} text-sm font-semibold`}>
                                    {changeLabel.diff >= 0 ? "+" : ""}${changeLabel.diff.toFixed(2)} ({changeLabel.pct.toFixed(2)}%)
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Contracts: {contracts} · Status: {isExpired ? "Expired" : isExercised ? "Exercised" : "Open"}
                            </p>
                        </div>
                        <div className="bg-[#111217] border border-border/60 rounded-2xl px-4 py-3 text-right min-w-[220px]">
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Position value</p>
                            <p className="text-2xl font-bold text-foreground">${marketValue.toFixed(2)}</p>
                            <p className="text-[11px] text-muted-foreground">
                                Est. credit before fees · {contracts} contract{contracts > 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#0f1015] border border-border/60 rounded-2xl p-4 space-y-2">
                            <p className="text-xs text-muted-foreground">Market value</p>
                            <p className="text-2xl font-semibold text-foreground">${marketValue.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Based on Black-Scholes estimate</p>
                        </div>
                        <div className="bg-[#0f1015] border border-border/60 rounded-2xl p-4 space-y-2">
                            <p className="text-xs text-muted-foreground">Total return</p>
                            <p className={`text-2xl font-semibold ${totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">From cost basis ${costBasis.toFixed(2)}</p>
                        </div>
                        <div className="bg-[#0f1015] border border-border/60 rounded-2xl p-4 space-y-2">
                            <p className="text-xs text-muted-foreground">Current price</p>
                            <p className="text-2xl font-semibold text-foreground">${currentPrice.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Underlying spot</p>
                        </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#0f1015] border border-border/60 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Strike price</p>
                                    <p className="text-xl font-semibold text-foreground">${strike.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Breakeven</p>
                                    <p className="text-xl font-semibold text-foreground">${breakeven.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/50 pt-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Expiration date</p>
                                    <p className="text-lg font-semibold text-foreground">{expiry.toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Contracts</p>
                                    <p className="text-lg font-semibold text-foreground">{contracts}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#0f1015] border border-border/60 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Avg cost / share</p>
                                    <p className="text-xl font-semibold text-foreground">${costPerShare.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Return</p>
                                    <p className={`text-xl font-semibold ${totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                                        {totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/50 pt-3 text-sm text-muted-foreground">
                                <span>Date bought</span>
                                <span>—</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {!readOnly && (
                        <div className="flex flex-wrap gap-3">
                            {!isExercised && !isExpired && (
                                <>
                                    {isSeller ? (
                                        <button
                                            onClick={onReclaim}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                                        >
                                            Reclaim collateral
                                        </button>
                                    ) : (
                                        <button
                                            onClick={onExercise}
                                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-opacity"
                                        >
                                            Exercise this option
                                        </button>
                                    )}

                                    {!isSeller && (
                                        <>
                                            {!position.account.isListed ? (
                                                isListing ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative w-28">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                            <input
                                                                type="number"
                                                                value={listPrice}
                                                                onChange={(e) => setListPrice(e.target.value)}
                                                                placeholder="Price"
                                                                className="w-full bg-background border border-border rounded-lg pl-5 pr-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={handleListClick}
                                                            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setIsListing(false)}
                                                            className="text-muted-foreground hover:text-foreground text-sm px-2"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setIsListing(true)}
                                                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                                                    >
                                                        List for sale
                                                    </button>
                                                )
                                            ) : (
                                                <button
                                                    onClick={onCancelListing}
                                                    className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                                                >
                                                    Cancel listing
                                                </button>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {isExpired && isSeller && !isExercised && (
                                <button
                                    onClick={onReclaim}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                                >
                                    Reclaim collateral
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Order panel */}
                <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-border/60 bg-[#0e0f14] p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{isSeller ? "Close position" : "Buy to close"}</p>
                        <span className="text-xs bg-border/60 text-muted-foreground px-2 py-1 rounded">
                            {contracts} Contract{contracts > 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="bg-[#111217] border border-border/60 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Limit price</span>
                            <span className="text-base font-semibold text-foreground">${optionPricePerShare.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Estimated credit</span>
                            <span>${marketValue.toFixed(2)}</span>
                        </div>
                    </div>

                    {!readOnly && !isExercised && (
                        <button
                            onClick={isSeller ? onReclaim : onExercise}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-opacity"
                        >
                            {isSeller ? "Review closing" : "Review / Exercise"}
                        </button>
                    )}

                    <div className="space-y-2">
                        <button
                            onClick={() => router.push("/stock/chain")}
                            className="w-full border border-border/60 hover:border-border text-foreground font-medium py-3 rounded-xl transition-colors"
                        >
                            View options chain
                        </button>
                        {!readOnly && !isSeller && !position.account.isListed && !isExercised && !isExpired && (
                            <button
                                onClick={() => setIsListing(true)}
                                className="w-full border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 font-medium py-3 rounded-xl transition-colors"
                            >
                                Roll / List position
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

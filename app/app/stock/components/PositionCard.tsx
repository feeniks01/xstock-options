"use client";

import { useState } from "react";
import { calculateOptionPremium } from "../../../utils/pricing";

interface PositionCardProps {
    position: any; // Replace with proper type
    currentPrice: number;
    isSeller: boolean;
    onExercise: () => void;
    onReclaim: () => void;
    onListForSale: (price: number) => void;
    onCancelListing: () => void;
}

export default function PositionCard({ position, currentPrice, isSeller, onExercise, onReclaim, onListForSale, onCancelListing }: PositionCardProps) {
    const strike = position.account.strike.toNumber() / 100_000_000;
    const premium = position.account.premium.toNumber() / 1_000_000;
    const expiry = new Date(position.account.expiryTs.toNumber() * 1000);
    const contracts = 1; // Assuming 1 contract per position entry for now, or aggregate later

    // Calculations
    // Market Value: Use Black-Scholes to estimate current value of the option
    const premiumPerShare = calculateOptionPremium(currentPrice, strike, expiry);
    const marketValue = premiumPerShare * 100;

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

    const [isListing, setIsListing] = useState(false);
    const [listPrice, setListPrice] = useState("");

    const handleListClick = () => {
        if (!listPrice) return;
        onListForSale(parseFloat(listPrice));
        setIsListing(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 mb-4">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Your Position</h3>
                    <div className="flex gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSeller ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                            {isSeller ? 'SELLER' : 'BUYER'}
                        </span>
                        {isExpired && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">EXPIRED</span>}
                        {isExercised && <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">EXERCISED</span>}
                        {position.account.isListed && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">LISTED: ${position.account.askPrice.toNumber() / 1_000_000}</span>}
                    </div>
                </div>
                {!isExercised && !isExpired && (
                    <div className="flex gap-2">
                        {isSeller ? (
                            <button
                                onClick={onReclaim}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                            >
                                Reclaim Collateral
                            </button>
                        ) : (
                            <>
                                {!position.account.isListed ? (
                                    isListing ? (
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-24">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                <input
                                                    type="number"
                                                    value={listPrice}
                                                    onChange={(e) => setListPrice(e.target.value)}
                                                    placeholder="Price"
                                                    className="w-full bg-background border border-border rounded-lg pl-5 pr-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <button
                                                onClick={handleListClick}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3 py-1 rounded-lg transition-colors"
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
                                        <>
                                            <button
                                                onClick={() => setIsListing(true)}
                                                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                            >
                                                List for Sale
                                            </button>
                                            <button
                                                onClick={onExercise}
                                                className="bg-green-500/10 hover:bg-green-500/20 text-green-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                            >
                                                Exercise Option
                                            </button>
                                        </>
                                    )
                                ) : (
                                    <button
                                        onClick={onCancelListing}
                                        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Cancel Listing
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
                {isExpired && isSeller && !isExercised && (
                    <button
                        onClick={onReclaim}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        Reclaim Collateral
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Market Value</p>
                        <p className="text-2xl font-bold text-foreground">${marketValue.toFixed(2)}</p>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Current Price</span>
                        <span className="font-medium">${currentPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Strike Price</span>
                        <span className="font-medium">${strike.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Total Return</span>
                        <span className={`font-medium ${totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)} ({returnPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Expiration Date</p>
                        <p className="text-2xl font-bold text-foreground">{expiry.toLocaleDateString()}</p>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Avg Cost / Share</span>
                        <span className="font-medium">${costPerShare.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Breakeven Price</span>
                        <span className="font-medium">${breakeven.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Contracts</span>
                        <span className="font-medium">{contracts}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Search, TrendingUp, TrendingDown, Loader2, ChevronRight,
    Sparkles, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { usePythPrices } from "../../../hooks/usePythPrices";
import { XSTOCKS } from "../../../utils/constants";

// Map xStock symbols to Pyth symbols for price fetching
const PYTH_SYMBOL_MAP: Record<string, string> = {
    "NVDAx": "NVDAx",
    "AAPLx": "AAPLx",
    "TSLAx": "TSLAx",
    "SPYx": "SPYx",
    "METAx": "METAx",
    "AMZNx": "AMZNx",
    "MSFTx": "MSFTx",
    "GOOGLx": "GOOGLx",
};

// Featured stocks for the hero section
const FEATURED_SYMBOLS = ["NVDAx", "TSLAx", "AAPLx", "SPYx", "METAx"];

interface StockCardProps {
    symbol: string;
    name: string;
    logo?: string;
    price: number;
    priceChange: number;
    priceChangePct: number;
    isLoading?: boolean;
}

function StockCard({ symbol, name, logo, price, priceChange, priceChangePct, isLoading }: StockCardProps) {
    const isPositive = priceChange >= 0;

    return (
        <Link
            href={`/v2/trading/${symbol.toLowerCase()}`}
            className="group bg-secondary/30 border border-border hover:border-blue-500/30 hover:bg-secondary/50 rounded-xl p-4 transition-all"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    {logo ? (
                        <img src={logo} alt={symbol} className="w-10 h-10 rounded-xl" />
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                            {symbol.slice(0, 2)}
                        </div>
                    )}
                    <div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                            {symbol}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{name}</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Price</p>
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                        <p className="text-lg font-bold text-foreground">
                            ${price > 0 ? price.toFixed(2) : "—"}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5">24h</p>
                    {isLoading ? (
                        <div className="h-5" />
                    ) : (
                        <div className={`flex items-center gap-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                            {isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            <span className="text-sm font-semibold">
                                {priceChangePct !== 0 ? `${isPositive ? "+" : ""}${priceChangePct.toFixed(2)}%` : "—"}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}

export default function TradingPage() {
    const { connected } = useWallet();
    const { prices, loading: pricesLoading, getPrice } = usePythPrices();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "price" | "change">("name");

    // Filter and sort stocks
    const filteredStocks = useMemo(() => {
        let stocks = XSTOCKS.filter((stock) => {
            const query = searchQuery.toLowerCase();
            return (
                stock.symbol.toLowerCase().includes(query) ||
                stock.name.toLowerCase().includes(query)
            );
        });

        // Sort stocks
        stocks.sort((a, b) => {
            switch (sortBy) {
                case "price":
                    const priceA = getPrice(a.symbol) || 0;
                    const priceB = getPrice(b.symbol) || 0;
                    return priceB - priceA;
                case "change":
                    // For now, sort by symbol if no real change data
                    return a.symbol.localeCompare(b.symbol);
                default:
                    return a.symbol.localeCompare(b.symbol);
            }
        });

        return stocks;
    }, [searchQuery, sortBy, getPrice]);

    // Featured stocks with prices
    const featuredStocks = useMemo(() => {
        return FEATURED_SYMBOLS.map((symbol) => {
            const stock = XSTOCKS.find((s) => s.symbol === symbol);
            const price = getPrice(symbol) || 0;
            return {
                symbol,
                name: stock?.name || symbol,
                logo: stock?.logo,
                price,
                // Mock change data - in production would come from historical data
                priceChange: price * (Math.random() * 0.06 - 0.03),
                priceChangePct: Math.random() * 6 - 3,
            };
        });
    }, [getPrice]);

    return (
        <div className="w-full space-y-6">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600/20 via-blue-600/10 to-background border border-emerald-500/20 p-6">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-foreground mb-3">
                        Trade xStocks & Options
                    </h1>
                    <p className="text-muted-foreground text-lg mb-6 max-w-xl">
                        Browse synthetic equities on Solana. Trade stocks and options with deep liquidity.
                    </p>

                    {/* Featured Stocks Row */}
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {featuredStocks.map((stock) => (
                            <Link
                                key={stock.symbol}
                                href={`/v2/trading/${stock.symbol.toLowerCase()}`}
                                className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-background/50 border border-border hover:border-blue-500/30 rounded-lg transition-colors"
                            >
                                {stock.logo ? (
                                    <img src={stock.logo} alt={stock.symbol} className="w-8 h-8 rounded-lg" />
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                        {stock.symbol.slice(0, 2)}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-foreground text-sm">{stock.symbol}</p>
                                    <p className="text-xs text-muted-foreground">
                                        ${stock.price > 0 ? stock.price.toFixed(2) : "—"}
                                    </p>
                                </div>
                                <div className={`ml-2 text-sm font-medium ${stock.priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {stock.priceChange >= 0 ? (
                                        <TrendingUp className="w-4 h-4" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4" />
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
                {/* Decorative gradient */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
            </section>

            {/* Search and Filters */}
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by symbol or name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as "name" | "price" | "change")}
                            className="px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="name">Sort by Name</option>
                            <option value="price">Sort by Price</option>
                            <option value="change">Sort by Change</option>
                        </select>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{filteredStocks.length} stocks available</span>
                    {pricesLoading && (
                        <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading prices...
                        </span>
                    )}
                </div>
            </section>

            {/* Stock Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStocks.map((stock) => {
                    const price = getPrice(stock.symbol) || 0;
                    // Mock change data - in production would come from historical data
                    const priceChange = price * (Math.random() * 0.06 - 0.03);
                    const priceChangePct = Math.random() * 6 - 3;

                    return (
                        <StockCard
                            key={stock.symbol}
                            symbol={stock.symbol}
                            name={stock.name}
                            logo={stock.logo}
                            price={price}
                            priceChange={priceChange}
                            priceChangePct={priceChangePct}
                            isLoading={pricesLoading}
                        />
                    );
                })}
            </section>

            {/* Empty State */}
            {filteredStocks.length === 0 && (
                <div className="text-center py-12 bg-secondary/30 rounded-xl border border-border">
                    <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No stocks found</h3>
                    <p className="text-muted-foreground">
                        Try adjusting your search query
                    </p>
                </div>
            )}
        </div>
    );
}

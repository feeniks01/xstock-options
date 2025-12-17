"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    RefreshCw, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle,
    Copy, ExternalLink, Search, Info, X, Check, ChevronRight, Activity, Shield
} from "lucide-react";

// Pyth Feed IDs for xStocks
const PYTH_FEEDS: Record<string, string> = {
    NVDAx: "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    TSLAx: "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    SPYx: "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    AAPLx: "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    METAx: "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
};

// Health thresholds
const STALE_THRESHOLD_SECONDS = 300; // 5 minutes
const CONFIDENCE_THRESHOLD_PERCENT = 1; // 1% of price

interface AssetPrice {
    symbol: string;
    feedId: string;
    price: number | null;
    confidence: number | null;
    confidencePercent: number | null;
    change24h: number | null;
    lastUpdated: number | null;
    ageSeconds: number | null;
    status: "loading" | "ok" | "stale" | "error";
    emaPrice: number | null;
}

const HERMES_URL = "https://hermes.pyth.network";
const REFRESH_INTERVALS = [
    { label: "5s", value: 5000 },
    { label: "10s", value: 10000 },
    { label: "30s", value: 30000 },
    { label: "60s", value: 60000 },
];

type SortOption = "alphabetical" | "age-worst" | "confidence-worst";

export default function OraclePage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [prices, setPrices] = useState<AssetPrice[]>(
        Object.entries(PYTH_FEEDS).map(([symbol, feedId]) => ({
            symbol,
            feedId,
            price: null,
            confidence: null,
            confidencePercent: null,
            change24h: null,
            lastUpdated: null,
            ageSeconds: null,
            status: "loading",
            emaPrice: null,
        }))
    );
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(10000);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("alphabetical");
    const [showHealthyOnly, setShowHealthyOnly] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Selected feed from URL or state
    const selectedFeed = searchParams.get("feed") || null;
    const setSelectedFeed = useCallback((symbol: string | null) => {
        if (symbol) {
            router.push(`?feed=${symbol}`, { scroll: false });
        } else {
            router.push("/v2/oracle", { scroll: false });
        }
    }, [router]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();

            const symbols = filteredPrices.map(p => p.symbol);
            const currentIndex = symbols.indexOf(selectedFeed || "");

            if (e.key === "ArrowDown") {
                const nextIndex = currentIndex < symbols.length - 1 ? currentIndex + 1 : 0;
                setSelectedFeed(symbols[nextIndex]);
            } else if (e.key === "ArrowUp") {
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : symbols.length - 1;
                setSelectedFeed(symbols[prevIndex]);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedFeed, setSelectedFeed]);

    const fetchPrices = async () => {
        setIsRefreshing(true);
        const feedIds = Object.values(PYTH_FEEDS);
        const idsParam = feedIds.map(id => `ids[]=${id}`).join("&");

        try {
            const response = await fetch(
                `${HERMES_URL}/v2/updates/price/latest?${idsParam}&parsed=true`
            );
            const data = await response.json();

            if (data.parsed) {
                const now = Date.now() / 1000;
                const updatedPrices = Object.entries(PYTH_FEEDS).map(([symbol, feedId]) => {
                    const feedData = data.parsed.find(
                        (p: any) => `0x${p.id}` === feedId
                    );

                    if (feedData) {
                        const price = parseFloat(feedData.price.price) * Math.pow(10, feedData.price.expo);
                        const conf = parseFloat(feedData.price.conf) * Math.pow(10, feedData.price.expo);
                        const emaPrice = parseFloat(feedData.ema_price.price) * Math.pow(10, feedData.ema_price.expo);
                        const publishTime = feedData.price.publish_time;
                        const ageSeconds = Math.floor(now - publishTime);
                        const confidencePercent = price > 0 ? (conf / price) * 100 : null;
                        const change = ((price - emaPrice) / emaPrice) * 100;
                        const isStale = ageSeconds > STALE_THRESHOLD_SECONDS;
                        const isWideConf = confidencePercent !== null && confidencePercent > CONFIDENCE_THRESHOLD_PERCENT;

                        return {
                            symbol,
                            feedId,
                            price,
                            confidence: conf,
                            confidencePercent,
                            change24h: change,
                            lastUpdated: publishTime,
                            ageSeconds,
                            status: (isStale || isWideConf ? "stale" : "ok") as "ok" | "stale",
                            emaPrice,
                        };
                    }

                    return {
                        symbol, feedId,
                        price: null, confidence: null, confidencePercent: null,
                        change24h: null, lastUpdated: null, ageSeconds: null,
                        status: "error" as const, emaPrice: null,
                    };
                });

                setPrices(updatedPrices);
            }
        } catch (error) {
            console.error("Failed to fetch prices:", error);
            setPrices(prev => prev.map(p => ({ ...p, status: "error" as const })));
        }

        setLastRefresh(new Date());
        setIsRefreshing(false);
    };

    useEffect(() => {
        fetchPrices();
        if (autoRefresh) {
            const interval = setInterval(fetchPrices, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval]);

    // Update ages every second
    useEffect(() => {
        const ageInterval = setInterval(() => {
            setPrices(prev => prev.map(p => {
                if (p.lastUpdated) {
                    const now = Date.now() / 1000;
                    const ageSeconds = Math.floor(now - p.lastUpdated);
                    const isStale = ageSeconds > STALE_THRESHOLD_SECONDS;
                    const isWideConf = p.confidencePercent !== null && p.confidencePercent > CONFIDENCE_THRESHOLD_PERCENT;
                    return { ...p, ageSeconds, status: isStale || isWideConf ? "stale" : "ok" };
                }
                return p;
            }));
        }, 1000);
        return () => clearInterval(ageInterval);
    }, []);

    const formatAge = (seconds: number | null): { text: string; label: string } => {
        if (seconds === null) return { text: "—", label: "" };
        if (seconds < 60) return { text: `${seconds}s`, label: "Fresh" };
        if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            return { text: `${mins}m ${seconds % 60}s`, label: seconds > STALE_THRESHOLD_SECONDS ? "Stale" : "Fresh" };
        }
        return { text: `${Math.floor(seconds / 3600)}h+`, label: "Stale" };
    };

    const formatPrice = (price: number | null) => {
        if (price === null) return "—";
        return new Intl.NumberFormat("en-US", {
            style: "currency", currency: "USD",
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(price);
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Filtered and sorted prices
    const filteredPrices = useMemo(() => {
        let result = [...prices];
        if (searchQuery) {
            result = result.filter(p => p.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        if (showHealthyOnly) {
            result = result.filter(p => p.status === "ok");
        }
        switch (sortBy) {
            case "age-worst": result.sort((a, b) => (b.ageSeconds || 0) - (a.ageSeconds || 0)); break;
            case "confidence-worst": result.sort((a, b) => (b.confidencePercent || 0) - (a.confidencePercent || 0)); break;
            default: result.sort((a, b) => a.symbol.localeCompare(b.symbol));
        }
        return result;
    }, [prices, searchQuery, sortBy, showHealthyOnly]);

    const selectedAsset = prices.find(p => p.symbol === selectedFeed) || null;
    const healthyCount = prices.filter(p => p.status === "ok").length;
    const totalCount = prices.length;
    const worstAge = Math.max(...prices.map(p => p.ageSeconds || 0));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-white">Oracle Price Feeds</h1>
                        <button onClick={() => setShowAbout(true)} className="text-gray-500 hover:text-gray-300">
                            <Info className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${healthyCount === totalCount ? "bg-green-500" : "bg-yellow-500"}`} />
                    <span>Pyth</span>
                    <span className="text-gray-600">•</span>
                    <span>{healthyCount}/{totalCount} healthy</span>
                    <span className="text-gray-600">•</span>
                    <span>Last refresh {lastRefresh?.toLocaleTimeString() || "—"}</span>
                    <span className="text-gray-600">•</span>
                    <span>Worst age {formatAge(worstAge).text}</span>
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search feeds..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
                    />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300">
                        <option value="alphabetical">A-Z</option>
                        <option value="age-worst">Age ↓</option>
                        <option value="confidence-worst">Conf ↓</option>
                    </select>
                    <button onClick={() => setShowHealthyOnly(!showHealthyOnly)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${showHealthyOnly
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : "bg-gray-800/50 border-gray-700/50 text-gray-400"}`}>
                        Healthy
                    </button>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-3.5 h-3.5 rounded" />
                            Auto
                        </label>
                        <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            disabled={!autoRefresh} className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-gray-400 disabled:opacity-50">
                            {REFRESH_INTERVALS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <button onClick={fetchPrices} disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white disabled:opacity-50">
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Main Content: Cards Grid + Details Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "400px" }}>
                {/* Left: Compact Oracle Cards (2/3 or full if no selection) */}
                <div className={`${selectedAsset ? "lg:col-span-2" : "lg:col-span-3"}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filteredPrices.map((asset) => {
                            const ageInfo = formatAge(asset.ageSeconds);
                            const isStale = asset.ageSeconds !== null && asset.ageSeconds > STALE_THRESHOLD_SECONDS;
                            const isWideConf = asset.confidencePercent !== null && asset.confidencePercent > CONFIDENCE_THRESHOLD_PERCENT;
                            const isSelected = selectedFeed === asset.symbol;

                            return (
                                <button
                                    key={asset.symbol}
                                    onClick={() => setSelectedFeed(isSelected ? null : asset.symbol)}
                                    className={`relative bg-gray-800/40 rounded-xl border p-4 text-left transition-all hover:bg-gray-800/60 ${isSelected
                                            ? "border-purple-500/60 ring-1 ring-purple-500/30"
                                            : "border-gray-700/40 hover:border-gray-600/60"
                                        }`}
                                >
                                    {/* Selected indicator */}
                                    {isSelected && (
                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-purple-500 rounded-r" />
                                    )}

                                    {/* Ticker + Health Badge */}
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-bold text-white">{asset.symbol}</h3>
                                        <span className={`w-2 h-2 rounded-full ${asset.status === "ok" ? "bg-green-500"
                                                : asset.status === "stale" ? "bg-yellow-500"
                                                    : "bg-red-500"
                                            }`} />
                                    </div>

                                    {/* Price */}
                                    <div className="text-xl font-bold text-white mb-2">
                                        {formatPrice(asset.price)}
                                    </div>

                                    {/* Confidence + Freshness */}
                                    <div className="flex items-center justify-between text-xs">
                                        <div className={`flex items-center gap-1 ${isStale ? "text-yellow-400" : "text-gray-500"}`}>
                                            <Clock className="w-3 h-3" />
                                            <span>{ageInfo.text}</span>
                                        </div>
                                        <div className={isWideConf ? "text-yellow-400" : "text-gray-500"}>
                                            ±{asset.confidencePercent?.toFixed(3) || "—"}%
                                        </div>
                                    </div>

                                    {/* EMA comparison */}
                                    {asset.change24h !== null && (
                                        <div className={`flex items-center gap-1 mt-2 text-[10px] ${asset.change24h >= 0 ? "text-green-400/60" : "text-red-400/60"
                                            }`}>
                                            {asset.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            <span>{asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}% vs EMA</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Details Panel (1/3) */}
                {selectedAsset ? (
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-5 sticky top-20">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${selectedAsset.status === "ok" ? "bg-green-500"
                                            : selectedAsset.status === "stale" ? "bg-yellow-500"
                                                : "bg-red-500"
                                        }`} />
                                    <h2 className="text-xl font-bold text-white">{selectedAsset.symbol}</h2>
                                </div>
                                <button onClick={() => setSelectedFeed(null)} className="text-gray-500 hover:text-gray-300">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Price */}
                            <div className="mb-6">
                                <p className="text-xs text-gray-500 mb-1">Current Price</p>
                                <p className="text-3xl font-bold text-white">{formatPrice(selectedAsset.price)}</p>
                                {selectedAsset.change24h !== null && (
                                    <p className={`flex items-center gap-1 text-sm mt-1 ${selectedAsset.change24h >= 0 ? "text-green-400" : "text-red-400"
                                        }`}>
                                        {selectedAsset.change24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {selectedAsset.change24h >= 0 ? "+" : ""}{selectedAsset.change24h.toFixed(2)}% vs EMA
                                    </p>
                                )}
                            </div>

                            {/* Feed ID */}
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1.5">Feed ID</p>
                                <div className="flex items-center gap-2">
                                    <code className="text-[10px] text-gray-400 break-all flex-1 bg-gray-900/50 px-2 py-1.5 rounded font-mono">
                                        {selectedAsset.feedId}
                                    </code>
                                    <button onClick={() => copyToClipboard(selectedAsset.feedId, selectedAsset.symbol)}
                                        className="p-1.5 hover:bg-gray-700 rounded transition-colors">
                                        {copiedId === selectedAsset.symbol
                                            ? <Check className="w-4 h-4 text-green-400" />
                                            : <Copy className="w-4 h-4 text-gray-500" />}
                                    </button>
                                </div>
                            </div>

                            {/* Health Rules */}
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Health Rules
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`px-3 py-2 rounded-lg ${selectedAsset.ageSeconds !== null && selectedAsset.ageSeconds > STALE_THRESHOLD_SECONDS
                                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                            : "bg-green-500/10 text-green-400 border border-green-500/20"
                                        }`}>
                                        <p className="font-medium">Age</p>
                                        <p className="text-[10px] opacity-70">{formatAge(selectedAsset.ageSeconds).text} / &lt;{STALE_THRESHOLD_SECONDS / 60}m</p>
                                    </div>
                                    <div className={`px-3 py-2 rounded-lg ${selectedAsset.confidencePercent !== null && selectedAsset.confidencePercent > CONFIDENCE_THRESHOLD_PERCENT
                                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                            : "bg-green-500/10 text-green-400 border border-green-500/20"
                                        }`}>
                                        <p className="font-medium">Confidence</p>
                                        <p className="text-[10px] opacity-70">±{selectedAsset.confidencePercent?.toFixed(3) || "—"}% / &lt;{CONFIDENCE_THRESHOLD_PERCENT}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* EMA Comparison */}
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> EMA Comparison
                                </p>
                                <div className="bg-gray-900/50 rounded-lg p-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">EMA Price</span>
                                        <span className="text-white">{formatPrice(selectedAsset.emaPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Spot Price</span>
                                        <span className="text-white">{formatPrice(selectedAsset.price)}</span>
                                    </div>
                                    {selectedAsset.change24h !== null && (
                                        <div className="mt-2 pt-2 border-t border-gray-700/50 flex justify-between text-sm">
                                            <span className="text-gray-400">Deviation</span>
                                            <span className={selectedAsset.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                                                {selectedAsset.change24h >= 0 ? "+" : ""}{selectedAsset.change24h.toFixed(3)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* External Links */}
                            <div className="flex flex-col gap-2">
                                <a href={`https://pyth.network/price-feeds/equity-us-${selectedAsset.symbol.toLowerCase().replace('x', '')}-usd`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-sm text-purple-400 transition-colors">
                                    <span>View on Pyth Network</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <a href={`https://explorer.solana.com/address/${selectedAsset.feedId}?cluster=mainnet`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 rounded-lg text-sm text-gray-400 transition-colors">
                                    <span>Solana Explorer</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>

                            {/* Keyboard hint */}
                            <p className="text-[10px] text-gray-600 mt-4 text-center">
                                Use ↑↓ arrows to navigate feeds
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="lg:col-span-1 hidden lg:block">
                        <div className="bg-gray-800/20 rounded-xl border border-dashed border-gray-700/40 p-8 h-full flex flex-col items-center justify-center text-center">
                            <Activity className="w-10 h-10 text-gray-600 mb-3" />
                            <p className="text-gray-500 text-sm mb-1">Select a feed</p>
                            <p className="text-gray-600 text-xs">Click any oracle card to view details</p>
                        </div>
                    </div>
                )}
            </div>

            {/* About Modal */}
            {showAbout && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAbout(false)}>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">About Pyth Price Feeds</h3>
                            <button onClick={() => setShowAbout(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-gray-400 text-sm space-y-3">
                            <p>Prices are fetched from Pyth Network&apos;s Hermes API, providing real-time price data for xStock tokenized assets.</p>
                            <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                                <p><strong className="text-white">Confidence Interval:</strong> Represents the uncertainty in the price measurement.</p>
                                <p><strong className="text-white">Stale Threshold:</strong> Prices older than {STALE_THRESHOLD_SECONDS / 60} minutes are marked as stale.</p>
                                <p><strong className="text-white">Confidence Threshold:</strong> Confidence intervals wider than {CONFIDENCE_THRESHOLD_PERCENT}% trigger a warning.</p>
                            </div>
                            <p className="text-xs text-gray-500">Data refreshes automatically. Click a card to see detailed feed information.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

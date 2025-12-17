"use client";

import { useState, useEffect, useMemo } from "react";
import {
    RefreshCw, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle,
    Copy, ExternalLink, ChevronDown, ChevronUp, Search, Info, X, Check
} from "lucide-react";

// Pyth Feed IDs for xStocks
const PYTH_FEEDS = {
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
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("alphabetical");
    const [showHealthyOnly, setShowHealthyOnly] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

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

                        // Calculate pseudo 24h change (comparing current to EMA)
                        const change = ((price - emaPrice) / emaPrice) * 100;

                        const isStale = ageSeconds > STALE_THRESHOLD_SECONDS;
                        const isWideConf = confidencePercent !== null && confidencePercent > CONFIDENCE_THRESHOLD_PERCENT;
                        const status: "ok" | "stale" = isStale || isWideConf ? "stale" : "ok";

                        return {
                            symbol,
                            feedId,
                            price,
                            confidence: conf,
                            confidencePercent,
                            change24h: change,
                            lastUpdated: publishTime,
                            ageSeconds,
                            status,
                            emaPrice,
                        };
                    }

                    return {
                        symbol,
                        feedId,
                        price: null,
                        confidence: null,
                        confidencePercent: null,
                        change24h: null,
                        lastUpdated: null,
                        ageSeconds: null,
                        status: "error" as const,
                        emaPrice: null,
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
                    return {
                        ...p,
                        ageSeconds,
                        status: isStale || isWideConf ? "stale" : "ok"
                    };
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
            const secs = seconds % 60;
            return { text: `${mins}m ${secs}s`, label: seconds > STALE_THRESHOLD_SECONDS ? "Stale" : "Fresh" };
        }
        const hours = Math.floor(seconds / 3600);
        return { text: `${hours}h+`, label: "Stale" };
    };

    const formatPrice = (price: number | null) => {
        if (price === null) return "—";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
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

        // Search filter
        if (searchQuery) {
            result = result.filter(p =>
                p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Healthy filter
        if (showHealthyOnly) {
            result = result.filter(p => p.status === "ok");
        }

        // Sort
        switch (sortBy) {
            case "age-worst":
                result.sort((a, b) => (b.ageSeconds || 0) - (a.ageSeconds || 0));
                break;
            case "confidence-worst":
                result.sort((a, b) => (b.confidencePercent || 0) - (a.confidencePercent || 0));
                break;
            case "alphabetical":
            default:
                result.sort((a, b) => a.symbol.localeCompare(b.symbol));
        }

        return result;
    }, [prices, searchQuery, sortBy, showHealthyOnly]);

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
                        <button
                            onClick={() => setShowAbout(true)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <Info className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Health line - quiet, useful */}
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
                {/* Search */}
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
                    {/* Sort dropdown */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none"
                    >
                        <option value="alphabetical">Sort: A-Z</option>
                        <option value="age-worst">Sort: Age (worst)</option>
                        <option value="confidence-worst">Sort: Conf (worst)</option>
                    </select>

                    {/* Filter toggle */}
                    <button
                        onClick={() => setShowHealthyOnly(!showHealthyOnly)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${showHealthyOnly
                                ? "bg-green-500/20 border-green-500/50 text-green-400"
                                : "bg-gray-800/50 border-gray-700/50 text-gray-400"
                            }`}
                    >
                        Healthy only
                    </button>

                    {/* Auto-refresh with interval */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600"
                            />
                            Auto
                        </label>
                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            disabled={!autoRefresh}
                            className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-gray-400 focus:outline-none disabled:opacity-50"
                        >
                            {REFRESH_INTERVALS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Manual refresh button */}
                    <button
                        onClick={fetchPrices}
                        disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Price Cards - Compact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPrices.map((asset) => {
                    const isExpanded = expandedCard === asset.symbol;
                    const ageInfo = formatAge(asset.ageSeconds);
                    const isStale = asset.ageSeconds !== null && asset.ageSeconds > STALE_THRESHOLD_SECONDS;
                    const isWideConf = asset.confidencePercent !== null && asset.confidencePercent > CONFIDENCE_THRESHOLD_PERCENT;

                    return (
                        <div
                            key={asset.symbol}
                            className={`bg-gray-800/40 rounded-xl border transition-all ${isExpanded ? "border-purple-500/50" : "border-gray-700/40 hover:border-gray-600/50"
                                }`}
                        >
                            {/* Main card - clickable */}
                            <button
                                onClick={() => setExpandedCard(isExpanded ? null : asset.symbol)}
                                className="w-full p-4 text-left"
                            >
                                {/* Row 1: Symbol + Price */}
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold text-white">{asset.symbol}</h3>
                                    <div className="text-xl font-bold text-white">
                                        {formatPrice(asset.price)}
                                    </div>
                                </div>

                                {/* Row 2: Age + Confidence */}
                                <div className="flex items-center justify-between text-sm">
                                    {/* Age */}
                                    <div className={`flex items-center gap-1 ${isStale ? "text-yellow-400" : "text-gray-500"}`}>
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{ageInfo.label}</span>
                                        <span className="text-gray-600">•</span>
                                        <span>{ageInfo.text} ago</span>
                                    </div>

                                    {/* Confidence */}
                                    <div className={`text-right ${isWideConf ? "text-yellow-400" : "text-gray-500"}`}>
                                        <span>±{asset.confidence?.toFixed(2) || "—"}</span>
                                        {asset.confidencePercent !== null && (
                                            <span className="text-gray-600 ml-1">({asset.confidencePercent.toFixed(3)}%)</span>
                                        )}
                                    </div>
                                </div>

                                {/* Row 3: vs EMA (subtle) + expand indicator */}
                                <div className="flex items-center justify-between mt-2 text-xs">
                                    {asset.change24h !== null && (
                                        <div className={`flex items-center gap-1 ${asset.change24h >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                                            {asset.change24h >= 0 ? (
                                                <TrendingUp className="w-3 h-3" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3" />
                                            )}
                                            <span>{asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}% vs EMA</span>
                                        </div>
                                    )}
                                    <div className="text-gray-600">
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </div>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-0 border-t border-gray-700/50 space-y-3">
                                    {/* Feed ID with copy */}
                                    <div className="mt-3">
                                        <p className="text-xs text-gray-500 mb-1">Feed ID</p>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs text-gray-400 break-all flex-1 bg-gray-900/50 px-2 py-1 rounded">
                                                {asset.feedId}
                                            </code>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard(asset.feedId, asset.symbol);
                                                }}
                                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                                            >
                                                {copiedId === asset.symbol ? (
                                                    <Check className="w-4 h-4 text-green-400" />
                                                ) : (
                                                    <Copy className="w-4 h-4 text-gray-500" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Health rules */}
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Health Rules</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className={`px-2 py-1 rounded ${isStale ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`}>
                                                Age: {isStale ? "STALE" : "OK"} (&lt;{STALE_THRESHOLD_SECONDS / 60}m)
                                            </div>
                                            <div className={`px-2 py-1 rounded ${isWideConf ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`}>
                                                Conf: {isWideConf ? "WIDE" : "OK"} (&lt;{CONFIDENCE_THRESHOLD_PERCENT}%)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Links */}
                                    <div className="flex items-center gap-3">
                                        <a
                                            href={`https://pyth.network/price-feeds/equity-us-${asset.symbol.toLowerCase().replace('x', '')}-usd`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            View on Pyth
                                        </a>
                                        <a
                                            href={`https://explorer.solana.com/address/${asset.feedId}?cluster=mainnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Explorer
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* About Modal */}
            {showAbout && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAbout(false)}>
                    <div
                        className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">About Pyth Price Feeds</h3>
                            <button onClick={() => setShowAbout(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-gray-400 text-sm space-y-3">
                            <p>
                                Prices are fetched from Pyth Network&apos;s Hermes API, providing real-time price data
                                for xStock tokenized assets.
                            </p>
                            <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                                <p>
                                    <strong className="text-white">Confidence Interval:</strong> Represents the uncertainty
                                    in the price measurement. Lower values indicate more reliable prices.
                                </p>
                                <p>
                                    <strong className="text-white">Stale Threshold:</strong> Prices older than {STALE_THRESHOLD_SECONDS / 60} minutes
                                    are marked as &quot;stale&quot; and should be used with caution.
                                </p>
                                <p>
                                    <strong className="text-white">Confidence Threshold:</strong> Confidence intervals wider than {CONFIDENCE_THRESHOLD_PERCENT}%
                                    of price trigger a warning.
                                </p>
                            </div>
                            <p className="text-xs text-gray-500">
                                Data refreshes automatically. Click a card to see detailed feed information.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

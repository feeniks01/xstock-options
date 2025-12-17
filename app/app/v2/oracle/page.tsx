"use client";

import { useState, useEffect } from "react";
import { Activity, RefreshCw, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle } from "lucide-react";

// Pyth Feed IDs for xStocks
const PYTH_FEEDS = {
    NVDAx: "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    TSLAx: "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    SPYx: "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    AAPLx: "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    METAx: "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
};

interface PriceData {
    id: string;
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
    emaPrice: number;
}

interface AssetPrice {
    symbol: string;
    feedId: string;
    price: number | null;
    confidence: number | null;
    change24h: number | null;
    lastUpdated: number | null;
    status: "loading" | "ok" | "stale" | "error";
}

const HERMES_URL = "https://hermes.pyth.network";

export default function OraclePage() {
    const [prices, setPrices] = useState<AssetPrice[]>(
        Object.entries(PYTH_FEEDS).map(([symbol, feedId]) => ({
            symbol,
            feedId,
            price: null,
            confidence: null,
            change24h: null,
            lastUpdated: null,
            status: "loading",
        }))
    );
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

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
                        const age = now - publishTime;

                        // Calculate pseudo 24h change (comparing current to EMA)
                        const change = ((price - emaPrice) / emaPrice) * 100;

                        const status: "ok" | "stale" = age > 300 ? "stale" : "ok";

                        return {
                            symbol,
                            feedId,
                            price,
                            confidence: conf,
                            change24h: change,
                            lastUpdated: publishTime,
                            status,
                        };
                    }

                    return {
                        symbol,
                        feedId,
                        price: null,
                        confidence: null,
                        change24h: null,
                        lastUpdated: null,
                        status: "error" as const,
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
            const interval = setInterval(fetchPrices, 10000); // 10 second refresh
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    const formatPrice = (price: number | null) => {
        if (price === null) return "—";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    };

    const formatConfidence = (conf: number | null) => {
        if (conf === null) return "—";
        return `±${conf.toFixed(4)}`;
    };

    const formatTime = (timestamp: number | null) => {
        if (timestamp === null) return "—";
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ok": return "text-green-400";
            case "stale": return "text-yellow-400";
            case "error": return "text-red-400";
            default: return "text-gray-400";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "ok": return <CheckCircle className="w-4 h-4" />;
            case "stale": return <AlertTriangle className="w-4 h-4" />;
            case "error": return <AlertTriangle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4 animate-pulse" />;
        }
    };

    const healthyCount = prices.filter(p => p.status === "ok").length;
    const totalCount = prices.length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Activity className="w-8 h-8 text-purple-500" />
                            Oracle Price Feeds
                        </h1>
                        {/* Status Chip */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-gray-700/50 text-sm text-gray-400">
                            <span className={`w-1.5 h-1.5 rounded-full ${healthyCount === totalCount ? "bg-green-500" : "bg-yellow-500"}`} />
                            <span>Feeds: {healthyCount}/{totalCount}</span>
                            <span className="text-gray-600 text-xs">· Pyth</span>
                        </div>
                    </div>
                    <p className="text-gray-400 mt-1">
                        Real-time prices for xStock assets
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Auto-refresh toggle */}
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                        />
                        Auto-refresh
                    </label>

                    {/* Manual refresh button */}
                    <button
                        onClick={fetchPrices}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Price Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {prices.map((asset) => (
                    <div
                        key={asset.symbol}
                        className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">{asset.symbol}</h3>
                            <div className={`flex items-center gap-1 ${getStatusColor(asset.status)}`}>
                                {getStatusIcon(asset.status)}
                                <span className="text-xs uppercase">{asset.status}</span>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="mb-4">
                            <div className="text-3xl font-bold text-white">
                                {formatPrice(asset.price)}
                            </div>
                            <div className="text-sm text-gray-500">
                                Confidence: {formatConfidence(asset.confidence)}
                            </div>
                        </div>

                        {/* Change */}
                        {asset.change24h !== null && (
                            <div className={`flex items-center gap-1 mb-4 ${asset.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {asset.change24h >= 0 ? (
                                    <TrendingUp className="w-4 h-4" />
                                ) : (
                                    <TrendingDown className="w-4 h-4" />
                                )}
                                <span className="font-medium">
                                    {asset.change24h >= 0 ? "+" : ""}{asset.change24h.toFixed(2)}%
                                </span>
                                <span className="text-gray-500 text-sm">vs EMA</span>
                            </div>
                        )}

                        {/* Last Updated */}
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>Updated: {formatTime(asset.lastUpdated)}</span>
                        </div>

                        {/* Feed ID (truncated) */}
                        <div className="mt-3 pt-3 border-t border-gray-700/50">
                            <code className="text-xs text-gray-600 break-all">
                                {asset.feedId.slice(0, 20)}...
                            </code>
                        </div>
                    </div>
                ))}
            </div>

            {/* Info Section */}
            <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-3">About Pyth Price Feeds</h3>
                <div className="text-gray-400 text-sm space-y-2">
                    <p>
                        Prices are fetched from Pyth Network&apos;s Hermes API, providing real-time price data
                        for xStock tokenized assets.
                    </p>
                    <p>
                        <strong className="text-white">Confidence Interval:</strong> Represents the uncertainty
                        in the price measurement. Lower values indicate more reliable prices.
                    </p>
                    <p>
                        <strong className="text-white">Status:</strong> Prices older than 5 minutes are marked
                        as &quot;stale&quot; and should be used with caution.
                    </p>
                </div>
            </div>
        </div>
    );
}

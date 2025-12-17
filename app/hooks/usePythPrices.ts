"use client";

import { useState, useEffect, useCallback } from "react";

// Pyth Feed IDs for xStocks
const PYTH_FEEDS: Record<string, string> = {
    NVDAx: "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    TSLAx: "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    SPYx: "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    AAPLx: "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    METAx: "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
};

const HERMES_URL = "https://hermes.pyth.network";

export interface PythPriceData {
    symbol: string;
    price: number;
    confidence: number;
    lastUpdated: Date;
    emaPrice: number;
}

interface UsePythPricesReturn {
    prices: Record<string, PythPriceData>;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    getPrice: (symbol: string) => number;
}

/**
 * Hook to fetch live Pyth oracle prices for all xStock assets
 */
export function usePythPrices(): UsePythPricesReturn {
    const [prices, setPrices] = useState<Record<string, PythPriceData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            const feedIds = Object.values(PYTH_FEEDS);
            const idsParam = feedIds.map(id => `ids[]=${id}`).join("&");

            const response = await fetch(
                `${HERMES_URL}/v2/updates/price/latest?${idsParam}&parsed=true`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.parsed) {
                const newPrices: Record<string, PythPriceData> = {};

                Object.entries(PYTH_FEEDS).forEach(([symbol, feedId]) => {
                    const feedData = data.parsed.find(
                        (p: any) => `0x${p.id}` === feedId
                    );

                    if (feedData) {
                        const price = parseFloat(feedData.price.price) * Math.pow(10, feedData.price.expo);
                        const conf = parseFloat(feedData.price.conf) * Math.pow(10, feedData.price.expo);
                        const emaPrice = parseFloat(feedData.ema_price.price) * Math.pow(10, feedData.ema_price.expo);
                        const publishTime = feedData.price.publish_time;

                        newPrices[symbol.toLowerCase()] = {
                            symbol,
                            price,
                            confidence: conf,
                            lastUpdated: new Date(publishTime * 1000),
                            emaPrice,
                        };
                    }
                });

                setPrices(newPrices);
                setError(null);
            }
        } catch (err: any) {
            console.error("Failed to fetch Pyth prices:", err);
            setError(err.message || "Failed to fetch prices");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchPrices();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchPrices, 30000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    // Helper to get price by symbol (case insensitive)
    const getPrice = useCallback((symbol: string): number => {
        const normalized = symbol.toLowerCase().replace(/x$/, "x");
        return prices[normalized]?.price || 0;
    }, [prices]);

    return {
        prices,
        loading,
        error,
        refresh: fetchPrices,
        getPrice,
    };
}

/**
 * Hook to get a single asset's price
 */
export function usePythPrice(symbol: string): { price: number; loading: boolean } {
    const { prices, loading, getPrice } = usePythPrices();
    return {
        price: getPrice(symbol),
        loading,
    };
}

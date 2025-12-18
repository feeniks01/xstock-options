"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    ArrowLeft, TrendingUp, TrendingDown, Loader2, ExternalLink,
    Clock, Activity, ChevronRight, Zap
} from "lucide-react";
import { init, dispose, Chart, LineType, PolygonType } from 'klinecharts';
import { usePythPrices } from "../../../../hooks/usePythPrices";
import { XSTOCKS } from "../../../../utils/constants";

type ChartInterval = "1H" | "4H" | "1D" | "1W" | "1M";

// Range bar component
function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
    const range = high - low || 1;
    const position = Math.min(100, Math.max(0, ((current - low) / range) * 100));

    return (
        <div className="space-y-1.5">
            <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30" />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white shadow transition-all duration-300"
                    style={{ left: `calc(${position}% - 5px)` }}
                />
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">${low.toFixed(0)}</span>
                <span className="text-foreground font-medium">${current.toFixed(2)}</span>
                <span className="text-muted-foreground">${high.toFixed(0)}</span>
            </div>
        </div>
    );
}

// Market depth bar component
function MarketDepthBar({ bidPercent = 55 }: { bidPercent?: number }) {
    const askPercent = 100 - bidPercent;
    return (
        <div className="space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden">
                <div className="bg-green-500 transition-all duration-500" style={{ width: `${bidPercent}%` }} />
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${askPercent}%` }} />
            </div>
            <div className="flex justify-between text-xs">
                <span className="text-green-400">Bids {bidPercent}%</span>
                <span className="text-red-400">Asks {askPercent}%</span>
            </div>
        </div>
    );
}

// Chart component
function TradingChart({ symbol, price }: { symbol: string; price: number }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartContainerRef.current && !chartInstance.current) {
            chartInstance.current = init(chartContainerRef.current);
            chartInstance.current?.setStyles({
                grid: {
                    horizontal: { color: '#2a2e39' },
                    vertical: { color: '#2a2e39' }
                },
                candle: {
                    bar: {
                        upColor: '#22c55e',
                        downColor: '#ef4444',
                        noChangeColor: '#888888',
                        upBorderColor: '#22c55e',
                        downBorderColor: '#ef4444',
                        noChangeBorderColor: '#888888',
                        upWickColor: '#22c55e',
                        downWickColor: '#ef4444',
                        noChangeWickColor: '#888888'
                    }
                },
                xAxis: { tickText: { color: '#6b7280' } },
                yAxis: { tickText: { color: '#6b7280' } },
                crosshair: {
                    show: true,
                    horizontal: {
                        show: true,
                        line: { show: true, style: LineType.Dashed, dashedValue: [4, 2], size: 1, color: '#6b7280' },
                        text: {
                            show: true,
                            style: PolygonType.Fill,
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: LineType.Solid,
                            borderSize: 1,
                            borderColor: '#374151',
                            borderRadius: 4,
                            paddingLeft: 4,
                            paddingRight: 4,
                            paddingTop: 2,
                            paddingBottom: 2,
                            backgroundColor: '#1f2937'
                        }
                    },
                    vertical: {
                        show: true,
                        line: { show: true, style: LineType.Dashed, dashedValue: [4, 2], size: 1, color: '#6b7280' },
                        text: {
                            show: true,
                            style: PolygonType.Fill,
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: LineType.Solid,
                            borderSize: 1,
                            borderColor: '#374151',
                            borderRadius: 4,
                            paddingLeft: 4,
                            paddingRight: 4,
                            paddingTop: 2,
                            paddingBottom: 2,
                            backgroundColor: '#1f2937'
                        }
                    }
                }
            });

            // Generate mock historical data based on price
            if (price > 0) {
                const candles = generateMockCandles(price, 100);
                // @ts-ignore
                chartInstance.current.applyNewData(candles);
            }
        }

        return () => {
            if (chartContainerRef.current && chartInstance.current) {
                dispose(chartContainerRef.current);
                chartInstance.current = null;
            }
        };
    }, []);

    // Update chart when price changes
    useEffect(() => {
        if (chartInstance.current && price > 0) {
            const candles = generateMockCandles(price, 100);
            // @ts-ignore
            chartInstance.current.applyNewData(candles);
        }
    }, [price]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}

// Generate mock candle data for chart display
function generateMockCandles(currentPrice: number, count: number) {
    const candles = [];
    const now = Date.now();
    const interval = 5 * 60 * 1000; // 5 minute candles

    let price = currentPrice * (0.9 + Math.random() * 0.1); // Start 90-100% of current

    for (let i = count - 1; i >= 0; i--) {
        const volatility = 0.02; // 2% volatility
        const change = (Math.random() - 0.5) * volatility * price;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        candles.push({
            timestamp: now - i * interval,
            open,
            high,
            low,
            close,
            volume: Math.floor(Math.random() * 100000) + 10000
        });

        price = close;
    }

    // Adjust last candle to match current price
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        last.close = currentPrice;
        last.high = Math.max(last.high, currentPrice);
        last.low = Math.min(last.low, currentPrice);
    }

    return candles;
}

export default function StockDetailPage() {
    const router = useRouter();
    const params = useParams();
    const ticker = (params.ticker as string)?.toUpperCase();
    const { connected } = useWallet();
    const { getPrice, loading: pricesLoading } = usePythPrices();

    const [chartInterval, setChartInterval] = useState<ChartInterval>("1D");

    // Find the stock
    const stock = useMemo(() => {
        return XSTOCKS.find(s => s.symbol.toLowerCase() === ticker?.toLowerCase());
    }, [ticker]);

    // Get live price
    const price = getPrice(ticker) || 0;

    // Mock data - in production would come from API/oracle
    const mockData = useMemo(() => {
        const basePrice = price || 100;
        return {
            priceChange: basePrice * (Math.random() * 0.06 - 0.03),
            priceChangePct: Math.random() * 6 - 3,
            volume: Math.floor(Math.random() * 10000000) + 1000000,
            low52w: basePrice * 0.6,
            high52w: basePrice * 1.4,
            marketCap: basePrice * 1000000000,
            bid: basePrice * 0.999,
            ask: basePrice * 1.001,
            spread: basePrice * 0.002,
        };
    }, [price]);

    if (!stock) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-xl font-bold text-foreground mb-2">Stock Not Found</h2>
                <p className="text-muted-foreground mb-6">The stock "{ticker}" was not found.</p>
                <button
                    onClick={() => router.push("/v2/trading")}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                    Back to Trading
                </button>
            </div>
        );
    }

    const isPositive = mockData.priceChange >= 0;

    return (
        <div className="w-full space-y-4">
            {/* Back Button */}
            <button
                onClick={() => router.push("/v2/trading")}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Trading
            </button>

            {/* Header Section */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    {stock.logo ? (
                        <img src={stock.logo} alt={stock.symbol} className="w-14 h-14 rounded-xl" />
                    ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                            {stock.symbol.slice(0, 2)}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{stock.symbol}</h1>
                        <p className="text-muted-foreground">{stock.name}</p>
                    </div>
                </div>

                <div className="text-right">
                    {pricesLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    ) : (
                        <>
                            <p className="text-3xl font-bold text-foreground">
                                ${price > 0 ? price.toFixed(2) : "—"}
                            </p>
                            <div className={`flex items-center justify-end gap-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                <span className="font-medium">
                                    {isPositive ? "+" : ""}{mockData.priceChange.toFixed(2)} ({isPositive ? "+" : ""}{mockData.priceChangePct.toFixed(2)}%)
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Chart + Stats (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Chart */}
                    <div className="bg-secondary/30 border border-border rounded-xl overflow-hidden">
                        <div className="h-[400px] bg-[#131722]">
                            <TradingChart symbol={stock.symbol} price={price} />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                            <div className="flex gap-1">
                                {(["1H", "4H", "1D", "1W", "1M"] as ChartInterval[]).map((interval) => (
                                    <button
                                        key={interval}
                                        onClick={() => setChartInterval(interval)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartInterval === interval
                                                ? "bg-blue-500 text-white"
                                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                            }`}
                                    >
                                        {interval}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Live
                                </span>
                                <span>Pyth Oracle</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-secondary/30 border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Volume (24h)</p>
                            <p className="text-lg font-semibold text-foreground">
                                ${(mockData.volume / 1000000).toFixed(2)}M
                            </p>
                        </div>
                        <div className="bg-secondary/30 border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                            <p className="text-lg font-semibold text-foreground">
                                ${(mockData.marketCap / 1000000000).toFixed(2)}B
                            </p>
                        </div>
                        <div className="bg-secondary/30 border border-border rounded-xl p-4 col-span-2">
                            <p className="text-xs text-muted-foreground mb-2">52 Week Range</p>
                            <RangeBar low={mockData.low52w} high={mockData.high52w} current={price} />
                        </div>
                    </div>
                </div>

                {/* Trading Sidebar */}
                <div className="space-y-4">
                    {/* Order Book Preview */}
                    <div className="bg-secondary/30 border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">Order Book</h3>
                            <span className="text-xs text-muted-foreground">Spread: ${mockData.spread.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Bid</p>
                                <p className="text-xl font-bold text-green-400">${mockData.bid.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Ask</p>
                                <p className="text-xl font-bold text-red-400">${mockData.ask.toFixed(2)}</p>
                            </div>
                        </div>
                        <MarketDepthBar bidPercent={isPositive ? 58 : 42} />
                    </div>

                    {/* Trading Actions */}
                    <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3">
                        <h3 className="font-semibold text-foreground mb-3">Trade</h3>

                        <button
                            disabled
                            className="w-full py-3 bg-green-500/80 text-white font-semibold rounded-lg opacity-70 cursor-not-allowed"
                        >
                            Buy {stock.symbol}
                        </button>
                        <button
                            disabled
                            className="w-full py-3 bg-secondary text-foreground font-semibold rounded-lg opacity-70 cursor-not-allowed"
                        >
                            Sell {stock.symbol}
                        </button>

                        <div className="pt-2 border-t border-border">
                            <Link
                                href="/stock/chain"
                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <Zap className="w-4 h-4" />
                                Trade Options
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            Spot trading coming soon. Trade options now!
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-secondary/30 border border-border rounded-xl p-4">
                        <h3 className="font-semibold text-foreground mb-3">Quick Links</h3>
                        <div className="space-y-2">
                            <Link
                                href="/v2/oracle"
                                className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    Oracle Prices
                                </span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <Link
                                href="/v2"
                                className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Earn Vaults
                                </span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

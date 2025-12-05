export interface StockData {
    // Core identifiers
    symbol: string;
    name: string;
    
    // Price data
    currentPrice: number;
    priceChangePct: number;
    priceChange: number;
    
    // OHLC (session data)
    open: number;
    high: number;
    low: number;
    close: number;
    
    // Volume
    volume: number;
    
    // Timestamp
    timestamp: string;
    
    // Market metrics
    marketCap: number | null;
    circulatingSupply: number | null;
    
    // 52-week range
    "52wHigh": number;
    "52wLow": number;
    
    // Sparkline for mini chart
    sparkline: number[];
    
    // Options availability
    hasOptions: boolean;
    
    // Orderbook
    bid: number;
    ask: number;
    spread: number;
    
    // Current candle OHLC
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    ticks: number[];
    
    // Performance metrics
    performance: {
        "1d": number;
        "1w": number;
        "1m": number;
        "ytd": number;
    };
    
    // Sentiment
    sentiment: "Bearish" | "Neutral" | "Bullish";
    volatility: "Low" | "Medium" | "High";
    
    // Legacy
    price: number;

    // Source info (from Bitquery)
    source?: string;
    dex?: string;
    lastTxSignature?: string;
    stale?: boolean;
    error?: string;

    // Historical OHLC candles for chart
    historicalCandles?: {
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[];
}

export interface PricePoint {
    timestamp: number;
    price: number;
    ohlc?: { open: number; high: number; low: number; close: number };
}

export type ChartInterval = "1H" | "4H" | "1D" | "1W" | "1M" | "MAX";

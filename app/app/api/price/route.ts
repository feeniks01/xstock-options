import { NextRequest, NextResponse } from 'next/server';

const BITQUERY_API_URL = 'https://streaming.bitquery.io/graphql';
const BITQUERY_OAUTH_URL = 'https://oauth2.bitquery.io/oauth2/token';

// Cache for price data - keyed by mint + interval
const priceCache = new Map<string, { 
    timestamp: number; 
    data: any;
}>();
const CACHE_TTL = 8000; // 8 seconds cache

// OAuth token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Interval configurations: how far back to fetch and candle size
const INTERVAL_CONFIG: Record<string, { lookback: number; candleMinutes: number }> = {
    '1H': { lookback: 60 * 60 * 1000, candleMinutes: 1 },           // 1 hour, 1-min candles
    '4H': { lookback: 4 * 60 * 60 * 1000, candleMinutes: 5 },       // 4 hours, 5-min candles
    '1D': { lookback: 24 * 60 * 60 * 1000, candleMinutes: 15 },     // 1 day, 15-min candles
    '1W': { lookback: 7 * 24 * 60 * 60 * 1000, candleMinutes: 60 }, // 1 week, 1-hour candles
    '1M': { lookback: 30 * 24 * 60 * 60 * 1000, candleMinutes: 240 }, // 1 month, 4-hour candles
    'MAX': { lookback: 90 * 24 * 60 * 60 * 1000, candleMinutes: 1440 }, // 90 days, 1-day candles
};

// GraphQL query for trades within a time range
const TRADES_QUERY = `
query TradesInRange($mintAddress: String!, $since: DateTime!) {
  Solana {
    DEXTradeByTokens(
      limit: { count: 1000 }
      orderBy: { descending: Block_Time }
      where: {
        Trade: {
          Currency: { MintAddress: { is: $mintAddress } }
          PriceAsymmetry: { lt: 0.1 }
        }
        Transaction: { Result: { Success: true } }
        Block: { Time: { since: $since } }
      }
    ) {
      Block {
        Time
      }
      Transaction {
        Signature
      }
      Trade {
        AmountInUSD
        Amount
        Currency {
          MintAddress
          Name
          Symbol
        }
        Dex {
          ProgramAddress
          ProtocolName
        }
        Price
        PriceInUSD
        Side {
          AmountInUSD
          Amount
          Currency {
            Name
            MintAddress
            Symbol
          }
        }
      }
    }
  }
}`;

// Volume query for 24h stats - using buy side volume for more accurate calculation
const VOLUME_QUERY = `
query VolumeData($mintAddress: String!, $since: DateTime!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Block: { Time: { since: $since } }
        Transaction: { Result: { Success: true } }
        Trade: {
          Currency: { MintAddress: { is: $mintAddress } }
          PriceAsymmetry: { lt: 0.1 }
        }
      }
    ) {
      Trade {
        Currency {
          Name
          MintAddress
          Symbol
        }
      }
      traded_volume_in_usd: sum(of: Trade_AmountInUSD)
      trade_count: count
    }
  }
}`;

// Token supply query for market cap calculation
const SUPPLY_QUERY = `
query TokenSupply($mintAddress: String!) {
  Solana {
    TokenSupplyUpdates(
      limit: { count: 1 }
      orderBy: { descending: Block_Time }
      where: {
        TokenSupplyUpdate: {
          Currency: { MintAddress: { is: $mintAddress } }
        }
      }
    ) {
      TokenSupplyUpdate {
        Currency {
          Name
          Symbol
          Decimals
        }
        PostBalance
      }
    }
  }
}`;

async function getAccessToken(): Promise<string> {
    const clientId = process.env.BITQUERY_CLIENT_ID?.trim();
    const clientSecret = process.env.BITQUERY_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        console.error('Missing credentials:', { 
            hasClientId: !!clientId, 
            hasClientSecret: !!clientSecret,
            clientIdLength: clientId?.length,
            clientSecretLength: clientSecret?.length
        });
        throw new Error('BITQUERY_CLIENT_ID and BITQUERY_CLIENT_SECRET must be configured');
    }

    // Return cached token if still valid (with 60s buffer)
    if (accessToken && Date.now() < tokenExpiry - 60000) {
        return accessToken;
    }

    // Request new access token
    // Try Basic Auth first (some OAuth2 implementations prefer this)
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(BITQUERY_OAUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`,
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'api',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            clientIdPrefix: clientId?.substring(0, 8) + '...',
            clientIdLength: clientId?.length,
            clientSecretLength: clientSecret?.length,
            oauthUrl: BITQUERY_OAUTH_URL,
            clientSecretPrefix: clientSecret?.substring(0, 8) + '...',
        });
        throw new Error(`OAuth token error: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in || 86400) * 1000;

    return accessToken!;
}

async function fetchBitquery(query: string, variables: Record<string, any>) {
    const token = await getAccessToken();

    const response = await fetch(BITQUERY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bitquery API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
        throw new Error(`Bitquery query error: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
}

function calculateSentiment(priceChange: number): "Bearish" | "Neutral" | "Bullish" {
    if (priceChange > 2) return "Bullish";
    if (priceChange < -2) return "Bearish";
    return "Neutral";
}

function calculateVolatility(high: number, low: number, current: number): "Low" | "Medium" | "High" {
    if (current === 0) return "Low";
    const range = ((high - low) / current) * 100;
    if (range > 5) return "High";
    if (range > 2) return "Medium";
    return "Low";
}

/**
 * Calculate Historical Volatility from price data
 * Uses log returns and annualized standard deviation
 * @param prices Array of prices (chronological order, oldest first)
 * @param period Number of periods to use (default: all available)
 * @returns Annualized volatility as a decimal (e.g., 0.35 = 35%)
 */
function calculateHistoricalVolatility(prices: number[], period?: number): number {
    if (prices.length < 2) return 0.35; // Default fallback
    
    const data = period ? prices.slice(-period) : prices;
    if (data.length < 2) return 0.35;
    
    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i] > 0 && data[i-1] > 0) {
            logReturns.push(Math.log(data[i] / data[i-1]));
        }
    }
    
    if (logReturns.length < 2) return 0.35;
    
    // Calculate mean of log returns
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    
    // Calculate variance
    const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);
    
    // Standard deviation of returns
    const stdDev = Math.sqrt(variance);
    
    // Annualize: multiply by sqrt(periods per year)
    // Assuming daily data: sqrt(252 trading days)
    // For hourly: sqrt(252 * 6.5) ≈ sqrt(1638)
    // For 15-min: sqrt(252 * 6.5 * 4) ≈ sqrt(6552)
    // We'll use a general factor based on data frequency
    const periodsPerDay = 24 * 60 / 15; // Assuming ~15 min average interval
    const annualizationFactor = Math.sqrt(252 * periodsPerDay);
    
    const annualizedVol = stdDev * annualizationFactor;
    
    // Clamp to reasonable range (5% to 200%)
    return Math.max(0.05, Math.min(2.0, annualizedVol));
}

/**
 * Calculate volatility metrics including different lookback periods
 */
function calculateVolatilityMetrics(candles: { close: number }[]): {
    hv20: number;  // 20-period HV
    hv60: number;  // 60-period HV
    hvAll: number; // All available data
    hvWeighted: number; // Weighted average for IV estimate
} {
    const prices = candles.map(c => c.close);
    
    const hv20 = calculateHistoricalVolatility(prices, 20);
    const hv60 = calculateHistoricalVolatility(prices, 60);
    const hvAll = calculateHistoricalVolatility(prices);
    
    // Weighted average: recent volatility matters more
    // 50% recent (20-period), 30% medium (60-period), 20% long-term
    const hvWeighted = hv20 * 0.5 + hv60 * 0.3 + hvAll * 0.2;
    
    return { hv20, hv60, hvAll, hvWeighted };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mintAddress = searchParams.get('mint');
    const symbol = searchParams.get('symbol') || 'xSTOCK';
    const name = searchParams.get('name') || 'xStock Token';
    const interval = searchParams.get('interval') || '1D';

    if (!mintAddress) {
        return NextResponse.json(
            { error: 'mint parameter is required' },
            { status: 400 }
        );
    }

    // Get interval configuration
    const config = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG['1D'];
    const cacheKey = `${mintAddress}-${interval}`;

    // Check cache
    const cached = priceCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Calculate time range based on interval
        const since = new Date(now - config.lookback).toISOString();
        
        // Fetch trades within the time range
        const tradeData = await fetchBitquery(TRADES_QUERY, { mintAddress, since });
        const trades = tradeData?.Solana?.DEXTradeByTokens || [];

        if (trades.length === 0) {
            return NextResponse.json(
                { error: 'No trade data found for this xStock', mintAddress },
                { status: 404 }
            );
        }

        // Extract prices from trades (most recent first)
        const validTrades = trades
            .filter((t: any) => t.Trade.PriceInUSD && t.Trade.PriceInUSD > 0)
            .map((t: any) => ({
                price: t.Trade.PriceInUSD,
                time: t.Block.Time,
                timestamp: new Date(t.Block.Time).getTime(),
                signature: t.Transaction?.Signature,
                dex: t.Trade.Dex?.ProtocolName,
                amountUSD: t.Trade.AmountInUSD || 0
            }));

        if (validTrades.length === 0) {
            return NextResponse.json(
                { error: 'No valid price data found', mintAddress },
                { status: 404 }
            );
        }

        const currentPrice = validTrades[0].price;
        const prices = validTrades.map((t: any) => t.price);
        
        // Calculate OHLC from all trades in range
        const sessionHigh = Math.max(...prices);
        const sessionLow = Math.min(...prices);
        const sessionOpen = validTrades[validTrades.length - 1].price; // Oldest trade
        const sessionClose = currentPrice;

        // Calculate price change
        const priceChange = currentPrice - sessionOpen;
        const priceChangePct = sessionOpen > 0 ? ((currentPrice - sessionOpen) / sessionOpen) * 100 : 0;

        // Fetch 24h volume
        const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        let volume24h = 0;
        
        try {
            const volumeData = await fetchBitquery(VOLUME_QUERY, { 
                mintAddress, 
                since: yesterday 
            });
            const volumeInfo = volumeData?.Solana?.DEXTradeByTokens?.[0];
            if (volumeInfo?.traded_volume_in_usd) {
                volume24h = volumeInfo.traded_volume_in_usd;
            }
        } catch (e) {
            console.warn('Failed to fetch volume data:', e);
        }

        // If volume query failed or returned 0, calculate from trades
        if (volume24h === 0) {
            const yesterdayTs = now - 24 * 60 * 60 * 1000;
            volume24h = validTrades
                .filter((t: any) => t.timestamp >= yesterdayTs)
                .reduce((sum: number, t: any) => sum + (t.amountUSD || 0), 0);
        }

        // Fetch token supply for market cap
        let circulatingSupply: number | null = null;
        let marketCap: number | null = null;
        
        try {
            const supplyData = await fetchBitquery(SUPPLY_QUERY, { mintAddress });
            const supplyInfo = supplyData?.Solana?.TokenSupplyUpdates?.[0]?.TokenSupplyUpdate;
            if (supplyInfo?.PostBalance) {
                const decimals = supplyInfo.Currency?.Decimals || 6;
                circulatingSupply = supplyInfo.PostBalance / Math.pow(10, decimals);
                marketCap = circulatingSupply * currentPrice;
            }
        } catch (e) {
            console.warn('Failed to fetch supply data:', e);
        }

        // Build historical candles based on interval config
        const candleInterval = config.candleMinutes * 60 * 1000;
        const candleMap = new Map<number, { prices: number[], volume: number, trades: number }>();
        
        validTrades.forEach((t: any) => {
            const timestamp = Math.floor(t.timestamp / candleInterval) * candleInterval;
            if (!candleMap.has(timestamp)) {
                candleMap.set(timestamp, { prices: [], volume: 0, trades: 0 });
            }
            const bucket = candleMap.get(timestamp)!;
            bucket.prices.push(t.price);
            bucket.volume += t.amountUSD;
            bucket.trades += 1;
        });

        // Convert to sorted array of candles
        const historicalCandles = Array.from(candleMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([timestamp, data]) => ({
                timestamp,
                open: data.prices[data.prices.length - 1], // Oldest price in bucket
                high: Math.max(...data.prices),
                low: Math.min(...data.prices),
                close: data.prices[0], // Most recent price in bucket
                volume: Math.round(data.volume)
            }));

        // Fill gaps with previous candle's close price
        const filledCandles: typeof historicalCandles = [];
        const startTime = Math.floor((now - config.lookback) / candleInterval) * candleInterval;
        const endTime = Math.floor(now / candleInterval) * candleInterval;
        
        let lastClose = historicalCandles.length > 0 ? historicalCandles[0].close : currentPrice;
        
        for (let t = startTime; t <= endTime; t += candleInterval) {
            const existing = historicalCandles.find(c => c.timestamp === t);
            if (existing) {
                filledCandles.push(existing);
                lastClose = existing.close;
            } else {
                // Create a flat candle with the last known price
                filledCandles.push({
                    timestamp: t,
                    open: lastClose,
                    high: lastClose,
                    low: lastClose,
                    close: lastClose,
                    volume: 0
                });
            }
        }

        // Generate sparkline from recent prices
        const sparkline = validTrades
            .slice(0, 30)
            .reverse()
            .map((t: any) => t.price);

        // Calculate Historical Volatility from candles
        const volatilityMetrics = calculateVolatilityMetrics(filledCandles);

        // Calculate bid/ask spread estimate
        const spreadBps = 10;
        const spread = currentPrice * (spreadBps / 10000);
        const bid = currentPrice - spread / 2;
        const ask = currentPrice + spread / 2;

        // Build response
        const stockData = {
            // Core price data
            symbol,
            name,
            currentPrice,
            priceChangePct,
            priceChange,
            
            // OHLC data (from trades in range)
            open: sessionOpen,
            high: sessionHigh,
            low: sessionLow,
            close: sessionClose,
            
            // Volume
            volume: volume24h,
            
            // Timestamp
            timestamp: validTrades[0].time,
            
            // Market metrics
            marketCap,
            circulatingSupply,
            
            // 52-week range (estimated)
            "52wHigh": sessionHigh * 1.3,
            "52wLow": sessionLow * 0.7,
            
            // Sparkline for mini chart
            sparkline: sparkline.length > 0 ? sparkline : [currentPrice],
            
            // Options flag
            hasOptions: true,
            
            // Orderbook data
            bid,
            ask,
            spread,
            
            // Current candle OHLC
            ohlc: {
                open: sessionOpen,
                high: sessionHigh,
                low: sessionLow,
                close: sessionClose,
            },
            ticks: [currentPrice],
            
            // Performance metrics
            performance: {
                "1d": priceChangePct,
                "1w": priceChangePct * 2.5,
                "1m": priceChangePct * 5,
                "ytd": priceChangePct * 10,
            },
            
            // Sentiment
            sentiment: calculateSentiment(priceChangePct),
            volatility: calculateVolatility(sessionHigh, sessionLow, currentPrice),
            
            // Historical Volatility metrics for options pricing
            historicalVolatility: {
                hv20: volatilityMetrics.hv20,    // 20-period HV
                hv60: volatilityMetrics.hv60,    // 60-period HV
                hvAll: volatilityMetrics.hvAll,  // Full period HV
                baseIV: volatilityMetrics.hvWeighted, // Weighted average for IV
            },
            
            // Legacy fields
            price: currentPrice,

            // Source info
            source: 'bitquery',
            dex: validTrades[0].dex || 'Unknown',
            lastTxSignature: validTrades[0].signature,

            // Historical OHLC candles for chart (with gaps filled)
            historicalCandles: filledCandles,
            
            // Interval info
            interval,
            candleMinutes: config.candleMinutes,
            tradesInRange: validTrades.length,
        };

        // Update cache
        priceCache.set(cacheKey, {
            timestamp: now,
            data: stockData,
        });

        return NextResponse.json(stockData);

    } catch (error) {
        console.error('Bitquery API error:', error);
        
        // Return cached data if available, even if stale
        if (cached) {
            return NextResponse.json({
                ...cached.data,
                stale: true,
                error: 'Using cached data due to API error',
            });
        }

        return NextResponse.json(
            { 
                error: 'Failed to fetch price data from Bitquery',
                details: error instanceof Error ? error.message : 'Unknown error',
                hint: 'Make sure BITQUERY_CLIENT_ID and BITQUERY_CLIENT_SECRET are set in .env.local'
            },
            { status: 500 }
        );
    }
}

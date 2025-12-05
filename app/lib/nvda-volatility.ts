/**
 * NVDA Volatility Service
 * 
 * Fetches real NVIDIA stock historical data from Yahoo Finance,
 * caches it locally, and calculates historical volatility for
 * use as a base IV in options pricing.
 */

import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';

// Initialize Yahoo Finance instance (required for v3)
const yahooFinance = new YahooFinance();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NVDAVolatilityData {
    symbol: string;
    lastUpdated: string;
    lastPrice: number;
    priceChange: number;
    priceChangePct: number;
    
    // Historical volatility metrics
    hv10: number;   // 10-day HV
    hv20: number;   // 20-day HV
    hv30: number;   // 30-day HV
    hv60: number;   // 60-day HV
    hv90: number;   // 90-day HV
    
    // Recommended base IV for options (HV + premium)
    baseIV: number;
    
    // Raw price history (last 100 days)
    priceHistory: {
        date: string;
        close: number;
        volume: number;
    }[];
}

interface CacheData {
    fetchedAt: string;
    data: NVDAVolatilityData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_FILE = path.join(process.cwd(), 'data', 'nvda-volatility-cache.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SYMBOL = 'NVDA';

// IV premium over HV (IV is typically 10-30% higher than HV)
const IV_PREMIUM = 0.15; // 15% premium

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate historical volatility from price data
 * Uses log returns and annualized standard deviation
 */
function calculateHV(prices: number[], period: number): number {
    if (prices.length < period + 1) {
        return 0.35; // Default fallback
    }
    
    // Get the last 'period' prices (plus one for calculating returns)
    const data = prices.slice(-(period + 1));
    
    // Calculate log returns
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i] > 0 && data[i - 1] > 0) {
            returns.push(Math.log(data[i] / data[i - 1]));
        }
    }
    
    if (returns.length < 2) return 0.35;
    
    // Calculate mean
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate variance (sample variance with Bessel's correction)
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    // Standard deviation
    const stdDev = Math.sqrt(variance);
    
    // Annualize (252 trading days)
    const annualizedHV = stdDev * Math.sqrt(252);
    
    // Clamp to reasonable range
    return Math.max(0.10, Math.min(2.0, annualizedHV));
}

/**
 * Ensure the data directory exists
 */
function ensureDataDirectory(): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Read cached data from file
 */
function readCache(): CacheData | null {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const content = fs.readFileSync(CACHE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.warn('Failed to read NVDA cache:', error);
    }
    return null;
}

/**
 * Write data to cache file
 */
function writeCache(data: NVDAVolatilityData): void {
    try {
        ensureDataDirectory();
        const cacheData: CacheData = {
            fetchedAt: new Date().toISOString(),
            data
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log('NVDA volatility data cached successfully');
    } catch (error) {
        console.error('Failed to write NVDA cache:', error);
    }
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cache: CacheData): boolean {
    const fetchedAt = new Date(cache.fetchedAt).getTime();
    const now = Date.now();
    return (now - fetchedAt) < CACHE_DURATION_MS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch fresh NVDA data from Yahoo Finance
 */
async function fetchFreshNVDAData(): Promise<NVDAVolatilityData> {
    console.log('Fetching fresh NVDA data from Yahoo Finance...');
    
    // Calculate date range (last 120 days to have enough data for 90-day HV)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 120);
    
    // Fetch historical data
    const result = await yahooFinance.chart(SYMBOL, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
    });
    
    if (!result.quotes || result.quotes.length === 0) {
        throw new Error('No data returned from Yahoo Finance');
    }
    
    // Extract price history
    const priceHistory = result.quotes
        .filter(q => q.close !== null && q.close !== undefined)
        .map(q => ({
            date: new Date(q.date).toISOString().split('T')[0],
            close: q.close!,
            volume: q.volume || 0
        }));
    
    // Get closing prices for HV calculation
    const closePrices = priceHistory.map(p => p.close);
    
    // Calculate HV for different periods
    const hv10 = calculateHV(closePrices, 10);
    const hv20 = calculateHV(closePrices, 20);
    const hv30 = calculateHV(closePrices, 30);
    const hv60 = calculateHV(closePrices, 60);
    const hv90 = calculateHV(closePrices, 90);
    
    // Calculate base IV (weighted HV + premium)
    // Weight recent volatility more heavily
    const weightedHV = hv10 * 0.25 + hv20 * 0.30 + hv30 * 0.25 + hv60 * 0.15 + hv90 * 0.05;
    const baseIV = weightedHV * (1 + IV_PREMIUM);
    
    // Get current price info
    const lastPrice = closePrices[closePrices.length - 1];
    const prevPrice = closePrices[closePrices.length - 2] || lastPrice;
    const priceChange = lastPrice - prevPrice;
    const priceChangePct = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
    
    const data: NVDAVolatilityData = {
        symbol: SYMBOL,
        lastUpdated: new Date().toISOString(),
        lastPrice,
        priceChange,
        priceChangePct,
        hv10,
        hv20,
        hv30,
        hv60,
        hv90,
        baseIV,
        priceHistory: priceHistory.slice(-100) // Keep last 100 days
    };
    
    // Cache the data
    writeCache(data);
    
    console.log(`NVDA HV20: ${(hv20 * 100).toFixed(1)}%, HV30: ${(hv30 * 100).toFixed(1)}%, Base IV: ${(baseIV * 100).toFixed(1)}%`);
    
    return data;
}

/**
 * Get NVDA volatility data (from cache or fresh fetch)
 * This is the main function to call
 */
export async function getNVDAVolatility(forceRefresh: boolean = false): Promise<NVDAVolatilityData> {
    // Try to read from cache first
    if (!forceRefresh) {
        const cache = readCache();
        if (cache && isCacheValid(cache)) {
            console.log('Using cached NVDA volatility data');
            return cache.data;
        }
    }
    
    // Fetch fresh data
    try {
        return await fetchFreshNVDAData();
    } catch (error) {
        console.error('Failed to fetch NVDA data:', error);
        
        // If fetch fails but we have stale cache, use it
        const cache = readCache();
        if (cache) {
            console.warn('Using stale NVDA cache due to fetch failure');
            return cache.data;
        }
        
        // Return default values if no cache exists
        return getDefaultVolatilityData();
    }
}

/**
 * Get default volatility data (fallback when no data available)
 */
export function getDefaultVolatilityData(): NVDAVolatilityData {
    return {
        symbol: SYMBOL,
        lastUpdated: new Date().toISOString(),
        lastPrice: 0,
        priceChange: 0,
        priceChangePct: 0,
        hv10: 0.40,
        hv20: 0.38,
        hv30: 0.36,
        hv60: 0.35,
        hv90: 0.34,
        baseIV: 0.42, // ~40% is typical for NVDA
        priceHistory: []
    };
}

/**
 * Get just the base IV value (convenience function)
 */
export async function getNVDABaseIV(): Promise<number> {
    const data = await getNVDAVolatility();
    return data.baseIV;
}

/**
 * Check when the cache was last updated
 */
export function getCacheStatus(): { exists: boolean; lastUpdated: string | null; isValid: boolean } {
    const cache = readCache();
    if (!cache) {
        return { exists: false, lastUpdated: null, isValid: false };
    }
    return {
        exists: true,
        lastUpdated: cache.fetchedAt,
        isValid: isCacheValid(cache)
    };
}

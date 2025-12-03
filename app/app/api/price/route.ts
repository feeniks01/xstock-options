import { NextResponse } from 'next/server';

// Price simulation state
let currentPrice = 123.45;
let lastUpdate = Date.now();
let priceHistory: { timestamp: number; price: number }[] = [];
let initialized = false;

// Initialize price from a deterministic seed based on the hour
// This provides consistency across server restarts within the same hour
function initializePrice() {
    if (initialized) return;
    
    const now = new Date();
    // Create a seed from the current date/hour for consistency
    const seed = now.getFullYear() * 1000000 + 
                 (now.getMonth() + 1) * 10000 + 
                 now.getDate() * 100 + 
                 now.getHours();
    
    // Deterministic starting price based on seed (100-150 range)
    currentPrice = 100 + (seed % 50) + ((seed % 100) / 100);
    lastUpdate = Date.now();
    initialized = true;
}

// Generate simulated tick data for more realistic OHLC candles
function generateTickData(basePrice: number, numTicks: number = 10): number[] {
    const ticks: number[] = [];
    let price = basePrice;
    
    // Generate micro-movements within this update period
    for (let i = 0; i < numTicks; i++) {
        // Small random walk for each tick (much smaller volatility)
        const microChange = (Math.random() - 0.5) * 0.002; // ±0.1% per tick
        price = price * (1 + microChange);
        ticks.push(price);
    }
    
    return ticks;
}

export async function GET() {
    initializePrice();
    
    const now = Date.now();
    const timeDiff = (now - lastUpdate) / 1000; // seconds since last update

    // Simulate price movement (Random Walk)
    // Volatility: 30% annualized (increased for more visible movement)
    // Drift: 2% annualized
    if (timeDiff > 0) {
        const volatility = 0.30;
        const drift = 0.02;
        const dt = timeDiff / (365 * 24 * 3600); // time in years

        const change = (drift * dt) + (volatility * Math.sqrt(dt) * (Math.random() - 0.5) * 2);
        currentPrice = currentPrice * (1 + change);
        
        // Clamp price to reasonable bounds
        currentPrice = Math.max(50, Math.min(500, currentPrice));
        
        lastUpdate = now;
    }

    // Generate tick data for this period to create realistic OHLC
    const ticks = generateTickData(currentPrice, 10);
    
    // Calculate OHLC from ticks
    const open = ticks[0];
    const close = ticks[ticks.length - 1];
    const high = Math.max(...ticks);
    const low = Math.min(...ticks);
    
    // Update current price to the close
    currentPrice = close;

    // Store in history (keep last 1000 points)
    priceHistory.push({ timestamp: now, price: currentPrice });
    if (priceHistory.length > 1000) {
        priceHistory = priceHistory.slice(-1000);
    }

    return NextResponse.json({
        price: currentPrice,
        timestamp: now,
        ohlc: { open, high, low, close },
        ticks // Include tick data for frontend candle building
    });
}

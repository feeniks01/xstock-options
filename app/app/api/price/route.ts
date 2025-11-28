import { NextResponse } from 'next/server';

// Simple in-memory storage for simulation state (resets on server restart)
let currentPrice = 123.45;
let lastUpdate = Date.now();

export async function GET() {
    const now = Date.now();
    const timeDiff = (now - lastUpdate) / 1000; // seconds since last update

    // Simulate price movement (Random Walk)
    // Volatility: 20% annualized
    // Drift: 5% annualized
    if (timeDiff > 0) {
        const volatility = 0.20;
        const drift = 0.05;
        const dt = timeDiff / (365 * 24 * 3600); // time in years

        const change = (drift * dt) + (volatility * Math.sqrt(dt) * (Math.random() - 0.5) * 2);
        currentPrice = currentPrice * (1 + change);
        lastUpdate = now;
    }

    return NextResponse.json({
        price: currentPrice,
        timestamp: now
    });
}

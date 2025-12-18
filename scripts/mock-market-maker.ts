/**
 * Enhanced Mock Market Maker
 * Multi-instance support with configurable pricing strategies
 * 
 * Usage:
 *   npx ts-node mock-market-maker.ts                    # Single maker, default strategy
 *   npx ts-node mock-market-maker.ts --count 3          # 3 competing makers
 *   npx ts-node mock-market-maker.ts --strategy aggressive
 *   npx ts-node mock-market-maker.ts --count 3 --strategy random
 */

import WebSocket from "ws";

// ============================================================================
// Configuration
// ============================================================================

const WS_URL = process.env.RFQ_WS_URL || "ws://localhost:3006";
const HTTP_URL = process.env.RFQ_HTTP_URL || "http://localhost:3005";

// Parse CLI arguments
const args = process.argv.slice(2);
const countIdx = args.indexOf("--count");
const strategyIdx = args.indexOf("--strategy");

const MAKER_COUNT = countIdx !== -1 ? parseInt(args[countIdx + 1]) || 1 : 1;
const STRATEGY = strategyIdx !== -1 ? args[strategyIdx + 1] : "balanced";

// ============================================================================
// Types
// ============================================================================

interface RfqData {
    id: string;
    underlying: string;
    optionType: "CALL" | "PUT";
    strike: number;
    size: number;
    oraclePrice: number;
    expiryTs: number;
    premiumFloor: number;
    validUntilTs: number;
}

interface MakerMetrics {
    pubkey: string;
    quotesSent: number;
    fillsWon: number;
    totalPremiumEarned: number;
    avgResponseLatencyMs: number;
    responseTimes: number[];
}

type Strategy = "aggressive" | "conservative" | "balanced" | "random";

// ============================================================================
// Pricing Strategies
// ============================================================================

const strategies: Record<Strategy, {
    basePremiumPct: number;
    spreadRange: [number, number];
    description: string;
}> = {
    aggressive: {
        basePremiumPct: 0.012, // 1.2% - higher premium to win
        spreadRange: [0.95, 1.05],
        description: "Offers higher premiums to win more fills",
    },
    conservative: {
        basePremiumPct: 0.005, // 0.5% - lower premium, higher profit margin
        spreadRange: [0.9, 1.0],
        description: "Offers lower premiums for higher margins",
    },
    balanced: {
        basePremiumPct: 0.008, // 0.8% - middle ground
        spreadRange: [0.9, 1.1],
        description: "Balanced approach between volume and margin",
    },
    random: {
        basePremiumPct: 0.01, // varies
        spreadRange: [0.7, 1.3],
        description: "Random strategy for testing edge cases",
    },
};

function calculatePremium(
    rfq: RfqData,
    strategy: Strategy,
    makerIndex: number
): number {
    const spotPrice = rfq.oraclePrice;
    const strike = rfq.strike;
    const size = rfq.size;
    const expiryTs = rfq.expiryTs;
    const optionType = rfq.optionType;

    const now = Date.now() / 1000;
    const daysToExpiry = Math.max(0.1, (expiryTs - now) / (24 * 60 * 60));

    // Moneyness: how far OTM the strike is
    const otmPct = optionType === "CALL"
        ? (strike - spotPrice) / spotPrice
        : (spotPrice - strike) / spotPrice;

    const strategyConfig = strategies[strategy];

    // Base premium from strategy
    let basePremiumPct = strategyConfig.basePremiumPct;

    // Add maker-specific variance (so competing makers give different quotes)
    const makerVariance = 1 + (makerIndex * 0.02 - 0.01); // +/- 1% per maker

    // Adjust for time - more time = more premium (sqrt of time)
    const timeMultiplier = Math.sqrt(daysToExpiry / 7);

    // Adjust for OTM - further OTM = less premium
    const otmMultiplier = Math.max(0.3, 1 - Math.abs(otmPct) * 2);

    // Random spread within strategy range
    const [minSpread, maxSpread] = strategyConfig.spreadRange;
    const randomSpread = minSpread + Math.random() * (maxSpread - minSpread);

    const premiumPct = basePremiumPct * timeMultiplier * otmMultiplier * randomSpread * makerVariance;

    // Premium in token units
    return Math.round(size * premiumPct);
}

// ============================================================================
// Maker Instance
// ============================================================================

async function registerMaker(pubkey: string): Promise<boolean> {
    try {
        const response = await fetch(`${HTTP_URL}/makers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pubkey }),
        });
        const data = await response.json() as { success: boolean };
        return data.success;
    } catch (error) {
        console.error(`Failed to register maker ${pubkey}:`, error);
        return false;
    }
}

function createMaker(index: number, strategy: Strategy): void {
    const pubkey = `MockMaker${String(index + 1).padStart(2, "0")}11111111111111111111111111111`;

    const metrics: MakerMetrics = {
        pubkey,
        quotesSent: 0,
        fillsWon: 0,
        totalPremiumEarned: 0,
        avgResponseLatencyMs: 0,
        responseTimes: [],
    };

    const log = (msg: string) => console.log(`[Maker ${index + 1}] ${msg}`);

    const ws = new WebSocket(WS_URL);

    ws.on("open", async () => {
        log(`✅ Connected`);

        // Register in allowlist
        await registerMaker(pubkey);

        // Register on WebSocket
        ws.send(JSON.stringify({
            type: "REGISTER",
            data: { pubkey },
        }));
    });

    ws.on("message", (data) => {
        const startTime = Date.now();
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case "REGISTERED":
                    log(`📋 Registered, strategy: ${strategy}`);
                    break;

                case "NEW_RFQ":
                    const rfq: RfqData = message.data;
                    log(`📥 RFQ ${rfq.id.slice(-8)}: ${rfq.underlying} ${rfq.optionType} @ $${(rfq.strike / 1e6).toFixed(2)}`);

                    // Calculate premium based on strategy
                    const premium = calculatePremium(rfq, strategy, index);

                    // Only quote if above floor
                    if (premium >= rfq.premiumFloor) {
                        const responseTime = Date.now() - startTime;
                        metrics.responseTimes.push(responseTime);
                        metrics.avgResponseLatencyMs =
                            metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;

                        // Add small random delay to simulate network latency
                        const delay = Math.floor(Math.random() * 100);
                        setTimeout(() => {
                            ws.send(JSON.stringify({
                                type: "QUOTE",
                                data: {
                                    rfqId: rfq.id,
                                    makerPubkey: pubkey,
                                    premium,
                                    validUntilTs: rfq.validUntilTs,
                                    signature: `sig_${pubkey.slice(0, 8)}_${Date.now()}`,
                                },
                            }));
                            metrics.quotesSent++;
                            log(`   📤 Quoted: ${premium} (${(premium / rfq.size * 100).toFixed(3)}%)`);
                        }, delay);
                    } else {
                        log(`   ⏭️ Skip (below floor: ${premium} < ${rfq.premiumFloor})`);
                    }
                    break;

                case "QUOTE_ACK":
                    // Acknowledged, waiting for result
                    break;

                case "RFQ_FILLED":
                    metrics.fillsWon++;
                    metrics.totalPremiumEarned += message.data.premium;
                    log(`🎉 WON! Premium: ${message.data.premium} | Total wins: ${metrics.fillsWon}`);
                    break;

                case "ERROR":
                    log(`❌ Error: ${message.error}`);
                    break;
            }
        } catch (error) {
            log(`Parse error: ${error}`);
        }
    });

    ws.on("error", (error) => {
        log(`WebSocket error: ${error.message}`);
    });

    ws.on("close", () => {
        log(`Disconnected. Stats: ${metrics.quotesSent} quotes, ${metrics.fillsWon} wins`);
    });

    // Periodic stats logging
    setInterval(() => {
        if (metrics.quotesSent > 0) {
            const winRate = (metrics.fillsWon / metrics.quotesSent * 100).toFixed(1);
            log(`📊 Quotes: ${metrics.quotesSent} | Wins: ${metrics.fillsWon} (${winRate}%) | Earned: ${metrics.totalPremiumEarned}`);
        }
    }, 60000); // Every minute
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("               xStock Mock Market Maker (Enhanced)              ");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Makers:    ${MAKER_COUNT}`);
    console.log(`  Strategy:  ${STRATEGY} - ${strategies[STRATEGY as Strategy]?.description || "unknown"}`);
    console.log(`  Router:    ${WS_URL}`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Validate strategy
    if (!strategies[STRATEGY as Strategy]) {
        console.error(`Unknown strategy: ${STRATEGY}`);
        console.log(`Available: ${Object.keys(strategies).join(", ")}`);
        process.exit(1);
    }

    // Create maker instances
    for (let i = 0; i < MAKER_COUNT; i++) {
        console.log(`Starting Maker ${i + 1}/${MAKER_COUNT}...`);
        createMaker(i, STRATEGY as Strategy);

        // Stagger connections slightly
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log("\n🔄 All makers started. Waiting for RFQs...\n");

    // Handle shutdown
    process.on("SIGINT", () => {
        console.log("\n\nShutting down all makers...");
        process.exit(0);
    });
}

main().catch(console.error);

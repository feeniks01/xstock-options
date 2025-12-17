/**
 * Mock Market Maker
 * A simple script that simulates a market maker responding to RFQs
 * Run with: npx ts-node mock-market-maker.ts
 */

import WebSocket from "ws";

const WS_URL = process.env.RFQ_WS_URL || "ws://localhost:3006";
const HTTP_URL = process.env.RFQ_HTTP_URL || "http://localhost:3005";
const MAKER_PUBKEY = process.env.MAKER_PUBKEY || "MockMaker1111111111111111111111111111111111";

// Premium calculation: basis points based on days to expiry and moneyness
function calculatePremium(
    spotPrice: number,
    strike: number,
    size: number,
    expiryTs: number,
    optionType: "CALL" | "PUT"
): number {
    const now = Date.now() / 1000;
    const daysToExpiry = (expiryTs - now) / (24 * 60 * 60);

    // Moneyness: how far OTM the strike is
    const otmPct = optionType === "CALL"
        ? (strike - spotPrice) / spotPrice
        : (spotPrice - strike) / spotPrice;

    // Base premium: ~0.5-1.5% per week depending on volatility
    const basePremiumPct = 0.008; // 0.8%

    // Adjust for time - more time = more premium
    const timeMultiplier = Math.sqrt(daysToExpiry / 7);

    // Adjust for OTM - further OTM = less premium
    const otmMultiplier = Math.max(0.3, 1 - otmPct * 2);

    // Random spread +/- 10%
    const randomSpread = 0.9 + Math.random() * 0.2;

    const premiumPct = basePremiumPct * timeMultiplier * otmMultiplier * randomSpread;

    // Premium in token units (assuming 6 decimals)
    const premium = Math.round(size * premiumPct);

    return premium;
}

async function registerMaker() {
    // First add maker to allowlist via HTTP
    try {
        const response = await fetch(`${HTTP_URL}/makers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pubkey: MAKER_PUBKEY }),
        });
        const data = await response.json();
        console.log("Registered in allowlist:", data);
    } catch (error) {
        console.error("Failed to register in allowlist:", error);
    }
}

async function main() {
    console.log("=======================================");
    console.log("Mock Market Maker");
    console.log("=======================================");
    console.log(`Connecting to: ${WS_URL}`);
    console.log(`Maker pubkey: ${MAKER_PUBKEY}`);
    console.log("=======================================\n");

    // Register in allowlist first
    await registerMaker();

    // Connect to WebSocket
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
        console.log("✅ Connected to RFQ Router\n");

        // Register as maker
        ws.send(JSON.stringify({
            type: "REGISTER",
            data: { pubkey: MAKER_PUBKEY },
        }));
    });

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case "REGISTERED":
                    console.log("✅ Registered as maker");
                    console.log("🔄 Waiting for RFQs...\n");
                    break;

                case "NEW_RFQ":
                    const rfq = message.data;
                    console.log("📥 New RFQ received:");
                    console.log(`   ID: ${rfq.id}`);
                    console.log(`   Underlying: ${rfq.underlying}`);
                    console.log(`   Type: ${rfq.optionType}`);
                    console.log(`   Strike: $${(rfq.strike / 1e6).toFixed(2)}`);
                    console.log(`   Size: ${(rfq.size / 1e6).toFixed(2)}`);
                    console.log(`   Oracle Price: $${(rfq.oraclePrice / 1e6).toFixed(2)}`);
                    console.log(`   Premium Floor: ${rfq.premiumFloor}`);

                    // Calculate and submit quote
                    const premium = calculatePremium(
                        rfq.oraclePrice,
                        rfq.strike,
                        rfq.size,
                        rfq.expiryTs,
                        rfq.optionType
                    );

                    // Only quote if above floor
                    if (premium >= rfq.premiumFloor) {
                        console.log(`   📤 Submitting quote: ${premium} (${(premium / rfq.size * 100).toFixed(3)}%)`);

                        ws.send(JSON.stringify({
                            type: "QUOTE",
                            data: {
                                rfqId: rfq.id,
                                makerPubkey: MAKER_PUBKEY,
                                premium,
                                validUntilTs: rfq.validUntilTs,
                                signature: "mock_signature_" + Date.now(),
                            },
                        }));
                    } else {
                        console.log(`   ⚠️ Skipping - premium ${premium} below floor ${rfq.premiumFloor}`);
                    }
                    console.log("");
                    break;

                case "QUOTE_ACK":
                    console.log(`✅ Quote acknowledged for RFQ: ${message.rfqId}\n`);
                    break;

                case "RFQ_FILLED":
                    console.log(`🎉 RFQ FILLED!`);
                    console.log(`   RFQ ID: ${message.data.rfqId}`);
                    console.log(`   Premium: ${message.data.premium}\n`);
                    break;

                case "ERROR":
                    console.log(`❌ Error: ${message.error}\n`);
                    break;

                default:
                    console.log("Unknown message:", message);
            }
        } catch (error) {
            console.error("Failed to parse message:", error);
        }
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error.message);
    });

    ws.on("close", () => {
        console.log("Disconnected from RFQ Router");
        process.exit(0);
    });

    // Keep alive
    process.on("SIGINT", () => {
        console.log("\nShutting down...");
        ws.close();
        process.exit(0);
    });
}

main().catch(console.error);

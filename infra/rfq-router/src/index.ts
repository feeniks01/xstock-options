import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
} from "@solana/web3.js";
import express, { Request, Response } from "express";
import WebSocket, { WebSocketServer } from "ws";
import * as dotenv from "dotenv";
import { IncomingMessage } from "http";

dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const RFQ_PROGRAM_ID = new PublicKey(
    process.env.RFQ_PROGRAM_ID || "3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z"
);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3001");
const WS_PORT = parseInt(process.env.WS_PORT || "3002");
const QUOTE_TIMEOUT_MS = parseInt(process.env.QUOTE_TIMEOUT_MS || "30000");

// Types
interface RfqRequest {
    id: string;
    underlying: string;
    optionType: "CALL" | "PUT";
    expiryTs: number;
    strike: number;
    size: number;
    premiumFloor: number;
    validUntilTs: number;
    settlement: "CASH" | "PHYSICAL";
    oraclePrice: number;
    oracleTs: number;
}

interface Quote {
    rfqId: string;
    makerPubkey: string;
    premium: number;
    validUntilTs: number;
    signature: string;
    receivedAt: number;
}

interface RfqState {
    request: RfqRequest;
    quotes: Quote[];
    status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
    bestQuote: Quote | null;
    createdAt: number;
}

// In-memory state
const activeRfqs = new Map<string, RfqState>();
const connectedMakers = new Map<string, WebSocket>();
const makerAllowlist = new Set<string>();

// Express app for HTTP API
const app = express();
app.use(express.json());

// WebSocket server for maker connections
const wss = new WebSocketServer({ port: WS_PORT });

// Utility functions
function generateRfqId(): string {
    return `rfq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function selectBestQuote(quotes: Quote[]): Quote | null {
    if (quotes.length === 0) return null;
    // Select highest premium
    return quotes.reduce((best, quote) =>
        quote.premium > best.premium ? quote : best
    );
}

// HTTP API Endpoints

// Create a new RFQ
app.post("/rfq", async (req: Request, res: Response) => {
    try {
        const {
            underlying,
            optionType,
            expiryTs,
            strike,
            size,
            premiumFloor,
            validUntilTs,
            settlement,
            oraclePrice,
            oracleTs,
        } = req.body;

        const rfqId = generateRfqId();
        const request: RfqRequest = {
            id: rfqId,
            underlying,
            optionType,
            expiryTs,
            strike,
            size,
            premiumFloor,
            validUntilTs,
            settlement,
            oraclePrice,
            oracleTs,
        };

        const state: RfqState = {
            request,
            quotes: [],
            status: "OPEN",
            bestQuote: null,
            createdAt: Date.now(),
        };

        activeRfqs.set(rfqId, state);

        // Broadcast to all connected makers
        const message = JSON.stringify({ type: "NEW_RFQ", data: request });
        for (const [, ws] of connectedMakers) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }

        console.log(`[RFQ ${rfqId}] Created - ${underlying} ${optionType} ${strike}`);

        // Set expiry timer
        setTimeout(() => {
            const rfq = activeRfqs.get(rfqId);
            if (rfq && rfq.status === "OPEN") {
                rfq.status = "EXPIRED";
                console.log(`[RFQ ${rfqId}] Expired`);
            }
        }, validUntilTs * 1000 - Date.now());

        res.json({ success: true, rfqId, request });
    } catch (error) {
        console.error("Error creating RFQ:", error);
        res.status(500).json({ success: false, error: "Failed to create RFQ" });
    }
});

// Get RFQ status
app.get("/rfq/:id", (req: Request, res: Response) => {
    const rfq = activeRfqs.get(req.params.id);
    if (!rfq) {
        return res.status(404).json({ success: false, error: "RFQ not found" });
    }
    res.json({
        success: true,
        rfq: {
            ...rfq.request,
            status: rfq.status,
            quoteCount: rfq.quotes.length,
            bestQuote: rfq.bestQuote
                ? { premium: rfq.bestQuote.premium, maker: rfq.bestQuote.makerPubkey }
                : null,
        },
    });
});

// List active RFQs
app.get("/rfqs", (req: Request, res: Response) => {
    const rfqs = Array.from(activeRfqs.entries())
        .filter(([, state]) => state.status === "OPEN")
        .map(([id, state]) => ({
            id,
            underlying: state.request.underlying,
            strike: state.request.strike,
            size: state.request.size,
            quoteCount: state.quotes.length,
        }));

    res.json({ success: true, rfqs });
});

// Fill the best quote for an RFQ
app.post("/rfq/:id/fill", async (req: Request, res: Response) => {
    try {
        const rfq = activeRfqs.get(req.params.id);
        if (!rfq) {
            return res.status(404).json({ success: false, error: "RFQ not found" });
        }

        if (rfq.status !== "OPEN") {
            return res.status(400).json({ success: false, error: `RFQ is ${rfq.status}` });
        }

        const bestQuote = selectBestQuote(rfq.quotes);
        if (!bestQuote) {
            return res.status(400).json({ success: false, error: "No quotes received" });
        }

        // Validate premium meets floor
        if (bestQuote.premium < rfq.request.premiumFloor) {
            return res.status(400).json({
                success: false,
                error: `Best quote ${bestQuote.premium} below floor ${rfq.request.premiumFloor}`,
            });
        }

        // In production, submit the fill transaction to the chain here
        console.log(`[RFQ ${req.params.id}] Filling with quote from ${bestQuote.makerPubkey}`);
        console.log(`  Premium: ${bestQuote.premium}`);

        rfq.status = "FILLED";
        rfq.bestQuote = bestQuote;

        // Notify the winning maker
        const makerWs = connectedMakers.get(bestQuote.makerPubkey);
        if (makerWs && makerWs.readyState === WebSocket.OPEN) {
            makerWs.send(
                JSON.stringify({
                    type: "RFQ_FILLED",
                    data: { rfqId: req.params.id, premium: bestQuote.premium },
                })
            );
        }

        res.json({
            success: true,
            filled: {
                rfqId: req.params.id,
                maker: bestQuote.makerPubkey,
                premium: bestQuote.premium,
            },
        });
    } catch (error) {
        console.error("Error filling RFQ:", error);
        res.status(500).json({ success: false, error: "Failed to fill RFQ" });
    }
});

// Add maker to allowlist
app.post("/makers", (req: Request, res: Response) => {
    const { pubkey } = req.body;
    if (!pubkey) {
        return res.status(400).json({ success: false, error: "Missing pubkey" });
    }
    makerAllowlist.add(pubkey);
    console.log(`Added maker to allowlist: ${pubkey}`);
    res.json({ success: true, pubkey });
});

// List makers
app.get("/makers", (req: Request, res: Response) => {
    const makers = Array.from(makerAllowlist).map((pubkey) => ({
        pubkey,
        connected: connectedMakers.has(pubkey),
    }));
    res.json({ success: true, makers });
});

// WebSocket handler for makers
wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("New WebSocket connection");

    ws.on("message", (data: WebSocket.RawData) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case "REGISTER":
                    const { pubkey } = message.data;
                    if (!makerAllowlist.has(pubkey)) {
                        ws.send(JSON.stringify({ type: "ERROR", error: "Not in allowlist" }));
                        ws.close();
                        return;
                    }
                    connectedMakers.set(pubkey, ws);
                    console.log(`Maker registered: ${pubkey}`);
                    ws.send(JSON.stringify({ type: "REGISTERED", pubkey }));
                    break;

                case "QUOTE":
                    const quote: Quote = {
                        rfqId: message.data.rfqId,
                        makerPubkey: message.data.makerPubkey,
                        premium: message.data.premium,
                        validUntilTs: message.data.validUntilTs,
                        signature: message.data.signature,
                        receivedAt: Date.now(),
                    };

                    const rfq = activeRfqs.get(quote.rfqId);
                    if (!rfq) {
                        ws.send(JSON.stringify({ type: "ERROR", error: "RFQ not found" }));
                        return;
                    }

                    if (rfq.status !== "OPEN") {
                        ws.send(JSON.stringify({ type: "ERROR", error: `RFQ is ${rfq.status}` }));
                        return;
                    }

                    if (!makerAllowlist.has(quote.makerPubkey)) {
                        ws.send(JSON.stringify({ type: "ERROR", error: "Maker not in allowlist" }));
                        return;
                    }

                    rfq.quotes.push(quote);
                    console.log(`[RFQ ${quote.rfqId}] Quote received: ${quote.premium} from ${quote.makerPubkey}`);
                    ws.send(JSON.stringify({ type: "QUOTE_ACK", rfqId: quote.rfqId }));
                    break;

                default:
                    ws.send(JSON.stringify({ type: "ERROR", error: "Unknown message type" }));
            }
        } catch (error) {
            console.error("WebSocket message error:", error);
            ws.send(JSON.stringify({ type: "ERROR", error: "Invalid message" }));
        }
    });

    ws.on("close", () => {
        // Remove from connected makers
        for (const [pubkey, socket] of connectedMakers) {
            if (socket === ws) {
                connectedMakers.delete(pubkey);
                console.log(`Maker disconnected: ${pubkey}`);
                break;
            }
        }
    });
});

// Start servers
app.listen(HTTP_PORT, () => {
    console.log("=================================");
    console.log("RFQ Router Started");
    console.log("=================================");
    console.log(`HTTP API: http://localhost:${HTTP_PORT}`);
    console.log(`WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`RFQ Program: ${RFQ_PROGRAM_ID.toBase58()}`);
    console.log(`Quote Timeout: ${QUOTE_TIMEOUT_MS}ms`);
    console.log("=================================");
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\nShutting down...");
    wss.close();
    process.exit(0);
});

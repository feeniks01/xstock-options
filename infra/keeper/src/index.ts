/**
 * xStock Keeper Service
 * 
 * Automates vault epoch transitions:
 * 1. Check if epoch is ready to roll
 * 2. Fetch oracle price
 * 3. Compute strike (spot + delta OTM)
 * 4. Issue RFQ via router
 * 5. Wait for quotes
 * 6. Submit best quote fill
 * 7. Record notional exposure
 * 8. Advance epoch
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as cron from "node-cron";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createLogger, format, transports } from "winston";
import express, { Request, Response } from "express";
import { OnChainClient } from "./onchain";

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const config = {
    rpcUrl: process.env.RPC_URL || "https://api.devnet.solana.com",
    keeperKeypairPath: process.env.KEEPER_KEYPAIR_PATH || "./keeper-keypair.json",

    vaultProgramId: new PublicKey(process.env.VAULT_PROGRAM_ID || "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"),
    rfqProgramId: new PublicKey(process.env.RFQ_PROGRAM_ID || "3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z"),
    oracleProgramId: new PublicKey(process.env.ORACLE_PROGRAM_ID || "5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk"),

    // Pyth price account for NVDA on devnet
    pythPriceAccount: new PublicKey(process.env.PYTH_PRICE_ACCOUNT || "GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU"),

    rfqRouterUrl: process.env.RFQ_ROUTER_URL || "http://localhost:3005",

    assetId: process.env.ASSET_ID || "NVDA",
    epochDurationSeconds: parseInt(process.env.EPOCH_DURATION_SECONDS || "604800"), // 1 week
    cronSchedule: process.env.CRON_SCHEDULE || "0 */6 * * *", // every 6 hours
    quoteWaitMs: parseInt(process.env.QUOTE_WAIT_MS || "30000"), // 30 seconds
    strikeDeltaBps: parseInt(process.env.STRIKE_DELTA_BPS || "500"), // 5% OTM
    utilizationTargetBps: parseInt(process.env.UTILIZATION_TARGET_BPS || "5000"), // 50%

    logLevel: process.env.LOG_LEVEL || "info",
    healthPort: parseInt(process.env.HEALTH_PORT || "3010"),
};

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger({
    level: config.logLevel,
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
            return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: "keeper.log" }),
    ],
});

// ============================================================================
// State
// ============================================================================

interface KeeperState {
    connection: Connection;
    wallet: anchor.Wallet;
    lastRunTime: number | null;
    lastRunSuccess: boolean | null;
    runCount: number;
    errorCount: number;
    isRunning: boolean;
    onchainClient: OnChainClient | null;
    epochPremiumEarned: bigint; // Track premium earned during current epoch
    epochStrikePrice: number;   // Strike price for current epoch (for ITM/OTM calc)
    epochNotional: bigint;      // Notional exposed for settlement payoff calc
}

const state: KeeperState = {
    connection: null!,
    wallet: null!,
    lastRunTime: null,
    lastRunSuccess: null,
    runCount: 0,
    errorCount: 0,
    isRunning: false,
    onchainClient: null,
    epochPremiumEarned: BigInt(0),
    epochStrikePrice: 0,
    epochNotional: BigInt(0),
};

// ============================================================================
// Types
// ============================================================================

interface VaultState {
    authority: PublicKey;
    assetId: string;
    underlyingMint: PublicKey;
    shareMint: PublicKey;
    vaultTokenAccount: PublicKey;
    totalAssets: anchor.BN;
    totalShares: anchor.BN;
    epoch: anchor.BN;
    utilizationCapBps: number;
    lastRollTimestamp: anchor.BN;
    pendingWithdrawals: anchor.BN;
    epochNotionalExposed: anchor.BN;
    epochPremiumEarned: anchor.BN;
    epochPremiumPerTokenBps: number;
    bump: number;
}

interface OraclePrice {
    price: number;
    conf: number;
    exponent: number;
    publishTime: number;
}

interface RfqResponse {
    success: boolean;
    rfqId: string;
    request: {
        id: string;
        underlying: string;
        optionType: "CALL" | "PUT";
        expiryTs: number;
        strike: number;
        size: number;
        premiumFloor: number;
        validUntilTs: number;
    };
}

interface FillResponse {
    success: boolean;
    filled?: {
        rfqId: string;
        maker: string;
        premium: number;
    };
    error?: string;
}

interface OnChainTxResult {
    recordExposureTx: string | null;
    advanceEpochTx: string | null;
    premiumTransferTx?: string | null;
    payoffTransferTx?: string | null;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load keeper wallet from keypair file
 */
function loadWallet(): anchor.Wallet {
    const keypairPath = path.resolve(config.keeperKeypairPath);
    if (!fs.existsSync(keypairPath)) {
        throw new Error(`Keeper keypair not found at ${keypairPath}`);
    }
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    return new anchor.Wallet(keypair);
}

/**
 * Derive vault PDA
 */
function getVaultPda(assetId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        config.vaultProgramId
    );
}

/**
 * Derive oracle asset config PDA
 */
function getOracleAssetPda(assetId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("asset"), Buffer.from(assetId)],
        config.oracleProgramId
    );
}

/**
 * Fetch vault state from chain
 */
async function fetchVaultState(vaultPda: PublicKey): Promise<VaultState | null> {
    try {
        const accountInfo = await state.connection.getAccountInfo(vaultPda);
        if (!accountInfo) {
            logger.error("Vault account not found", { vaultPda: vaultPda.toBase58() });
            return null;
        }

        // Parse vault account data (simplified - in production use Anchor)
        // Offset: 8 (discriminator) + 32 (authority) + 4+len (asset_id string) + ...
        const data = accountInfo.data;

        // For now, return minimal parsed data
        // In production, use the Anchor IDL for proper deserialization
        logger.info("Fetched vault account", { size: data.length });

        // Placeholder - should use proper Anchor deserialization
        return null;
    } catch (error) {
        logger.error("Failed to fetch vault state", { error });
        return null;
    }
}

/**
 * Pyth Feed IDs (same as app uses)
 */
const PYTH_FEED_IDS: Record<string, string> = {
    NVDAx: "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    TSLAx: "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    SPYx: "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    AAPLx: "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    METAx: "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
};

const HERMES_URL = "https://hermes.pyth.network";

/**
 * Fetch current oracle price from Pyth Hermes API
 * (Same API the frontend app uses)
 */
async function fetchOraclePrice(): Promise<OraclePrice | null> {
    const assetId = config.assetId;
    const feedId = PYTH_FEED_IDS[assetId];

    if (!feedId) {
        logger.warn("No Pyth feed ID for asset, using mock price", { assetId });
        return getMockPrice();
    }

    try {
        const response = await axios.get(
            `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`,
            { timeout: 10000 }
        );

        if (response.data?.parsed?.[0]) {
            const priceData = response.data.parsed[0];
            const price = parseFloat(priceData.price.price) * Math.pow(10, priceData.price.expo);
            const conf = parseFloat(priceData.price.conf) * Math.pow(10, priceData.price.expo);
            const publishTime = priceData.price.publish_time;

            logger.info("Fetched price from Pyth Hermes API", {
                assetId,
                price: price.toFixed(2),
                confidence: conf.toFixed(4),
            });

            return {
                price: Math.floor(price * 1_000_000), // Convert to 6 decimals
                conf: Math.floor(conf * 1_000_000),
                exponent: -6,
                publishTime,
            };
        }

        logger.warn("No price data in Hermes response, using mock");
        return getMockPrice();
    } catch (error: any) {
        logger.warn("Hermes API call failed, using mock price", {
            error: error.message || error
        });
        return getMockPrice();
    }
}

/**
 * Mock price fallback for demo
 */
function getMockPrice(): OraclePrice {
    const mockPrice = 140 + (Math.random() * 5 - 2.5);
    logger.info("Using mock oracle price for demo", { mockPrice: mockPrice.toFixed(2) });

    return {
        price: Math.floor(mockPrice * 1_000_000),
        conf: Math.floor(mockPrice * 5_000),
        exponent: -6,
        publishTime: Math.floor(Date.now() / 1000),
    };
}

/**
 * Check if epoch is ready to roll
 */
function isEpochReady(lastRollTimestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - lastRollTimestamp;
    const ready = elapsed >= config.epochDurationSeconds;

    logger.info("Epoch readiness check", {
        lastRoll: new Date(lastRollTimestamp * 1000).toISOString(),
        elapsed,
        threshold: config.epochDurationSeconds,
        ready,
    });

    return ready;
}

/**
 * Compute strike price (OTM by delta)
 */
function computeStrike(spotPrice: number, optionType: "CALL" | "PUT"): number {
    const deltaMultiplier = config.strikeDeltaBps / 10000;

    if (optionType === "CALL") {
        // Calls are OTM above spot
        return Math.floor(spotPrice * (1 + deltaMultiplier));
    } else {
        // Puts are OTM below spot
        return Math.floor(spotPrice * (1 - deltaMultiplier));
    }
}

/**
 * Calculate notional to expose based on TVL and utilization target
 */
function calculateNotional(totalAssets: number): number {
    return Math.floor((totalAssets * config.utilizationTargetBps) / 10000);
}

/**
 * Create RFQ via router
 */
async function createRfq(params: {
    underlying: string;
    optionType: "CALL" | "PUT";
    strike: number;
    size: number;
    oraclePrice: number;
}): Promise<RfqResponse | null> {
    try {
        const now = Math.floor(Date.now() / 1000);
        const expiryTs = now + config.epochDurationSeconds;
        // Add 5 second buffer so RFQ doesn't expire while we're waiting for quotes
        const validUntilTs = now + Math.floor(config.quoteWaitMs / 1000) + 5;

        const response = await axios.post<RfqResponse>(
            `${config.rfqRouterUrl}/rfq`,
            {
                underlying: params.underlying,
                optionType: params.optionType,
                expiryTs,
                strike: params.strike,
                size: params.size,
                premiumFloor: Math.floor(params.size * 0.003), // 0.3% minimum premium
                validUntilTs,
                settlement: "CASH",
                oraclePrice: params.oraclePrice,
                oracleTs: now,
            },
            { timeout: 10000 }
        );

        logger.info("RFQ created", { rfqId: response.data.rfqId });
        return response.data;
    } catch (error) {
        logger.error("Failed to create RFQ", { error });
        return null;
    }
}

/**
 * Wait for quotes and fill best one
 */
async function waitAndFill(rfqId: string): Promise<FillResponse | null> {
    logger.info("Waiting for quotes...", { rfqId, waitMs: config.quoteWaitMs });

    // Wait for quote period
    await new Promise((resolve) => setTimeout(resolve, config.quoteWaitMs));

    try {
        // Fill the best quote
        const response = await axios.post<FillResponse>(
            `${config.rfqRouterUrl}/rfq/${rfqId}/fill`,
            {},
            { timeout: 30000 }
        );

        if (response.data.success && response.data.filled) {
            logger.info("RFQ filled", {
                rfqId,
                maker: response.data.filled.maker,
                premium: response.data.filled.premium,
            });
            return response.data;
        } else {
            logger.warn("RFQ fill failed", { rfqId, error: response.data.error });
            return response.data;
        }
    } catch (error: any) {
        logger.error("Failed to fill RFQ", {
            rfqId,
            error: error.response?.data || error.message
        });
        return null;
    }
}

/**
 * Main epoch roll procedure
 */
async function runEpochRoll(): Promise<boolean> {
    if (state.isRunning) {
        logger.warn("Epoch roll already in progress, skipping");
        return false;
    }

    state.isRunning = true;
    state.runCount++;

    logger.info("========================================");
    logger.info("Starting epoch roll", { runNumber: state.runCount });
    logger.info("========================================");

    try {
        // Step 1: Fetch oracle price
        logger.info("Step 1: Fetching oracle price...");
        const oraclePrice = await fetchOraclePrice();
        if (!oraclePrice) {
            throw new Error("Could not fetch oracle price");
        }
        logger.info("Oracle price", {
            price: oraclePrice.price / 1_000_000,
            conf: oraclePrice.conf,
        });

        // Step 2: Compute strike
        logger.info("Step 2: Computing strike...");
        const optionType = "CALL" as const;
        const strike = computeStrike(oraclePrice.price, optionType);
        logger.info("Strike computed", {
            optionType,
            spot: oraclePrice.price / 1_000_000,
            strike: strike / 1_000_000,
            deltaBps: config.strikeDeltaBps,
        });

        // Step 3: Calculate notional (placeholder TVL for now)
        logger.info("Step 3: Calculating notional...");
        const mockTvl = 100_000_000_000; // 100,000 tokens (6 decimals)
        const notional = calculateNotional(mockTvl);
        logger.info("Notional calculated", {
            tvl: mockTvl / 1_000_000,
            utilizationBps: config.utilizationTargetBps,
            notional: notional / 1_000_000,
        });

        // Step 4: Create RFQ
        logger.info("Step 4: Creating RFQ...");
        const rfqResponse = await createRfq({
            underlying: config.assetId,
            optionType,
            strike,
            size: notional,
            oraclePrice: oraclePrice.price,
        });

        if (!rfqResponse?.success) {
            throw new Error("Failed to create RFQ");
        }

        // Step 5: Wait for quotes and fill
        logger.info("Step 5: Waiting for quotes and filling...");
        const fillResponse = await waitAndFill(rfqResponse.rfqId);

        if (!fillResponse?.success) {
            logger.warn("No valid quotes received, epoch roll incomplete");
            // In production, might still advance epoch with 0 premium
            return false;
        }

        // Step 6: Record exposure and advance epoch (on-chain)
        logger.info("Step 6: Recording exposure and advancing epoch...");

        let onchainTxs: OnChainTxResult = {
            recordExposureTx: null,
            advanceEpochTx: null,
        };

        if (state.onchainClient) {
            try {
                const premium = BigInt(fillResponse.filled?.premium || 0);

                // Step 1: Transfer USDC premium from MM (keeper) to vault escrow
                if (premium > 0) {
                    try {
                        const vaultUsdcAccount = await state.onchainClient.getOrCreateVaultUsdcAccount(config.assetId);
                        const premiumTx = await state.onchainClient.transferPremium(vaultUsdcAccount, premium);
                        logger.info("USDC premium transferred", {
                            tx: premiumTx,
                            amount: premium.toString(),
                            vaultUsdcAccount: vaultUsdcAccount.toBase58()
                        });
                        onchainTxs.premiumTransferTx = premiumTx;
                    } catch (premiumError) {
                        logger.error("Premium transfer failed - continuing", { error: premiumError });
                        // Continue with recording exposure even if premium transfer fails
                        // (keeper may not have USDC for demo)
                    }
                }

                // Step 2: Record notional exposure on vault
                const recordTx = await state.onchainClient.recordNotionalExposure(
                    config.assetId,
                    BigInt(notional),
                    premium
                );
                onchainTxs.recordExposureTx = recordTx;
                logger.info("Recorded notional exposure", { tx: recordTx });

                // Track premium in state for manual settlement
                state.epochPremiumEarned = state.epochPremiumEarned + premium;
                state.epochStrikePrice = strike;
                state.epochNotional = state.epochNotional + BigInt(notional);
                logger.info("Epoch data tracked for settlement", {
                    premium: state.epochPremiumEarned.toString(),
                    strike: state.epochStrikePrice,
                    notional: state.epochNotional.toString()
                });

                // NOTE: Epoch advance is now triggered manually via /settle endpoint

            } catch (onchainError) {
                logger.error("On-chain transaction failed", { error: onchainError });
                // Don't fail the whole epoch roll - log and continue
            }
        } else {
            logger.warn("No on-chain client available - skipping on-chain transactions");
        }

        logger.info("========================================");
        logger.info("Epoch roll completed successfully", {
            rfqId: rfqResponse.rfqId,
            premium: fillResponse.filled?.premium,
            maker: fillResponse.filled?.maker,
            recordExposureTx: onchainTxs.recordExposureTx,
            advanceEpochTx: onchainTxs.advanceEpochTx,
        });
        logger.info("========================================");

        state.lastRunSuccess = true;
        return true;

    } catch (error) {
        logger.error("Epoch roll failed", { error });
        state.errorCount++;
        state.lastRunSuccess = false;
        return false;
    } finally {
        state.isRunning = false;
        state.lastRunTime = Date.now();
    }
}

// ============================================================================
// Health Endpoint
// ============================================================================

function startHealthServer(): void {
    const app = express();

    // Enable CORS for frontend
    app.use((req: Request, res: Response, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") {
            res.sendStatus(200);
            return;
        }
        next();
    });

    app.get("/health", (req: Request, res: Response) => {
        res.json({
            status: "ok",
            uptime: process.uptime(),
            lastRunTime: state.lastRunTime ? new Date(state.lastRunTime).toISOString() : null,
            lastRunSuccess: state.lastRunSuccess,
            runCount: state.runCount,
            errorCount: state.errorCount,
            isRunning: state.isRunning,
            config: {
                assetId: config.assetId,
                cronSchedule: config.cronSchedule,
                epochDuration: config.epochDurationSeconds,
            },
        });
    });

    app.post("/trigger", async (req: Request, res: Response) => {
        logger.info("Manual trigger received");
        const success = await runEpochRoll();
        res.json({ success, message: success ? "Epoch roll completed" : "Epoch roll failed" });
    });

    // Manual settlement endpoint for demo
    app.post("/settle", async (req: Request, res: Response) => {
        logger.info("Manual settlement trigger received");

        if (!state.onchainClient) {
            res.json({ success: false, message: "On-chain client not initialized" });
            return;
        }

        try {
            // Fetch current oracle price for ITM/OTM determination
            const oraclePriceData = await fetchOraclePrice();
            if (!oraclePriceData) {
                throw new Error("Failed to fetch oracle price for settlement");
            }
            const currentPrice = oraclePriceData.price;
            logger.info("Settlement price check", {
                currentPrice,
                strikePrice: state.epochStrikePrice
            });

            // Determine if option is ITM (for CALL: spot > strike)
            const isITM = currentPrice > state.epochStrikePrice;
            let payoffAmount = BigInt(0);
            let settlementType = "OTM";

            if (isITM && state.epochNotional > 0 && state.epochStrikePrice > 0) {
                // Calculate payoff: (spot - strike) / strike * notional (in USDC terms)
                const priceGain = currentPrice - state.epochStrikePrice;
                const payoffRatio = priceGain / state.epochStrikePrice;
                payoffAmount = BigInt(Math.floor(Number(state.epochNotional) * payoffRatio));
                settlementType = "ITM";

                logger.info("ITM settlement calculated", {
                    priceGain,
                    payoffRatio,
                    payoffAmount: payoffAmount.toString()
                });

                // Transfer payoff from vault escrow to MM (keeper)
                if (payoffAmount > 0) {
                    try {
                        const vaultUsdcAccount = await state.onchainClient.getOrCreateVaultUsdcAccount(config.assetId);
                        const payoffTx = await state.onchainClient.transferPayoff(vaultUsdcAccount, payoffAmount);
                        logger.info("ITM payoff transferred to MM", { tx: payoffTx, amount: payoffAmount.toString() });
                    } catch (payoffError) {
                        logger.error("Payoff transfer failed", { error: payoffError });
                        // Continue with settlement even if payoff fails
                    }
                }
            } else {
                logger.info("OTM settlement - vault keeps premium");
            }

            // Use actual premium earned from epoch roll
            const premiumToSettle = state.epochPremiumEarned > 0
                ? state.epochPremiumEarned
                : BigInt(1_000_000); // Fallback: 1 token minimum

            // Advance epoch on-chain
            const tx = await state.onchainClient.advanceEpoch(
                config.assetId,
                premiumToSettle
            );

            logger.info("Settlement completed", { tx, settlementType });

            // Save values before reset for response
            const settlementStrike = state.epochStrikePrice;

            // Reset epoch tracking for next epoch
            state.epochPremiumEarned = BigInt(0);
            state.epochStrikePrice = 0;
            state.epochNotional = BigInt(0);

            const netGain = settlementType === "OTM"
                ? Number(premiumToSettle) / 1e6
                : Number(premiumToSettle - payoffAmount) / 1e6;

            res.json({
                success: true,
                message: `${settlementType} Settlement - ${settlementType === "OTM" ? "Vault keeps" : "Net"}: ${netGain.toFixed(2)} tokens`,
                settlementType,
                currentPrice,
                strikePrice: settlementStrike,
                premiumEarned: Number(premiumToSettle) / 1e6,
                payoffPaid: Number(payoffAmount) / 1e6,
                txSignature: tx
            });
        } catch (error: any) {
            logger.error("Settlement failed", { error });
            res.json({
                success: false,
                message: error.message || "Settlement failed"
            });
        }
    });

    app.listen(config.healthPort, () => {
        logger.info(`Health server listening on port ${config.healthPort}`);
    });
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    logger.info("========================================");
    logger.info("xStock Keeper Service Starting");
    logger.info("========================================");
    logger.info("Configuration", {
        assetId: config.assetId,
        cronSchedule: config.cronSchedule,
        epochDuration: `${config.epochDurationSeconds}s`,
        quoteWait: `${config.quoteWaitMs}ms`,
        strikeDelta: `${config.strikeDeltaBps}bps`,
    });

    // Initialize connection
    state.connection = new Connection(config.rpcUrl, "confirmed");

    // Load wallet and initialize on-chain client
    try {
        state.wallet = loadWallet();
        logger.info("Wallet loaded", { pubkey: state.wallet.publicKey.toBase58() });

        // Initialize on-chain client
        state.onchainClient = new OnChainClient(state.connection, state.wallet);

        // Optionally load IDLs for full Anchor support
        const vaultIdlPath = path.join(__dirname, "../../..", "target/idl/vault.json");
        const rfqIdlPath = path.join(__dirname, "../../..", "target/idl/rfq.json");
        await state.onchainClient.initializeWithIdl(vaultIdlPath, rfqIdlPath);
        logger.info("On-chain client initialized");
    } catch (error) {
        logger.warn("No keeper keypair found, running in read-only mode", { error });
    }

    // Start health server
    startHealthServer();

    // Schedule cron job
    logger.info(`Scheduling epoch rolls: ${config.cronSchedule}`);
    cron.schedule(config.cronSchedule, async () => {
        logger.info("Cron triggered epoch roll");
        await runEpochRoll();
    });

    // Run immediately on start if --run-now flag
    if (process.argv.includes("--run-now")) {
        logger.info("Running epoch roll immediately (--run-now)");
        await runEpochRoll();
    }

    logger.info("Keeper service ready");
    logger.info("========================================");
}

main().catch((error) => {
    logger.error("Fatal error", { error });
    process.exit(1);
});

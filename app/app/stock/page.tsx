"use client";

import { useState, useEffect, useRef } from "react";
import { init, dispose, Chart, LineType, PolygonType } from 'klinecharts';
import bs58 from "bs58";
import toast from "react-hot-toast";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram } from "../../anchor/setup";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { XSTOCKS, QUOTE_MINT } from "../../utils/constants";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import PositionCard from "./components/PositionCard";
import HistoryTable from "./components/HistoryTable";
import { StockData, PricePoint, ChartInterval } from "../../types/stock";

// ═══════════════════════════════════════════════════════════════════
// TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════════
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {show && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1b20] border border-[#3f3f46] rounded-lg text-xs text-[#f5f5f5] whitespace-nowrap shadow-xl">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1b20]" />
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// RANGE BAR COMPONENT (52W Range Visual) - Compact
// ═══════════════════════════════════════════════════════════════════
function RangeBar({ low, high, current }: { low: number; high: number; current: number }) {
    const range = high - low || 1;
    const position = Math.min(100, Math.max(0, ((current - low) / range) * 100));
    
    return (
        <div className="space-y-1">
            <div className="relative h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30" />
                <div 
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-orange-500 rounded-full border border-white shadow transition-all duration-300"
                    style={{ left: `calc(${position}% - 4px)` }}
                />
            </div>
            <div className="flex justify-between text-[9px]">
                <span className="text-[rgba(255,255,255,0.4)]">${low.toFixed(0)}</span>
                <span className="text-[#f5f5f5] font-medium">${current.toFixed(2)}</span>
                <span className="text-[rgba(255,255,255,0.4)]">${high.toFixed(0)}</span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MARKET DEPTH BAR COMPONENT - Compact
// ═══════════════════════════════════════════════════════════════════
function MarketDepthBar({ bidPercent = 63 }: { bidPercent?: number }) {
    const askPercent = 100 - bidPercent;
    return (
        <div className="space-y-1">
            <div className="flex h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#3DD68C] transition-all duration-500" style={{ width: `${bidPercent}%` }} />
                <div className="bg-[#FF5C5C] transition-all duration-500" style={{ width: `${askPercent}%` }} />
            </div>
            <div className="flex justify-between text-[9px]">
                <span className="text-[#3DD68C]">Bids {bidPercent}%</span>
                <span className="text-[#FF5C5C]">Asks {askPercent}%</span>
            </div>
        </div>
    );
}

export default function StockPage() {
    const router = useRouter();
    const { connection } = useConnection();
    const wallet = useWallet();

    // Stock state
    const stock = XSTOCKS[0]; // Mock xStock
    const [stockData, setStockData] = useState<StockData | null>(null);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
    const [chartInterval, setChartInterval] = useState<ChartInterval>("1D");
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

    // Market state
    const [userPositions, setUserPositions] = useState<any[]>([]);
    const [underlyingBalance, setUnderlyingBalance] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'about'>('active');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingPositions, setIsLoadingPositions] = useState(true);
    
    // Polling interval (in milliseconds) - default 1 minute to reduce API load
    const [pollInterval, setPollInterval] = useState<number>(60000);
    const POLL_OPTIONS = [
        { label: '15s', value: 15000 },
        { label: '30s', value: 30000 },
        { label: '1m', value: 60000 },
        { label: '2m', value: 120000 },
        { label: '5m', value: 300000 },
    ];

    // Filter positions
    const activePositions = userPositions.filter(pos => {
        const isBuyer = pos.account.buyer?.toString() === wallet.publicKey?.toString();
        const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
        const hasBuyer = pos.account.buyer !== null;
        const isExercised = pos.account.exercised;
        const isExpired = new Date() > new Date(pos.account.expiryTs.toNumber() * 1000);

        // You own the position if:
        // 1. You're the buyer (you bought it) - can exercise anytime before expiry (American-style)
        // 2. You're the seller AND there's no buyer (you wrote it but haven't sold it) - can reclaim after expiry
        if (isBuyer) {
            // Buyers: show if not exercised and not expired (can exercise anytime before expiry)
            return !isExercised && !isExpired;
        } else if (isSeller && !hasBuyer) {
            // Sellers who haven't sold: show if not exercised (can reclaim after expiry)
            return !isExercised;
        } else {
            // You're the seller but someone else bought it - you don't own this position
            return false;
        }
    });

    // Show ALL positions in history (including open ones) for complete trade history
    const historyPositions = userPositions;

    useEffect(() => {
        if (wallet.publicKey) {
            setPriceHistory([]);
            fetchPrice();
            fetchUserPositions();
            fetchUnderlyingBalance();
            
            const interval = setInterval(() => {
                fetchPrice();
                fetchUnderlyingBalance();
                fetchUserPositions();
            }, pollInterval);
            return () => clearInterval(interval);
        }
    }, [wallet.publicKey, pollInterval, chartInterval]);

    const fetchUnderlyingBalance = async () => {
        if (!wallet.publicKey) return;
        try {
            const ata = PublicKey.findProgramAddressSync(
                [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), stock.mint.toBuffer()],
                new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
            )[0];

            const balance = await connection.getTokenAccountBalance(ata, 'processed');
            setUnderlyingBalance(balance.value.uiAmount || 0);
        } catch (e) {
            setUnderlyingBalance(0);
        }
    };

    const fetchPrice = async () => {
        try {
            // Use priceMint for Bitquery (real mainnet price), fallback to mint
            const priceMint = stock.priceMint || stock.mint;
            const params = new URLSearchParams({
                mint: priceMint.toBase58(),
                symbol: stock.symbol,
                name: stock.name,
                interval: chartInterval, // Pass chart interval for historical data range
            });
            const res = await fetch(`/api/price?${params}`);
            const data: StockData = await res.json();

            if (data.error) {
                console.error("Price API error:", data.error);
                return;
            }

            setStockData(data);
            setLastUpdateTime(new Date());

            setPriceHistory(prev => {
                const newPoint: PricePoint = { 
                    timestamp: Date.now(), 
                    price: data.currentPrice,
                    ohlc: data.ohlc
                };
                const newHistory = [...prev, newPoint];
                return newHistory.slice(-500);
            });
        } catch (err) {
            console.error("Failed to fetch price:", err);
        }
    };

    const fetchUserPositions = async () => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            // @ts-ignore
            const accountClient = program.account.coveredCall || program.account.CoveredCall;
            if (!accountClient) {
                console.error("Could not find coveredCall or CoveredCall in program.account");
                setIsLoadingPositions(false);
                return;
            }
            const memcmpResult = accountClient.coder.accounts.memcmp("coveredCall");
            const discriminator = memcmpResult.bytes ? memcmpResult.bytes : memcmpResult;
            const discriminatorEncoded = typeof discriminator === 'string' ? discriminator : bs58.encode(discriminator);

            const accounts = await connection.getProgramAccounts(program.programId, {
                filters: [
                    {
                        memcmp: {
                            offset: 0,
                            bytes: discriminatorEncoded
                        }
                    }
                ]
            });

            const allCalls = accounts.map(acc => {
                try {
                    if (acc.account.data.length < 173) {
                        return null;
                    }
                    return {
                        publicKey: acc.pubkey,
                        account: accountClient.coder.accounts.decode("coveredCall", acc.account.data)
                    };
                } catch (e) {
                    return null;
                }
            }).filter(a => a !== null);

            // Filter to only show positions for the current stock's mint that belong to the user
            const positions = allCalls.filter((a: any) =>
                a.account.xstockMint.toString() === stock.mint.toString() &&
                (a.account.seller.toString() === wallet.publicKey?.toString() ||
                 a.account.buyer?.toString() === wallet.publicKey?.toString())
            );

            setUserPositions(positions);
        } catch (e) {
            console.error("Error fetching positions:", e);
        } finally {
            setIsLoadingPositions(false);
        }
    };

    const handleExercise = async (position: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const coveredCall = position.publicKey;

            // Calculate required amounts
            const strike = position.account.strike.toNumber() / 100_000_000; // Strike per share
            const amount = position.account.amount.toNumber() / 1_000_000; // Amount in shares (with 6 decimals)
            const contracts = amount / 100; // Each contract is 100 shares
            const totalStrikeNeeded = strike * amount; // Total USDC needed (strike × shares)

            // Check SOL balance for transaction fees (need at least 0.001 SOL)
            const solBalance = await connection.getBalance(wallet.publicKey);
            const minSolRequired = 0.001 * 1e9; // 0.001 SOL in lamports
            if (solBalance < minSolRequired) {
                toast.error(`Insufficient SOL for transaction fees. You need at least 0.001 SOL (you have ${(solBalance / 1e9).toFixed(4)} SOL)`);
                return;
            }

            // Check USDC balance
            const buyerQuoteAccount = getAta(QUOTE_MINT, wallet.publicKey);
            let usdcBalance = 0;
            try {
                const buyerQuoteAccountInfo = await connection.getAccountInfo(buyerQuoteAccount);
                if (buyerQuoteAccountInfo) {
                    const balanceData = await connection.getTokenAccountBalance(buyerQuoteAccount);
                    usdcBalance = balanceData.value.uiAmount || 0;
                }
            } catch (e) {
                // Account doesn't exist yet, balance is 0
            }

            if (usdcBalance < totalStrikeNeeded) {
                toast.error(
                    `Insufficient USDC to exercise. You need ${totalStrikeNeeded.toFixed(2)} USDC (strike $${strike.toFixed(2)} × ${amount.toFixed(0)} shares), but you have ${usdcBalance.toFixed(2)} USDC.`
                );
                return;
            }

            const buyerUnderlyingAccount = getAta(stock.mint, wallet.publicKey);
            const sellerQuoteAccount = getAta(QUOTE_MINT, position.account.seller);
            const vaultAccount = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCall.toBuffer()],
                program.programId
            )[0];

            // Check and create token accounts if they don't exist
            const tx = new Transaction();

            // Check buyer's USDC account (needed to pay strike price)
            const buyerQuoteAccountInfo = await connection.getAccountInfo(buyerQuoteAccount);
            if (!buyerQuoteAccountInfo) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        buyerQuoteAccount,
                        wallet.publicKey,
                        QUOTE_MINT
                    )
                );
            }

            // Check buyer's xStock account (needed to receive the underlying)
            const buyerUnderlyingAccountInfo = await connection.getAccountInfo(buyerUnderlyingAccount);
            if (!buyerUnderlyingAccountInfo) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        buyerUnderlyingAccount,
                        wallet.publicKey,
                        stock.mint
                    )
                );
            }

            // Check seller's USDC account (needed to receive strike payment)
            const sellerQuoteAccountInfo = await connection.getAccountInfo(sellerQuoteAccount);
            if (!sellerQuoteAccountInfo) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        sellerQuoteAccount,
                        position.account.seller,
                        QUOTE_MINT
                    )
                );
            }

            const ix = await program.methods
                .exercise()
                .accounts({
                    coveredCall: coveredCall,
                    buyer: wallet.publicKey,
                    buyerXstockAccount: buyerUnderlyingAccount,
                    buyerQuoteAccount: buyerQuoteAccount,
                    sellerQuoteAccount: sellerQuoteAccount,
                    vaultAccount: vaultAccount,
                    xstockMint: stock.mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            const forceMutable = [coveredCall, vaultAccount, buyerUnderlyingAccount, buyerQuoteAccount, sellerQuoteAccount];
            forceMutable.forEach(pubkey => {
                const index = ix.keys.findIndex((k: any) => k.pubkey.equals(pubkey));
                if (index >= 0) {
                    ix.keys[index].isWritable = true;
                }
            });

            tx.add(ix);

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            if (!wallet.signTransaction) return;
            const signed = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(sig);

            fetchUserPositions();
            fetchUnderlyingBalance();
            toast.success("Option Exercised Successfully!");
        } catch (e) {
            console.error("Exercise failed:", e);
            toast.error("Exercise failed. See console for details.");
        }
    };

    const handleReclaim = async (position: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const coveredCall = position.publicKey;

            const sellerUnderlyingAccount = getAta(stock.mint, wallet.publicKey);
            const vaultAccount = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCall.toBuffer()],
                program.programId
            )[0];

            const ix = await program.methods
                .reclaim()
                .accounts({
                    seller: wallet.publicKey,
                    coveredCall: coveredCall,
                    vaultAccount: vaultAccount,
                    sellerXstockAccount: sellerUnderlyingAccount,
                    xstockMint: stock.mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            const mutableAccounts = [coveredCall, vaultAccount, sellerUnderlyingAccount];

            mutableAccounts.forEach(pubkey => {
                const index = ix.keys.findIndex(k => k.pubkey.toBase58() === pubkey.toBase58());
                if (index >= 0) {
                    ix.keys[index].isWritable = true;
                }
            });

            const tx = new Transaction().add(ix);

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            if (!wallet.signTransaction) return;
            const signed = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signed.serialize());
            await connection.confirmTransaction(sig);

            fetchUserPositions();
            fetchUnderlyingBalance();
            toast.success("Position Reclaimed Successfully!");
        } catch (e) {
            console.error("Reclaim failed:", e);
            toast.error("Reclaim failed. See console for details.");
        }
    };

    const handleListForSale = async (position: any, price: number) => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setIsProcessing(true);
        try {
            const program = getProgram(connection, wallet);
            const ix = await program.methods
                .listForSale(new BN(price * 1_000_000))
                .accounts({
                    signer: wallet.publicKey,
                    coveredCall: position.publicKey,
                })
                .instruction();

            const tx = new Transaction().add(ix);
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const signedTx = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig);
            toast.success("Option listed for sale!");
            fetchUserPositions();
        } catch (err) {
            console.error(err);
            toast.error("Error listing option: " + (err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelListing = async (position: any) => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setIsProcessing(true);
        try {
            const program = getProgram(connection, wallet);
            const ix = await program.methods
                .cancelListing()
                .accounts({
                    signer: wallet.publicKey,
                    coveredCall: position.publicKey,
                })
                .instruction();

            const tx = new Transaction().add(ix);
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const signedTx = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig);
            toast.success("Listing cancelled!");
            fetchUserPositions();
        } catch (err) {
            console.error(err);
            toast.error("Error cancelling listing: " + (err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const getAta = (mint: PublicKey, owner: PublicKey) => {
        return PublicKey.findProgramAddressSync(
            [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0];
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
        if (vol >= 1) return `$${vol.toFixed(2)}`;
        return `$${vol.toFixed(2)}`;
    };

    // Helper for sentiment numerical value
    const getSentimentValue = (sentiment: string) => {
        if (sentiment === 'Bullish') return 72;
        if (sentiment === 'Bearish') return 28;
        return 49;
    };

    // Helper for volatility numerical value
    const getVolatilityValue = (volatility: string) => {
        if (volatility === 'High') return 0.45;
        if (volatility === 'Medium') return 0.25;
        return 0.12;
    };

    // Calculate holding value
    const holdingValue = underlyingBalance * (stockData?.currentPrice || 0);

    if (!wallet.publicKey) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-[rgba(255,255,255,0.5)]">Connect your wallet to trade {stock.symbol}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full p-6 space-y-3">
            {/* Back Button */}
            <button onClick={() => router.push('/')} className="text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5] w-fit text-xs flex items-center gap-1.5 hover:gap-2 transition-all">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Markets
            </button>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* HEADER SECTION */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="space-y-1">
                {/* Symbol and Name Row */}
                <div className="flex items-center gap-3">
                    {stock.logo && (
                        <img src={stock.logo} alt={stock.name} className="w-10 h-10 rounded-full" />
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-[#f5f5f5]">{stock.symbol}</h1>
                        <p className="text-[rgba(255,255,255,0.5)] text-xs">{stock.name}</p>
                    </div>
                </div>

                {/* Price Row */}
                {stockData && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-[#f5f5f5]">
                                {stockData.currentPrice.toFixed(2)}
                            </span>
                            <span className="text-sm text-[rgba(255,255,255,0.5)]">USDC</span>
                            <span className={`text-sm font-semibold ${stockData.priceChange >= 0 ? 'text-[#3DD68C]' : 'text-[#FF5C5C]'}`}>
                                {stockData.priceChange >= 0 ? '+' : ''}{stockData.priceChange.toFixed(2)} ({stockData.priceChangePct >= 0 ? '+' : ''}{stockData.priceChangePct.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MARKET STATS ROW - Compact */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {stockData && (
                <div className="grid grid-cols-5 gap-2">
                    {/* Performance Block */}
                    <Tooltip text="Performance metrics across different time periods">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 h-[72px] hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">PERFORMANCE</p>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[rgba(255,255,255,0.4)]">1D</span>
                                    <span className={`font-semibold ${stockData.performance["1d"] >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {stockData.performance["1d"] >= 0 ? "+" : ""}{stockData.performance["1d"].toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[rgba(255,255,255,0.4)]">1W</span>
                                    <span className={`font-semibold ${stockData.performance["1w"] >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {stockData.performance["1w"] >= 0 ? "+" : ""}{stockData.performance["1w"].toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[rgba(255,255,255,0.4)]">1M</span>
                                    <span className={`font-semibold ${stockData.performance["1m"] >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {stockData.performance["1m"] >= 0 ? "+" : ""}{stockData.performance["1m"].toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[rgba(255,255,255,0.4)]">YTD</span>
                                    <span className={`font-semibold ${stockData.performance["ytd"] >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {stockData.performance["ytd"] >= 0 ? "+" : ""}{stockData.performance["ytd"].toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Tooltip>

                    {/* Volume Block */}
                    <Tooltip text="Total trading volume in the past 24 hours">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 h-[72px] hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Volume (24h)</p>
                            <p className="text-lg font-bold text-[#f5f5f5]">{formatVolume(stockData.volume)}</p>
                        </div>
                    </Tooltip>

                    {/* 52w Range Block */}
                    <Tooltip text="52-week price range with current position">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 h-[72px] hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">52w Range</p>
                            <RangeBar 
                                low={stockData["52wLow"]} 
                                high={stockData["52wHigh"]} 
                                current={stockData.currentPrice} 
                            />
                        </div>
                    </Tooltip>

                    {/* Market Cap Block */}
                    <Tooltip text="Total market capitalization and circulating supply">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 h-[72px] hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Market Cap</p>
                            <p className="text-lg font-bold text-[#f5f5f5]">{stockData.marketCap ? `$${formatVolume(stockData.marketCap)}` : '—'}</p>
                        </div>
                    </Tooltip>

                    {/* Sentiment Block */}
                    <Tooltip text="Based on aggregated tick-level microstructure signals">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 h-[72px] hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Sentiment</p>
                            <p className={`text-sm font-bold ${
                                stockData.sentiment === 'Bullish' ? 'text-[#3DD68C]' : 
                                stockData.sentiment === 'Bearish' ? 'text-[#FF5C5C]' : 'text-yellow-500'
                            }`}>
                                {stockData.sentiment} <span className="text-xs font-normal">({getSentimentValue(stockData.sentiment)}%)</span>
                            </p>
                        </div>
                    </Tooltip>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* CHART + TRADING SIDEBAR - Two Column Layout */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
                {/* LEFT COLUMN: Chart */}
                <div className="flex flex-col">
                    {stockData ? (
                        <>
                            {/* Chart Container - flex-1 to fill available height */}
                            <div className="w-full flex-1 min-h-[400px] bg-[#131722] rounded-lg border border-[#27272a] overflow-hidden">
                                <ChartComponent priceHistory={priceHistory} historicalCandles={stockData.historicalCandles} />
                            </div>
                            
                            {/* Controls below chart: Interval on left, Info on right */}
                            <div className="flex items-center justify-between mt-2">
                                {/* Interval Selector */}
                                <div className="flex items-center gap-1">
                                    {(["1H", "4H", "1D", "1W", "1M", "MAX"] as ChartInterval[]).map((interval) => (
                                        <button
                                            key={interval}
                                            onClick={() => setChartInterval(interval)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                chartInterval === interval 
                                                    ? 'bg-orange-500 text-white' 
                                                    : 'bg-[#27272a] text-[rgba(255,255,255,0.5)] hover:bg-[#3f3f46]'
                                            }`}
                                        >
                                            {interval}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Right side: Refresh/Live + Exchange/Oracle/Time info */}
                                <div className="flex flex-col items-end gap-1">
                                    {/* Refresh & Live indicator */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-[rgba(255,255,255,0.4)]">Refresh:</span>
                                            <select 
                                                value={pollInterval}
                                                onChange={(e) => setPollInterval(Number(e.target.value))}
                                                className="bg-[#27272a] text-[10px] text-[#f5f5f5] px-1.5 py-1 rounded border border-[#3f3f46] cursor-pointer hover:bg-[#3f3f46] transition-colors focus:outline-none"
                                            >
                                                {POLL_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <span className="bg-green-500/20 text-green-500 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                            LIVE
                                        </span>
                                    </div>
                                    {/* Exchange/Oracle/Time info */}
                                    <div className="flex items-center gap-2 text-[10px] text-[rgba(255,255,255,0.4)]">
                                        <span>{stockData.dex || 'DEX'}</span>
                                        <span className="text-[#3f3f46]">•</span>
                                        <span>{stockData.source === 'bitquery' ? 'Bitquery' : 'Internal'}</span>
                                        <span className="text-[#3f3f46]">•</span>
                                        <span>{lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}</span>
                                        {stockData.stale && <span className="text-yellow-500 ml-1">⚠</span>}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center flex-1 min-h-[400px] bg-[#0f1015] rounded-lg border border-[#27272a]">
                            <div className="text-center space-y-2">
                                <div className="animate-spin w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                                <p className="text-[rgba(255,255,255,0.5)] text-sm">Loading chart...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Trading Sidebar */}
                <div className="flex flex-col gap-3">
                    {stockData ? (
                        <>
                            {/* Orderbook Card */}
                            <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-medium">Orderbook</p>
                                    <span className="text-[10px] text-[rgba(255,255,255,0.4)]">Spread: ${stockData.spread.toFixed(2)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <p className="text-[10px] text-[rgba(255,255,255,0.4)] mb-1">Bid</p>
                                        <p className="text-xl font-bold text-[#3DD68C]">${stockData.bid.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[rgba(255,255,255,0.4)] mb-1">Ask</p>
                                        <p className="text-xl font-bold text-[#FF5C5C]">${stockData.ask.toFixed(2)}</p>
                                    </div>
                                </div>
                                <MarketDepthBar bidPercent={stockData.priceChange >= 0 ? 58 : 42} />
                            </div>

                            {/* Performance Card - flex-1 to fill space */}
                            {/* <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-4 flex-1">
                                <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-medium mb-3">Performance</p>
                                <div className="space-y-2">
                                    {Object.entries(stockData.performance).map(([period, value]) => (
                                        <div key={period} className="flex justify-between items-center">
                                            <span className="text-xs text-[rgba(255,255,255,0.5)] uppercase">{period}</span>
                                            <span className={`text-sm font-bold ${value >= 0 ? 'text-[#3DD68C]' : 'text-[#FF5C5C]'}`}>
                                                {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div> */}

                            {/* Trade Actions */}
                            <div className="space-y-2">
                                <button
                                    disabled
                                    className="w-full bg-gradient-to-r from-[#3DD68C] to-[#2fb377] text-white text-base font-bold py-3 rounded-lg opacity-90 cursor-not-allowed"
                                >
                                    Buy {stock.symbol}
                                </button>
                                <button
                                    disabled
                                    className="w-full bg-[#27272a] text-[#f5f5f5] text-base font-bold py-3 rounded-lg opacity-90 cursor-not-allowed"
                                >
                                    Sell {stock.symbol}
                                </button>
                                <button
                                    onClick={() => router.push('/stock/chain')}
                                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-base font-bold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                                >
                                    Trade Options →
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Loading skeleton */}
                            <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-4 h-[140px] animate-pulse" />
                            <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-4 flex-1 min-h-[120px] animate-pulse" />
                            <div className="space-y-2">
                                <div className="bg-[#27272a] h-12 rounded-lg animate-pulse" />
                                <div className="bg-[#27272a] h-12 rounded-lg animate-pulse" />
                                <div className="bg-[#27272a] h-12 rounded-lg animate-pulse" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* POSITION SECTION */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="mt-4">
                {/* Tab Bar */}
                <div className="flex items-center gap-4 border-b border-[#27272a] mb-4">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'active' ? 'text-[#f5f5f5]' : 'text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5]'}`}
                    >
                        Active Positions
                        {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'text-[#f5f5f5]' : 'text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5]'}`}
                    >
                        Trade History
                        {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('about')}
                        className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'about' ? 'text-[#f5f5f5]' : 'text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5]'}`}
                    >
                        About {stock.symbol}
                        {activeTab === 'about' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'active' && (
                    <div className="space-y-4">
                        {/* Holdings Card */}
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider font-medium mb-1">
                                        {stock.symbol} Holdings
                                    </p>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-2xl font-bold text-[#f5f5f5]">
                                            {underlyingBalance.toLocaleString()}
                                        </span>
                                        <span className="text-sm text-[rgba(255,255,255,0.5)]">shares</span>
                                    </div>
                                </div>
                                {underlyingBalance > 0 && stockData && (
                                    <div className="text-right">
                                        <p className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Value</p>
                                        <p className="text-xl font-bold text-[#3DD68C]">${holdingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Positions */}
                        {isLoadingPositions ? (
                            <div className="text-center py-16 bg-[#0f1015] rounded-xl border border-[#27272a]">
                                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-[rgba(255,255,255,0.5)]">Loading positions...</p>
                            </div>
                        ) : activePositions.length > 0 ? (
                            <div className="space-y-4 overflow-x-auto">
                                {activePositions.map((pos) => {
                                    // Determine if user is seller or buyer
                                    // - If you're the buyer, you can exercise (American-style)
                                    // - If you're the seller AND there's no buyer, you can reclaim after expiry
                                    // - If you're the seller AND there's a buyer, you can't do anything (buyer owns it)
                                    const isBuyer = pos.account.buyer?.toString() === wallet.publicKey?.toString();
                                    const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString() && !isBuyer;
                                    const hasBuyer = pos.account.buyer !== null;
                                    
                                    // If you're the seller but there's a buyer, you don't own this position anymore
                                    const actualIsSeller = isSeller && !hasBuyer;
                                    
                                    return (
                                        <PositionCard
                                            key={pos.publicKey.toString()}
                                            position={pos}
                                            currentPrice={stockData?.currentPrice || 0}
                                            isSeller={actualIsSeller}
                                            symbol={stock.symbol}
                                            onExercise={() => handleExercise(pos)}
                                            onReclaim={() => handleReclaim(pos)}
                                            onListForSale={(price) => handleListForSale(pos, price)}
                                            onCancelListing={() => handleCancelListing(pos)}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-[#0f1015] rounded-xl border border-[#27272a]">
                                <p className="text-[rgba(255,255,255,0.5)] text-sm mb-4">No active option positions</p>
                                <button
                                    onClick={() => router.push('/stock/chain')}
                                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
                                >
                                    Trade Options
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <HistoryTable positions={historyPositions} walletPublicKey={wallet.publicKey?.toString() || ""} />
                )}

                {activeTab === 'about' && (
                    <div className="bg-[#0f1015] rounded-xl border border-[#27272a] p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-[#f5f5f5]">Asset Information</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Symbol</span>
                                        <span className="text-[#f5f5f5] font-medium">{stock.symbol}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Name</span>
                                        <span className="text-[#f5f5f5] font-medium">{stock.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Mint Address</span>
                                        <span className="text-[#f5f5f5] font-mono text-xs">{stock.mint.toBase58().slice(0, 8)}...{stock.mint.toBase58().slice(-8)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Options Available</span>
                                        <span className="text-[#3DD68C] font-medium">Yes</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-[#f5f5f5]">Oracle Information</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Price Source</span>
                                        <span className="text-[#f5f5f5] font-medium">{stockData?.source === 'bitquery' ? 'Bitquery API' : 'Internal Oracle'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Update Frequency</span>
                                        <span className="text-[#f5f5f5] font-medium">~{pollInterval / 1000} seconds</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Network</span>
                                        <span className="text-[#f5f5f5] font-medium">Solana Mainnet</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[rgba(255,255,255,0.5)]">Quote Currency</span>
                                        <span className="text-[#f5f5f5] font-medium">USDC</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-[#27272a]">
                            <p className="text-sm text-[rgba(255,255,255,0.5)]">
                                {stock.symbol} is a synthetic asset representing tokenized equity on the Solana blockchain. 
                                Options trading is available through covered call contracts with USDC settlement.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface HistoricalCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

function ChartComponent({ priceHistory, historicalCandles }: { priceHistory: PricePoint[], historicalCandles?: HistoricalCandle[] }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const lastCandleCount = useRef<number>(0);
    const historicalLoaded = useRef<boolean>(false);
    const lastHistoricalCandlesRef = useRef<HistoricalCandle[] | undefined>(undefined);

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
                        upColor: '#3DD68C',
                        downColor: '#FF5C5C',
                        noChangeColor: '#888888',
                        upBorderColor: '#3DD68C',
                        downBorderColor: '#FF5C5C',
                        noChangeBorderColor: '#888888',
                        upWickColor: '#3DD68C',
                        downWickColor: '#FF5C5C',
                        noChangeWickColor: '#888888'
                    }
                },
                xAxis: {
                    tickText: { color: '#787b86' }
                },
                yAxis: {
                    tickText: { color: '#787b86' }
                },
                // Enable crosshair
                crosshair: {
                    show: true,
                    horizontal: {
                        show: true,
                        line: {
                            show: true,
                            style: LineType.Dashed,
                            dashedValue: [4, 2],
                            size: 1,
                            color: '#787b86'
                        },
                        text: {
                            show: true,
                            style: PolygonType.Fill,
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: LineType.Solid,
                            borderSize: 1,
                            borderColor: '#3f3f46',
                            borderRadius: 4,
                            paddingLeft: 4,
                            paddingRight: 4,
                            paddingTop: 2,
                            paddingBottom: 2,
                            backgroundColor: '#27272a'
                        }
                    },
                    vertical: {
                        show: true,
                        line: {
                            show: true,
                            style: LineType.Dashed,
                            dashedValue: [4, 2],
                            size: 1,
                            color: '#787b86'
                        },
                        text: {
                            show: true,
                            style: PolygonType.Fill,
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: LineType.Solid,
                            borderSize: 1,
                            borderColor: '#3f3f46',
                            borderRadius: 4,
                            paddingLeft: 4,
                            paddingRight: 4,
                            paddingTop: 2,
                            paddingBottom: 2,
                            backgroundColor: '#27272a'
                        }
                    }
                }
            });
        }
        
        return () => {
            if (chartContainerRef.current && chartInstance.current) {
                dispose(chartContainerRef.current);
                chartInstance.current = null;
            }
        };
    }, []);

    // Load historical candles from Bitquery - reload when candles change (e.g., interval change)
    useEffect(() => {
        if (!chartInstance.current) return;
        if (!historicalCandles || historicalCandles.length === 0) return;

        // Check if historical candles have actually changed (different data, not just length)
        const hasChanged = !lastHistoricalCandlesRef.current || 
            lastHistoricalCandlesRef.current.length !== historicalCandles.length ||
            (lastHistoricalCandlesRef.current.length > 0 && historicalCandles.length > 0 &&
             (lastHistoricalCandlesRef.current[0].timestamp !== historicalCandles[0].timestamp ||
              lastHistoricalCandlesRef.current[lastHistoricalCandlesRef.current.length - 1].timestamp !== 
              historicalCandles[historicalCandles.length - 1].timestamp));

        if (hasChanged || !historicalLoaded.current) {
            // @ts-ignore
            chartInstance.current.applyNewData(historicalCandles);
            lastCandleCount.current = historicalCandles.length;
            historicalLoaded.current = true;
            lastHistoricalCandlesRef.current = historicalCandles;
            
            // Calculate bar space to fill the chart width with all candles
            const chartWidth = chartContainerRef.current?.clientWidth || 800;
            const dataCount = historicalCandles.length;
            // Leave some padding (right offset) and calculate space per bar
            const rightOffset = 50;
            const availableWidth = chartWidth - rightOffset;
            // Each bar needs space for the candle + gap between candles
            const barSpace = Math.max(6, Math.min(12, Math.floor(availableWidth / dataCount)));
            
            // @ts-ignore
            chartInstance.current.setBarSpace(barSpace);
            // Scroll to show the most recent data (right side of chart)
            // Use a small delay to ensure chart is fully rendered before scrolling
            setTimeout(() => {
                if (chartInstance.current && historicalCandles.length > 0) {
                    // @ts-ignore
                    chartInstance.current.scrollToDataIndex(historicalCandles.length - 1);
                }
            }, 100);
        }
    }, [historicalCandles]);

    // Update with real-time data
    useEffect(() => {
        if (!chartInstance.current || priceHistory.length === 0) return;
        if (!historicalLoaded.current && (!historicalCandles || historicalCandles.length === 0)) {
            // Fall back to building candles from price history if no historical data
            const interval = 30 * 1000;

            const grouped = new Map<number, PricePoint[]>();
            priceHistory.forEach(p => {
                const bucket = Math.floor(p.timestamp / interval) * interval;
                if (!grouped.has(bucket)) grouped.set(bucket, []);
                grouped.get(bucket)!.push(p);
            });

            const candles: any[] = [];
            const sortedBuckets = Array.from(grouped.keys()).sort((a, b) => a - b);

            sortedBuckets.forEach(time => {
                const points = grouped.get(time)!;
                if (!points || points.length === 0) return;

                let open: number, high: number, low: number, close: number;
                
                if (points.some(p => p.ohlc)) {
                    const ohlcPoints = points.filter(p => p.ohlc);
                    open = ohlcPoints[0]?.ohlc?.open ?? points[0].price;
                    close = ohlcPoints[ohlcPoints.length - 1]?.ohlc?.close ?? points[points.length - 1].price;
                    high = Math.max(...ohlcPoints.map(p => p.ohlc?.high ?? p.price));
                    low = Math.min(...ohlcPoints.map(p => p.ohlc?.low ?? p.price));
                } else {
                    open = points[0].price;
                    close = points[points.length - 1].price;
                    high = Math.max(...points.map(p => p.price));
                    low = Math.min(...points.map(p => p.price));
                }

                candles.push({ 
                    timestamp: time, 
                    open, 
                    high, 
                    low, 
                    close, 
                    volume: points.length * 1000
                });
            });

            if (candles.length === 0) return;

            const isNewCandleAdded = candles.length > lastCandleCount.current;
            
            if (lastCandleCount.current === 0 || isNewCandleAdded) {
                // @ts-ignore
                chartInstance.current.applyNewData(candles);
            } else {
                const lastCandle = candles[candles.length - 1];
                // @ts-ignore
                chartInstance.current.updateData(lastCandle);
            }
            
            lastCandleCount.current = candles.length;
        } else if (historicalLoaded.current && priceHistory.length > 0) {
            // Update the latest candle with real-time data
            const latest = priceHistory[priceHistory.length - 1];
            if (latest.ohlc) {
                const updateCandle = {
                    timestamp: Math.floor(latest.timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000),
                    open: latest.ohlc.open,
                    high: latest.ohlc.high,
                    low: latest.ohlc.low,
                    close: latest.ohlc.close,
                    volume: 1000
                };
                // @ts-ignore
                chartInstance.current.updateData(updateCandle);
            }
        }

    }, [priceHistory, historicalCandles]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}

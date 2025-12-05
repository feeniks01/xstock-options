"use client";

import { useState, useEffect, useRef } from "react";
import { init, dispose, Chart } from 'klinecharts';
import bs58 from "bs58";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram } from "../../anchor/setup";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { XSTOCKS, QUOTE_MINT } from "../../utils/constants";
import { useRouter } from "next/navigation";

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
// MINI SPARKLINE COMPONENT (with animation) - Compact
// ═══════════════════════════════════════════════════════════════════
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
    const [animate, setAnimate] = useState(false);
    
    useEffect(() => {
        setAnimate(false);
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
    }, [data]);
    
    if (!data || data.length < 2) return null;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 60;
    const height = 20;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');
    
    const color = positive ? '#3DD68C' : '#FF5C5C';
    
    return (
        <svg width={width} height={height} className="ml-2">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                style={{
                    opacity: animate ? 1 : 0.3,
                    transition: 'opacity 0.2s ease-out, stroke 0.2s ease-out',
                }}
            />
        </svg>
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
    const [showPriceAlert, setShowPriceAlert] = useState(false);

    // Market state
    const [userPositions, setUserPositions] = useState<any[]>([]);
    const [underlyingBalance, setUnderlyingBalance] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'about'>('active');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Polling interval (in milliseconds)
    const [pollInterval, setPollInterval] = useState<number>(10000);
    const POLL_OPTIONS = [
        { label: '5s', value: 5000 },
        { label: '15s', value: 15000 },
        { label: '30s', value: 30000 },
        { label: '1m', value: 60000 },
        { label: '5m', value: 300000 },
    ];

    // Filter positions
    const activePositions = userPositions.filter(pos => {
        const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
        const isExercised = pos.account.exercised;
        const isExpired = new Date() > new Date(pos.account.expiryTs.toNumber() * 1000);

        if (isSeller) {
            return !isExercised;
        } else {
            return !isExercised && !isExpired;
        }
    });

    const historyPositions = userPositions.filter(pos => {
        const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
        const isExercised = pos.account.exercised;
        const isExpired = new Date() > new Date(pos.account.expiryTs.toNumber() * 1000);

        if (isSeller) {
            return isExercised;
        } else {
            return isExercised || isExpired;
        }
    });

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

            const positions = allCalls.filter((a: any) =>
                a.account.seller.toString() === wallet.publicKey?.toString() ||
                a.account.buyer?.toString() === wallet.publicKey?.toString()
            );

            setUserPositions(positions);
        } catch (e) {
            console.error("Error fetching positions:", e);
        }
    };

    const handleExercise = async (position: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const coveredCall = position.publicKey;

            const buyerUnderlyingAccount = getAta(stock.mint, wallet.publicKey);
            const buyerQuoteAccount = getAta(QUOTE_MINT, wallet.publicKey);
            const sellerQuoteAccount = getAta(QUOTE_MINT, position.account.seller);
            const vaultAccount = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCall.toBuffer()],
                program.programId
            )[0];

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
            alert("Option Exercised Successfully!");
        } catch (e) {
            console.error("Exercise failed:", e);
            alert("Exercise failed. See console.");
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
            alert("Position Reclaimed Successfully!");
        } catch (e) {
            console.error("Reclaim failed:", e);
            alert("Reclaim failed. See console.");
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
                    seller: wallet.publicKey,
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
            alert("Option listed for sale!");
            fetchUserPositions();
        } catch (err) {
            console.error(err);
            alert("Error listing option: " + (err as Error).message);
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
                    seller: wallet.publicKey,
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
            alert("Listing cancelled!");
            fetchUserPositions();
        } catch (err) {
            console.error(err);
            alert("Error cancelling listing: " + (err as Error).message);
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
        <div className="w-full px-6 space-y-3">
            {/* Back Button */}
            <button onClick={() => router.push('/')} className="text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5] w-fit text-xs">
                ← Back
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
                    <div className="ml-auto flex items-center gap-3">
                        {/* Expanded Owned Section */}
                        <Tooltip text={underlyingBalance > 0 ? `Value: $${holdingValue.toFixed(2)}` : "You don't own any shares yet"}>
                            <div className="bg-[#27272a] px-3 py-1.5 rounded-lg cursor-help">
                                <div className="text-xs text-[rgba(255,255,255,0.5)]">
                                    Owned: <span className="text-[#f5f5f5] font-semibold">{underlyingBalance.toLocaleString()}</span>
                                </div>
                                {underlyingBalance > 0 && stockData && (
                                    <div className="text-xs text-[#3DD68C] font-medium">
                                        Value: ${holdingValue.toFixed(2)}
                                    </div>
                                )}
                            </div>
                        </Tooltip>
                        {/* Polling interval dropdown */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[rgba(255,255,255,0.4)]">Refresh:</span>
                            <select 
                                value={pollInterval}
                                onChange={(e) => setPollInterval(Number(e.target.value))}
                                className="bg-[#27272a] text-xs text-[#f5f5f5] px-2 py-1.5 rounded-lg border border-[#3f3f46] cursor-pointer hover:bg-[#3f3f46] transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                {POLL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        {stockData && (
                            <span className="bg-green-500/20 text-green-500 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                LIVE
                            </span>
                        )}
                    </div>
                </div>

                {/* Price Row with Sparkline */}
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
                        {/* Mini Sparkline with animation */}
                        {stockData.sparkline && stockData.sparkline.length > 1 && (
                            <MiniSparkline data={stockData.sparkline} positive={stockData.priceChange >= 0} />
                        )}
                        {/* Exchange/Oracle info inline */}
                        <div className="ml-auto flex items-center gap-3 text-[10px] text-[rgba(255,255,255,0.4)]">
                            <span>{stockData.dex || 'DEX'}</span>
                            <span className="text-[#3f3f46]">•</span>
                            <span>{stockData.source === 'bitquery' ? 'Bitquery' : 'Internal'}</span>
                            <span className="text-[#3f3f46]">•</span>
                            <span>{lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '—'}</span>
                            {stockData.stale && <span className="text-yellow-500">⚠</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MARKET STATS ROW - Compact */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {stockData && (
                <div className="grid grid-cols-5 gap-2">
                    {/* OHLC Block */}
                    <Tooltip text="Opening price for the selected time interval">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">OHLC</p>
                            <div className="grid grid-cols-2 gap-x-2 text-xs">
                                <div><span className="text-[rgba(255,255,255,0.4)]">O</span> <span className="font-semibold text-[#f5f5f5]">{stockData.open.toFixed(2)}</span></div>
                                <div><span className="text-[rgba(255,255,255,0.4)]">H</span> <span className="font-semibold text-[#f5f5f5]">{stockData.high.toFixed(2)}</span></div>
                                <div><span className="text-[rgba(255,255,255,0.4)]">L</span> <span className="font-semibold text-[#f5f5f5]">{stockData.low.toFixed(2)}</span></div>
                                <div><span className="text-[rgba(255,255,255,0.4)]">C</span> <span className="font-semibold text-[#f5f5f5]">{stockData.close.toFixed(2)}</span></div>
                            </div>
                        </div>
                    </Tooltip>

                    {/* Volume Block */}
                    <Tooltip text="Total trading volume in the past 24 hours">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Volume (24h)</p>
                            <p className="text-lg font-bold text-[#f5f5f5]">{formatVolume(stockData.volume)}</p>
                        </div>
                    </Tooltip>

                    {/* 52w Range Block */}
                    <Tooltip text="52-week price range with current position">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-help">
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
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-help">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Market Cap</p>
                            <p className="text-lg font-bold text-[#f5f5f5]">{stockData.marketCap ? `$${formatVolume(stockData.marketCap)}` : '—'}</p>
                        </div>
                    </Tooltip>

                    {/* Sentiment Block */}
                    <Tooltip text="Based on aggregated tick-level microstructure signals">
                        <div className="bg-[#0f1015] border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-help">
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
            {/* CHART SECTION */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {stockData ? (
                <div className="space-y-2">
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

                    {/* Chart Container - Reduced height */}
                    <div className="w-full h-[280px] bg-[#131722] rounded-lg border border-[#27272a] overflow-hidden">
                        <ChartComponent priceHistory={priceHistory} historicalCandles={stockData.historicalCandles} />
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-[280px] bg-[#0f1015] rounded-lg border border-[#27272a]">
                    <div className="text-center space-y-2">
                        <div className="animate-spin w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-[rgba(255,255,255,0.5)] text-sm">Loading...</p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ORDERBOOK + PERFORMANCE + TRADE ACTIONS - All in one row */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {stockData && (
                <div className="grid grid-cols-12 gap-3">
                    {/* Orderbook Card - Compact */}
                    <div className="col-span-4 bg-[#0f1015] border border-[#27272a] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider">Orderbook</p>
                            <span className="text-[9px] text-[rgba(255,255,255,0.4)]">Spread: ${stockData.spread.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-4 mb-2">
                            <div>
                                <p className="text-[9px] text-[rgba(255,255,255,0.4)]">Bid</p>
                                <p className="text-lg font-bold text-[#3DD68C]">${stockData.bid.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-[rgba(255,255,255,0.4)]">Ask</p>
                                <p className="text-lg font-bold text-[#FF5C5C]">${stockData.ask.toFixed(2)}</p>
                            </div>
                        </div>
                        <MarketDepthBar bidPercent={stockData.priceChange >= 0 ? 58 : 42} />
                    </div>

                    {/* Performance - Compact */}
                    <div className="col-span-3 bg-[#0f1015] border border-[#27272a] rounded-lg p-3">
                        <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Performance</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {Object.entries(stockData.performance).map(([period, value]) => (
                                <div key={period} className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase">{period}</span>
                                    <span className={`text-xs font-bold ${value >= 0 ? 'text-[#3DD68C]' : 'text-[#FF5C5C]'}`}>
                                        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trade Actions - Compact */}
                    <div className="col-span-5 flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button
                                disabled
                                className="flex-1 bg-gradient-to-r from-[#3DD68C] to-[#2fb377] text-white text-sm font-bold py-2.5 rounded-lg opacity-50 cursor-not-allowed"
                            >
                                Buy
                            </button>
                            <button
                                disabled
                                className="flex-1 bg-[#27272a] text-[#f5f5f5] text-sm font-bold py-2.5 rounded-lg opacity-50 cursor-not-allowed"
                            >
                                Sell
                            </button>
                        </div>
                        <button
                            onClick={() => router.push('/stock/chain')}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-sm font-bold py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                        >
                            Trade Options →
                        </button>
                        <button
                            onClick={() => setShowPriceAlert(true)}
                            className="w-full bg-[#27272a] hover:bg-[#3f3f46] text-[#f5f5f5] text-xs font-medium py-2 rounded-lg transition-colors border border-[#3f3f46]"
                        >
                            🔔 Set Price Alert
                        </button>
                    </div>
                </div>
            )}

            {/* Price Alert Modal */}
            {showPriceAlert && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPriceAlert(false)}>
                    <div className="bg-[#0f1015] border border-[#27272a] rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-[#f5f5f5]">Set Price Alert</h3>
                            <button onClick={() => setShowPriceAlert(false)} className="text-[rgba(255,255,255,0.5)] hover:text-[#f5f5f5]">✕</button>
                        </div>
                        <p className="text-sm text-[rgba(255,255,255,0.5)]">Get notified when {stock.symbol} reaches your target price.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-[rgba(255,255,255,0.5)] mb-1 block">Alert when price is</label>
                                <select className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm">
                                    <option>Above</option>
                                    <option>Below</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-[rgba(255,255,255,0.5)] mb-1 block">Target Price (USDC)</label>
                                <input 
                                    type="number" 
                                    placeholder={stockData?.currentPrice.toFixed(2)}
                                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowPriceAlert(false)} className="flex-1 bg-[#27272a] text-[#f5f5f5] py-3 rounded-xl font-medium hover:bg-[#3f3f46] transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => { alert('Price alert set! (Demo)'); setShowPriceAlert(false); }} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
                                Set Alert
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    <div>
                        {activePositions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activePositions.map((pos) => {
                                    const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
                                    return (
                                        <PositionCard
                                            key={pos.publicKey.toString()}
                                            position={pos}
                                            currentPrice={stockData?.currentPrice || 0}
                                            isSeller={isSeller}
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
                            <div className="text-center py-16 bg-[#0f1015] rounded-xl border border-[#27272a]">
                                <p className="text-[#f5f5f5] text-lg mb-2">You don't own {stock.symbol} yet.</p>
                                <p className="text-[rgba(255,255,255,0.5)] text-sm mb-6">Start trading to build your position.</p>
                                <button
                                    onClick={() => router.push('/stock/chain')}
                                    className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
                                >
                                    Buy {stock.symbol}
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
                            style: 'dashed',
                            dashedValue: [4, 2],
                            size: 1,
                            color: '#787b86'
                        },
                        text: {
                            show: true,
                            style: 'fill',
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: 'solid',
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
                            style: 'dashed',
                            dashedValue: [4, 2],
                            size: 1,
                            color: '#787b86'
                        },
                        text: {
                            show: true,
                            style: 'fill',
                            color: '#f5f5f5',
                            size: 11,
                            family: 'inherit',
                            weight: 'normal',
                            borderStyle: 'solid',
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

    // Load historical candles from Bitquery on first load
    useEffect(() => {
        if (!chartInstance.current || historicalLoaded.current) return;
        if (!historicalCandles || historicalCandles.length === 0) return;

        // @ts-ignore
        chartInstance.current.applyNewData(historicalCandles);
        lastCandleCount.current = historicalCandles.length;
        historicalLoaded.current = true;
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

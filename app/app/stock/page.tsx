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

interface PricePoint {
    timestamp: number;
    price: number;
    ohlc?: { open: number; high: number; low: number; close: number };
}

export default function StockPage() {
    const router = useRouter();
    const { connection } = useConnection();
    const wallet = useWallet();

    // Stock state
    const stock = XSTOCKS[0]; // Mock xStock
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

    // Market state
    const [userPositions, setUserPositions] = useState<any[]>([]);
    const [underlyingBalance, setUnderlyingBalance] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filter positions
    const activePositions = userPositions.filter(pos => {
        const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
        const isExercised = pos.account.exercised;
        const isExpired = new Date() > new Date(pos.account.expiryTs.toNumber() * 1000);

        if (isSeller) {
            // Seller sees position until it is settled (exercised/reclaimed)
            return !isExercised;
        } else {
            // Buyer sees position until exercised OR expired
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
            // Clear stale price history when wallet connects
            setPriceHistory([]);

            fetchPrice();
            fetchUserPositions();
            fetchUnderlyingBalance();
            
            // Poll for updates every 3 seconds for more responsive chart
            const interval = setInterval(() => {
                fetchPrice();
                fetchUnderlyingBalance();
                fetchUserPositions(); // Also refresh positions
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [wallet.publicKey]);

    const fetchUnderlyingBalance = async () => {
        if (!wallet.publicKey) return;
        try {
            const ata = PublicKey.findProgramAddressSync(
                [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), stock.mint.toBuffer()],
                new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
            )[0];

            console.log("Fetching balance for mint:", stock.mint.toBase58());
            console.log("Derived ATA:", ata.toBase58());

            const balance = await connection.getTokenAccountBalance(ata, 'processed');
            console.log("Fetched Balance:", balance.value.uiAmount);
            setUnderlyingBalance(balance.value.uiAmount || 0);
        } catch (e) {
            console.log("No underlying balance found (or error):", e);
            setUnderlyingBalance(0);
        }
    };

    const fetchPrice = async () => {
        try {
            const res = await fetch('/api/price');
            const data = await res.json();
            const price = data.price;
            const ohlc = data.ohlc;

            setCurrentPrice(price);

            setPriceHistory(prev => {
                const newPoint: PricePoint = { 
                    timestamp: data.timestamp || Date.now(), 
                    price,
                    ohlc // Include OHLC data from API
                };
                const newHistory = [...prev, newPoint];
                // Keep more history for smooth chart updates
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
            // Manual fetch to handle legacy accounts with different sizes
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
                    // Check if account data is large enough for the new schema (173 bytes)
                    if (acc.account.data.length < 173) {
                        console.warn(`Skipping legacy account ${acc.pubkey.toBase58()} (size: ${acc.account.data.length})`);
                        return null;
                    }
                    return {
                        publicKey: acc.pubkey,
                        account: accountClient.coder.accounts.decode("coveredCall", acc.account.data)
                    };
                } catch (e) {
                    console.warn(`Failed to decode account ${acc.pubkey.toBase58()}:`, e);
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

            // Derive ATAs
            const buyerUnderlyingAccount = getAta(stock.mint, wallet.publicKey);
            const buyerQuoteAccount = getAta(QUOTE_MINT, wallet.publicKey);
            const sellerQuoteAccount = getAta(QUOTE_MINT, position.account.seller);
            const vaultAccount = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCall.toBuffer()],
                program.programId
            )[0];

            console.log("--- Debug Exercise ---");
            console.log("Covered Call:", coveredCall.toBase58());
            console.log("Buyer:", wallet.publicKey.toBase58());
            console.log("Buyer xStock:", buyerUnderlyingAccount.toBase58());
            console.log("Buyer Quote:", buyerQuoteAccount.toBase58());
            console.log("Seller Quote:", sellerQuoteAccount.toBase58());
            console.log("Vault:", vaultAccount.toBase58());
            console.log("xStock Mint:", stock.mint.toBase58());

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

            // Manually force mutable accounts to be writable (fix for ConstraintMut error)
            const mutableAccounts = [coveredCall, vaultAccount, sellerUnderlyingAccount];

            console.log("Mutable Accounts to patch:", mutableAccounts.map(k => k.toBase58()));
            console.log("Instruction Keys before patch:", ix.keys.map(k => ({ pubkey: k.pubkey.toBase58(), isWritable: k.isWritable, isSigner: k.isSigner })));

            mutableAccounts.forEach(pubkey => {
                const index = ix.keys.findIndex(k => k.pubkey.toBase58() === pubkey.toBase58());
                if (index >= 0) {
                    console.log(`Patching account ${pubkey.toBase58()} to be writable`);
                    ix.keys[index].isWritable = true;
                } else {
                    console.warn(`Could not find account ${pubkey.toBase58()} in instruction keys`);
                }
            });

            console.log("Instruction Keys after patch:", ix.keys.map(k => ({ pubkey: k.pubkey.toBase58(), isWritable: k.isWritable, isSigner: k.isSigner })));

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
                .listForSale(new BN(price * 1_000_000)) // 6 decimals
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

    if (!wallet.publicKey) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-muted-foreground">Connect your wallet to trade {stock.symbol}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto px-6 space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground w-fit">
                    ← Back
                </button>
                <div className="flex items-center gap-3">
                    {stock.logo && (
                        <img src={stock.logo} alt={stock.name} className="w-12 h-12 rounded-full" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{stock.symbol}</h1>
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-muted-foreground">{stock.name}</p>
                            <span className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                                Owned: <span className="text-foreground font-medium">{underlyingBalance.toLocaleString()}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content (Left) */}
                <div className="lg:col-span-12 space-y-8">
                    {/* Price Chart */}
                    {/* Price Chart */}
                    {currentPrice !== null ? (
                        <div className="p-0"> {/* Removed bg-card border border-border rounded-lg p-6 */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Current Price</p>
                                    <div className="flex items-baseline gap-3">
                                        <p className="text-4xl font-bold text-foreground">{currentPrice.toFixed(2)} <span className="text-xl font-normal text-muted-foreground">USDC</span></p>
                                        {priceHistory.length > 1 && (
                                            <p className={`text-sm font-medium ${priceHistory[priceHistory.length - 1].price > priceHistory[0].price ? 'text-green-500' : 'text-red-500'}`}>
                                                {((priceHistory[priceHistory.length - 1].price - priceHistory[0].price) / priceHistory[0].price * 100).toFixed(2)}%
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-green-500/20 text-green-500 text-xs font-bold px-3 py-1.5 rounded h-fit">LIVE</div>
                            </div>

                            <div className="w-full h-[400px] bg-[#131722] rounded-lg overflow-hidden mb-8">
                                <ChartComponent priceHistory={priceHistory} />
                            </div>

                            <button
                                onClick={() => router.push('/stock/chain')}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-xl font-bold py-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg"
                            >
                                Trade Options ➔
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-[400px] bg-card/50 rounded-xl border border-border/50">
                            <div className="text-center space-y-2">
                                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                                <p className="text-muted-foreground">Loading market data...</p>
                            </div>
                        </div>
                    )}

                    {/* Positions & History */}
                    {userPositions.length > 0 && (
                        <div>
                            <div className="flex items-center gap-6 border-b border-border/50 mb-6">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'active' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Active Positions
                                    {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    Trade History
                                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />}
                                </button>
                            </div>

                            {activeTab === 'active' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activePositions.length > 0 ? activePositions.map((pos) => {
                                        const isSeller = pos.account.seller.toString() === wallet.publicKey?.toString();
                                        console.log(`Position ${pos.publicKey.toString()}: Seller=${pos.account.seller.toString()}, Wallet=${wallet.publicKey?.toString()}, isSeller=${isSeller}`);
                                        return (
                                            <PositionCard
                                                key={pos.publicKey.toString()}
                                                position={pos}
                                                currentPrice={currentPrice || 0}
                                                isSeller={isSeller}
                                                onExercise={() => handleExercise(pos)}
                                                onReclaim={() => handleReclaim(pos)}
                                                onListForSale={(price) => handleListForSale(pos, price)}
                                                onCancelListing={() => handleCancelListing(pos)}
                                            />
                                        );
                                    }) : (
                                        <div className="col-span-full text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
                                            No active positions
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <HistoryTable positions={historyPositions} walletPublicKey={wallet.publicKey?.toString() || ""} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ChartComponent({ priceHistory }: { priceHistory: PricePoint[] }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const lastCandleCount = useRef<number>(0);
    const chartId = useRef<string>(`chart-${Date.now()}`);

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
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        noChangeColor: '#888888',
                        upBorderColor: '#26a69a',
                        downBorderColor: '#ef5350',
                        noChangeBorderColor: '#888888',
                        upWickColor: '#26a69a',
                        downWickColor: '#ef5350',
                        noChangeWickColor: '#888888'
                    }
                },
                xAxis: {
                    tickText: { color: '#787b86' }
                },
                yAxis: {
                    tickText: { color: '#787b86' }
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

    useEffect(() => {
        if (!chartInstance.current || priceHistory.length === 0) return;

        const interval = 30 * 1000; // 30-second candles for more activity

        // Build candles from price history, using OHLC data when available
        const grouped = new Map<number, PricePoint[]>();
        priceHistory.forEach(p => {
            const bucket = Math.floor(p.timestamp / interval) * interval;
            if (!grouped.has(bucket)) grouped.set(bucket, []);
            grouped.get(bucket)!.push(p);
        });

        // Generate candles with proper OHLC from API data
        const candles: any[] = [];
        const sortedBuckets = Array.from(grouped.keys()).sort((a, b) => a - b);

        sortedBuckets.forEach(time => {
            const points = grouped.get(time)!;
            if (!points || points.length === 0) return;

            // If we have OHLC data from API, use it for more realistic candles
            let open: number, high: number, low: number, close: number;
            
            if (points.some(p => p.ohlc)) {
                // Aggregate OHLC from all points in this bucket
                const ohlcPoints = points.filter(p => p.ohlc);
                open = ohlcPoints[0]?.ohlc?.open ?? points[0].price;
                close = ohlcPoints[ohlcPoints.length - 1]?.ohlc?.close ?? points[points.length - 1].price;
                high = Math.max(...ohlcPoints.map(p => p.ohlc?.high ?? p.price));
                low = Math.min(...ohlcPoints.map(p => p.ohlc?.low ?? p.price));
            } else {
                // Fallback to simple price aggregation
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
                volume: points.length * 1000 // Simulated volume based on tick count
            });
        });

        if (candles.length === 0) return;

        // Determine if we need to apply new data or just update
        const isNewCandleAdded = candles.length > lastCandleCount.current;
        
        if (lastCandleCount.current === 0 || isNewCandleAdded) {
            // Initial load or new candle added - replace all data
            // @ts-ignore
            chartInstance.current.applyNewData(candles);
        } else {
            // Just updating the current candle - use updateData for smooth updates
            const lastCandle = candles[candles.length - 1];
            // @ts-ignore
            chartInstance.current.updateData(lastCandle);
        }
        
        lastCandleCount.current = candles.length;

    }, [priceHistory]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}

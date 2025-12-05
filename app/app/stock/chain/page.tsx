"use client";

import { useState, useEffect, useCallback } from "react";
import bs58 from "bs58";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, programId } from "../../../anchor/setup";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { XSTOCKS, QUOTE_MINT } from "../../../utils/constants";
import { useRouter } from "next/navigation";

import OrderForm, { type SelectedOptionInfo } from "../components/OrderForm";
import OptionsChain from "../components/OptionsChain";

export default function ChainPage() {
    const router = useRouter();
    const { connection } = useConnection();
    const wallet = useWallet();

    const stock = XSTOCKS[0];
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [historicalVolatility, setHistoricalVolatility] = useState<{
        hv20: number;
        hv60: number;
        hvAll: number;
        baseIV: number;
    } | null>(null);
    const [availableOptions, setAvailableOptions] = useState<any[]>([]);
    const [selectedOption, setSelectedOption] = useState<any | null>(null);
    const [selectedInfo, setSelectedInfo] = useState<SelectedOptionInfo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (wallet.publicKey) {
            fetchPrice();
            fetchOptions();
            const interval = setInterval(() => {
                fetchPrice();
                fetchOptions();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [wallet.publicKey]);

    const fetchPrice = async () => {
        try {
            const mintAddress = stock.priceMint?.toBase58() || stock.mint.toBase58();
            const params = new URLSearchParams({
                mint: mintAddress,
                symbol: stock.symbol,
                name: stock.name,
                interval: 'MAX', // Request max data for better HV calculation
            });
            const res = await fetch(`/api/price?${params}`);
            const data = await res.json();
            const price = data.price || data.currentPrice;
            if (currentPrice && price) {
                setPriceChange(((price - currentPrice) / currentPrice) * 100);
            }
            setCurrentPrice(price);
            
            // Extract historical volatility for IV calculations
            if (data.historicalVolatility) {
                setHistoricalVolatility(data.historicalVolatility);
            }
        } catch (err) {
            console.error("Failed to fetch price:", err);
        }
    };

    const fetchOptions = async () => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            // @ts-ignore
            const accountClient = program.account.coveredCall || program.account.CoveredCall;

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
                    // Account size: 8 (discriminator) + 32*4 (pubkeys) + 8*6 (u64s) + 4 (bools) + 1 (option tag) + 32 (optional pubkey) = 213 minimum
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

            // Filter to only show options for the current stock's mint
            const options = allCalls.filter((a: any) =>
                a.account.xstockMint.toString() === stock.mint.toString() &&
                (!a.account.buyer || a.account.isListed) &&
                !a.account.exercised &&
                !a.account.cancelled &&
                a.account.expiryTs.toNumber() > Date.now() / 1000
            );

            setAvailableOptions(options);
        } catch (e) {
            console.error("Error fetching options:", e);
        }
    };

    // Handle option selection from chain
    const handleOptionSelect = useCallback((option: any, type: "call" | "put", side: "buy" | "sell") => {
        // Build selected info for order form auto-fill
        const info: SelectedOptionInfo = {
            strike: option.strike,
            premium: option.mid,
            expiration: option.expiration,
            type: type,
            side: side,
            delta: option.delta,
            iv: option.iv,
            rawOption: option.rawOption || null,
        };
        
        setSelectedInfo(info);
        setSelectedOption(option.rawOption || null);
    }, []);

    const handleSell = async (params: { strike: number; expiry: Date; contracts: number; premium: number }) => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setIsProcessing(true);

        try {
            const program = getProgram(connection, wallet);

            // Generate unique ID using timestamp
            const uid = new BN(Date.now());
            const strikePrice = params.strike * 100 * 1_000_000; // Strike in USDC with 6 decimals
            const premiumAmount = Math.floor(params.premium * 1_000_000); // Premium in USDC with 6 decimals
            const expiryTimestamp = Math.floor(params.expiry.getTime() / 1000);
            const amount = new BN(params.contracts * 100 * 1_000_000); // 100 shares per contract with 6 decimals

            const [coveredCallPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("covered_call"), wallet.publicKey.toBuffer(), stock.mint.toBuffer(), uid.toArrayLike(Buffer, "le", 8)],
                programId
            );

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCallPda.toBuffer()],
                programId
            );

            const getATA = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const sellerXstockAccount = getATA(stock.mint, wallet.publicKey);

            const ix = await program.methods
                .createCoveredCall(uid, new BN(strikePrice), new BN(premiumAmount), new BN(expiryTimestamp), amount)
                .accounts({
                    seller: wallet.publicKey,
                    coveredCall: coveredCallPda,
                    vaultAccount: vaultPda,
                    xstockMint: stock.mint,
                    quoteMint: QUOTE_MINT,
                    sellerXstockAccount: sellerXstockAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .instruction();

            const forceMutable = [coveredCallPda, vaultPda, sellerXstockAccount];
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

            const signedTx = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig);

            alert(`Covered Call Created!`);
            fetchOptions();
        } catch (err) {
            console.error(err);
            alert("Error creating covered call: " + (err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBuy = async (params: { option: any; contracts: number }) => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setIsProcessing(true);

        try {
            const program = getProgram(connection, wallet);
            const account = params.option;
            const coveredCallKey = account.publicKey;
            const data = account.account;

            if (!data || !data.quoteMint || !data.seller) {
                throw new Error("Invalid option data");
            }
            
            // Check if user is trying to buy their own option
            const currentOwner = data.buyer || data.seller;
            if (currentOwner.toString() === wallet.publicKey.toString()) {
                throw new Error("Cannot buy your own option");
            }

            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const isResale = data.buyer !== null;
            const currentSeller = isResale ? data.buyer : data.seller;

            if (!currentSeller) {
                throw new Error("No seller found for this option");
            }

            const buyerQuoteAccount = getAta(data.quoteMint, wallet.publicKey);
            const sellerQuoteAccount = getAta(data.quoteMint, currentSeller);

            const ix = await program.methods
                .buyOption()
                .accounts({
                    buyer: wallet.publicKey,
                    coveredCall: coveredCallKey,
                    buyerQuoteAccount: buyerQuoteAccount,
                    paymentAccount: sellerQuoteAccount, // Payment goes to current owner (seller or previous buyer)
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction();

            const forceMutable = [coveredCallKey, buyerQuoteAccount, sellerQuoteAccount];
            forceMutable.forEach(pubkey => {
                const index = ix.keys.findIndex((k: any) => k.pubkey.equals(pubkey));
                if (index >= 0) {
                    ix.keys[index].isWritable = true;
                }
            });

            const tx = new Transaction();

            const sellerQuoteAccountInfo = await connection.getAccountInfo(sellerQuoteAccount);
            if (!sellerQuoteAccountInfo) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        sellerQuoteAccount,
                        currentSeller,
                        data.quoteMint
                    )
                );
            }

            const buyerXstockAccount = getAta(stock.mint, wallet.publicKey);
            const buyerXstockAccountInfo = await connection.getAccountInfo(buyerXstockAccount);
            if (!buyerXstockAccountInfo) {
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        buyerXstockAccount,
                        wallet.publicKey,
                        stock.mint
                    )
                );
            }

            tx.add(ix);
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            const signedTx = await wallet.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig);

            alert("Option Bought!");
            fetchOptions();
            setSelectedOption(null);
            setSelectedInfo(null);
        } catch (err) {
            console.error(err);
            alert("Error buying option: " + (err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!wallet.publicKey) {
        return (
            <div className="min-h-screen bg-[#070a0d] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-white/5 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                    </div>
                    <p className="text-white/50">Connect your wallet to view the options chain</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#070a0d]">
            <div className="max-w-[1800px] mx-auto px-6 py-8">
                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* HEADER */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="space-y-4 mb-6">
                    <button 
                        onClick={() => router.push('/stock')} 
                        className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to {stock.symbol}
                    </button>
                    
                    <div className="flex items-center gap-4">
                        {stock.logo && (
                            <img src={stock.logo} alt={stock.name} className="w-12 h-12 rounded-full" />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold text-white">{stock.symbol} Options Chain</h1>
                            <div className="flex items-center gap-3 mt-1">
                                {currentPrice && (
                                    <span className="text-xl font-bold text-white">${currentPrice.toFixed(2)}</span>
                                )}
                                {currentPrice && (
                                    <>
                                        {/* <span className="text-white/30">•</span> */}
                                        <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* MAIN CONTENT */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Options Chain */}
                    <div className="xl:col-span-9">
                        <OptionsChain
                            options={availableOptions}
                            selectedOption={selectedOption}
                            onSelectOption={handleOptionSelect}
                            currentPrice={currentPrice || 0}
                            historicalVolatility={historicalVolatility || undefined}
                        />
                    </div>
                    
                    {/* Order Form */}
                    <div className="xl:col-span-3">
                        <div className="sticky top-6">
                            <OrderForm
                                currentPrice={currentPrice || 0}
                                selectedOption={selectedOption}
                                selectedInfo={selectedInfo}
                                onSell={handleSell}
                                onBuy={handleBuy}
                                isProcessing={isProcessing}
                            />
                            
                            {/* Market Stats with Real Volatility */}
                            <div className="mt-4 bg-[#0a0b0d] border border-white/5 rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Volatility</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/[0.02] rounded-lg p-3">
                                        <p className="text-[10px] text-white/40 uppercase">Base IV</p>
                                        <p className="text-lg font-bold text-white">
                                            {historicalVolatility 
                                                ? `${(historicalVolatility.baseIV * 100).toFixed(1)}%`
                                                : '—'
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-white/[0.02] rounded-lg p-3">
                                        <p className="text-[10px] text-white/40 uppercase">HV (20)</p>
                                        <p className="text-lg font-bold text-white">
                                            {historicalVolatility 
                                                ? `${(historicalVolatility.hv20 * 100).toFixed(1)}%`
                                                : '—'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/[0.02] rounded-lg p-3">
                                        <p className="text-[10px] text-white/40 uppercase">HV (60)</p>
                                        <p className="text-lg font-bold text-white">
                                            {historicalVolatility 
                                                ? `${(historicalVolatility.hv60 * 100).toFixed(1)}%`
                                                : '—'
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-white/[0.02] rounded-lg p-3">
                                        <p className="text-[10px] text-white/40 uppercase">On-Chain</p>
                                        <p className="text-lg font-bold text-white">{availableOptions.length}</p>
                                    </div>
                                </div>
                                {historicalVolatility && (
                                    <p className="text-[10px] text-white/30 text-center pt-1">
                                        IV derived from historical price volatility
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

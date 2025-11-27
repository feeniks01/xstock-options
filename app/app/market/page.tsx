"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "../../anchor/setup";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export default function MarketPage() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchListings();
    }, [wallet.connected]); // Fetch when wallet connects (or on mount if we don't need wallet for fetch)
    // Actually, we need wallet to create program instance usually, but we can create read-only program with dummy wallet.
    // For now, let's require wallet or handle it.

    const fetchListings = async () => {
        if (!wallet.publicKey) return; // Need wallet for now to init program easily
        try {
            const program = getProgram(connection, wallet);
            // @ts-ignore
            const accounts = await program.account.coveredCall.all();
            setListings(accounts);
        } catch (err) {
            console.error("Error fetching listings:", err);
        }
    };

    const handleBuy = async (account: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const coveredCallKey = account.publicKey;
            const data = account.account;

            // Get ATAs
            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const buyerQuoteAccount = getAta(data.quoteMint, wallet.publicKey);
            const sellerQuoteAccount = getAta(data.quoteMint, data.seller);

            await program.methods
                .buyOption()
                .accounts({
                    buyer: wallet.publicKey,
                    coveredCall: coveredCallKey,
                    buyerQuoteAccount: buyerQuoteAccount,
                    sellerQuoteAccount: sellerQuoteAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            alert("Option Bought!");
            fetchListings();
        } catch (err) {
            console.error(err);
            alert("Error buying option: " + (err as Error).message);
        }
    };

    const handleExercise = async (account: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const data = account.account;

            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const buyerXstockAccount = getAta(data.xstockMint, wallet.publicKey);
            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), account.publicKey.toBuffer()],
                program.programId
            );
            const [oraclePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("mock_oracle")],
                program.programId
            );

            await program.methods
                .exercise()
                .accounts({
                    buyer: wallet.publicKey,
                    coveredCall: account.publicKey,
                    vaultAccount: vaultPda,
                    buyerXstockAccount: buyerXstockAccount,
                    xstockMint: data.xstockMint,
                    priceOracle: oraclePda,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            alert("Exercised!");
            fetchListings();
        } catch (err) {
            console.error(err);
            alert("Error exercising: " + (err as Error).message);
        }
    };

    const handleReclaim = async (account: any) => {
        if (!wallet.publicKey) return;
        try {
            const program = getProgram(connection, wallet);
            const data = account.account;

            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const sellerXstockAccount = getAta(data.xstockMint, wallet.publicKey);
            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), account.publicKey.toBuffer()],
                program.programId
            );
            const [oraclePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("mock_oracle")],
                program.programId
            );

            await program.methods
                .reclaim()
                .accounts({
                    seller: wallet.publicKey,
                    coveredCall: account.publicKey,
                    vaultAccount: vaultPda,
                    sellerXstockAccount: sellerXstockAccount,
                    xstockMint: data.xstockMint,
                    priceOracle: oraclePda,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            alert("Reclaimed!");
            fetchListings();
        } catch (err) {
            console.error(err);
            alert("Error reclaiming: " + (err as Error).message);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Marketplace</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((item) => {
                    const data = item.account;
                    const isSold = !!data.buyer;
                    const isExpired = Date.now() / 1000 > data.expiryTs.toNumber();

                    return (
                        <div key={item.publicKey.toString()} className="bg-gray-800 border border-gray-700 rounded-xl p-6 relative overflow-hidden">
                            {isSold && <div className="absolute top-0 right-0 bg-red-500 text-xs font-bold px-2 py-1">SOLD</div>}
                            {isExpired && !isSold && <div className="absolute top-0 right-0 bg-gray-500 text-xs font-bold px-2 py-1">EXPIRED</div>}

                            <div className="mb-4">
                                <p className="text-gray-400 text-sm">Seller</p>
                                <p className="font-mono text-sm truncate">{data.seller.toString()}</p>
                            </div>

                            <div className="flex justify-between mb-2">
                                <div>
                                    <p className="text-gray-400 text-sm">Strike</p>
                                    <p className="text-xl font-bold">{data.strike.toNumber() / 1_000_000} USDC</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 text-sm">Premium</p>
                                    <p className="text-xl font-bold text-green-400">{data.premium.toNumber() / 1_000_000} USDC</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-400 text-sm">Expiry</p>
                                <p>{new Date(data.expiryTs.toNumber() * 1000).toLocaleDateString()}</p>
                            </div>

                            {!isSold && !isExpired && (
                                <button
                                    onClick={() => handleBuy(item)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition"
                                >
                                    Buy Option
                                </button>
                            )}

                            {isSold && !data.exercised && wallet.publicKey?.toString() === data.buyer?.toString() && (
                                <button
                                    onClick={() => handleExercise(item)}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition mt-2"
                                >
                                    Exercise (if ITM)
                                </button>
                            )}

                            {!data.exercised && wallet.publicKey?.toString() === data.seller.toString() && (isExpired || (isSold && isExpired)) && (
                                <button
                                    onClick={() => handleReclaim(item)}
                                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 rounded transition mt-2"
                                >
                                    Reclaim Collateral
                                </button>
                            )}

                            {isSold && !data.exercised && wallet.publicKey?.toString() !== data.buyer?.toString() && (
                                <button disabled className="w-full bg-gray-700 text-gray-500 font-bold py-2 rounded cursor-not-allowed">
                                    Sold
                                </button>
                            )}

                            {data.exercised && (
                                <div className="w-full bg-gray-800 text-gray-400 font-bold py-2 text-center border border-gray-600 rounded">
                                    Settled
                                </div>
                            )}
                        </div>
                    );
                })}

                {listings.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-10">No active listings found.</p>
                )}
            </div>
        </div>
    );
}

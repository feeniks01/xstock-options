"use client";

import { useState, useEffect } from "react";
import bs58 from "bs58";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, programId } from "../../../anchor/setup";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { XSTOCKS, QUOTE_MINT } from "../../../utils/constants";
import { useRouter } from "next/navigation";

import OrderForm from "../components/OrderForm";
import OptionsChain from "../components/OptionsChain";
import { calculateOptionPremium } from "../../../utils/pricing";

export default function ChainPage() {
    const router = useRouter();
    const { connection } = useConnection();
    const wallet = useWallet();

    const stock = XSTOCKS[0]; // Mock xStock
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [availableOptions, setAvailableOptions] = useState<any[]>([]);
    const [selectedOption, setSelectedOption] = useState<any | null>(null);
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
            const res = await fetch('/api/price');
            const data = await res.json();
            const price = data.price;
            setCurrentPrice(price);
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

            // Manual fetch to handle legacy accounts with different sizes
            const memcmpResult = accountClient.coder.accounts.memcmp("coveredCall");
            console.log("memcmp result:", memcmpResult);

            const discriminator = memcmpResult.bytes ? memcmpResult.bytes : memcmpResult;
            const discriminatorBytes = typeof discriminator === 'string' ? bs58.decode(discriminator) : discriminator;
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
                    // 8 (disc) + 32 + 33 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8 = 173
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

            // Filter for available options (no buyer yet OR listed for sale) and not expired
            const options = allCalls.filter((a: any) =>
                (!a.account.buyer || a.account.isListed) &&
                a.account.expiryTs.toNumber() > Date.now() / 1000
            );

            setAvailableOptions(options);
        } catch (e) {
            console.error("Error fetching options:", e);
        }
    };

    const handleSell = async (params: { strike: number; expiry: Date; contracts: number; premium: number }) => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setIsProcessing(true);

        try {
            const program = getProgram(connection, wallet);

            const strikePrice = params.strike * 100 * 1_000_000; // 100 shares per contract
            // params.premium is Total Premium per Contract (e.g. 5.46 USDC)
            const premiumAmount = Math.floor(params.premium * 1_000_000); // 6 decimals
            const expiryTimestamp = Math.floor(params.expiry.getTime() / 1000);

            console.log("--- Creating Covered Call ---");
            console.log("Strike Price (Per Share):", params.strike);
            console.log("Strike Price (Total Units):", strikePrice);
            console.log("Premium (Total USDC):", params.premium);
            console.log("Premium (Total Units):", premiumAmount);
            console.log("Expiry:", params.expiry.toISOString());
            console.log("Contracts:", params.contracts);

            const [coveredCallPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("covered_call"), wallet.publicKey.toBuffer(), new BN(expiryTimestamp).toArrayLike(Buffer, "le", 8)],
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
                .createCoveredCall(new BN(strikePrice), new BN(premiumAmount), new BN(expiryTimestamp))
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

            // @ts-ignore
            const { Transaction } = await import("@solana/web3.js");
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

            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const isResale = data.isListed;
            const currentSeller = isResale ? data.buyer : data.seller;

            const buyerQuoteAccount = getAta(data.quoteMint, wallet.publicKey);
            const sellerQuoteAccount = getAta(data.quoteMint, currentSeller);

            // Debug Logs
            console.log("--- Debug Buy Option ---");
            console.log("Option Address:", coveredCallKey.toBase58());
            console.log("Strike (Units):", data.strike.toString());
            console.log("Strike (Per Share):", data.strike.toNumber() / 100_000_000);
            console.log("Premium (Units):", data.premium.toString());
            console.log("Premium (Total USDC):", data.premium.toNumber() / 1_000_000);
            console.log("Premium (Total USDC):", data.premium.toNumber() / 1_000_000);
            console.log("Seller (Funds Recipient):", currentSeller.toBase58());
            console.log("Is Resale:", isResale);

            try {
                const balance = await connection.getTokenAccountBalance(buyerQuoteAccount);
                console.log("Buyer Balance (Units):", balance.value.amount);
                console.log("Buyer Balance (USDC):", balance.value.uiAmount);
            } catch (e) {
                console.log("Could not fetch buyer balance (account might not exist)");
            }

            const ix = await program.methods
                .buyOption()
                .accounts({
                    buyer: wallet.publicKey,
                    coveredCall: coveredCallKey,
                    buyerQuoteAccount: buyerQuoteAccount,
                    sellerQuoteAccount: sellerQuoteAccount,
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

            // @ts-ignore
            const { Transaction } = await import("@solana/web3.js");
            const tx = new Transaction();

            // Check if seller quote account exists
            const sellerQuoteAccountInfo = await connection.getAccountInfo(sellerQuoteAccount);
            if (!sellerQuoteAccountInfo) {
                console.log("Creating Seller Quote ATA...");
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey, // payer
                        sellerQuoteAccount, // associatedToken
                        currentSeller, // owner
                        data.quoteMint // mint
                    )
                );
            }

            // Check if buyer xStock account exists (User request: create during tx)
            const buyerXstockAccount = getAta(stock.mint, wallet.publicKey);
            const buyerXstockAccountInfo = await connection.getAccountInfo(buyerXstockAccount);
            if (!buyerXstockAccountInfo) {
                console.log("Creating Buyer xStock ATA...");
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        wallet.publicKey, // payer
                        buyerXstockAccount, // associatedToken
                        wallet.publicKey, // owner
                        stock.mint // mint
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
        } catch (err) {
            console.error(err);
            alert("Error buying option: " + (err as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!wallet.publicKey) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-muted-foreground">Connect your wallet to view the options chain</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8">
            <div className="space-y-4 mb-8">
                <button onClick={() => router.push('/stock')} className="text-muted-foreground hover:text-foreground w-fit">
                    ← Back
                </button>
                <div className="flex items-baseline gap-4">
                    <h1 className="text-3xl font-bold">{stock.symbol} Option Chain</h1>
                    {currentPrice && (
                        <span className="text-xl text-muted-foreground">${currentPrice.toFixed(2)}</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-9">
                    <OptionsChain
                        options={availableOptions}
                        selectedOption={selectedOption}
                        onSelectOption={setSelectedOption}
                        currentPrice={currentPrice || 0}
                    />
                </div>
                <div className="lg:col-span-3">
                    <div className="sticky top-6">
                        <OrderForm
                            currentPrice={currentPrice || 0}
                            selectedOption={selectedOption}
                            onSell={handleSell}
                            onBuy={handleBuy}
                            isProcessing={isProcessing}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

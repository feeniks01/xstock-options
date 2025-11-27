"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN, web3 } from "@coral-xyz/anchor";
import { getProgram, programId } from "../../anchor/setup";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// MOCK MINTS for devnet (Replace with real ones from scripts later)
const XSTOCK_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // Placeholder (SOL wrapper)
const QUOTE_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC

export default function CreatePage() {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [strike, setStrike] = useState("");
    const [premium, setPremium] = useState("");
    const [expiryDays, setExpiryDays] = useState("7");
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setLoading(true);

        try {
            const program = getProgram(connection, wallet);
            const expiryTs = new BN(Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 86400);
            const strikeBn = new BN(parseFloat(strike) * 1_000_000); // Assuming 6 decimals for USDC
            const premiumBn = new BN(parseFloat(premium) * 1_000_000);

            // Derive PDAs
            const [coveredCallPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("covered_call"), wallet.publicKey.toBuffer(), expiryTs.toArrayLike(Buffer, "le", 8)],
                programId
            );

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), coveredCallPda.toBuffer()],
                programId
            );

            // Get seller token accounts (using associated token account logic or just assuming standard ATA)
            // For MVP, we assume standard ATA
            const getAta = (mint: PublicKey, owner: PublicKey) => {
                return PublicKey.findProgramAddressSync(
                    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
                )[0];
            };

            const sellerXstockAccount = getAta(XSTOCK_MINT, wallet.publicKey);

            // Call instruction
            await program.methods
                .createCoveredCall(strikeBn, premiumBn, expiryTs)
                .accounts({
                    seller: wallet.publicKey,
                    coveredCall: coveredCallPda,
                    vaultAccount: vaultPda,
                    xstockMint: XSTOCK_MINT,
                    quoteMint: QUOTE_MINT,
                    sellerXstockAccount: sellerXstockAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            alert("Covered Call Created!");
        } catch (err) {
            console.error(err);
            alert("Error creating covered call: " + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h1 className="text-2xl font-bold mb-6">Create Covered Call</h1>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Strike Price (USDC)</label>
                    <input
                        type="number"
                        value={strike}
                        onChange={(e) => setStrike(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        placeholder="e.g. 100"
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Premium (USDC)</label>
                    <input
                        type="number"
                        value={premium}
                        onChange={(e) => setPremium(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        placeholder="e.g. 5"
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Expiry</label>
                    <select
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                    >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                    </select>
                </div>

                <button
                    onClick={handleCreate}
                    disabled={loading || !wallet.connected}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded transition"
                >
                    {loading ? "Creating..." : "Create Listing"}
                </button>
            </div>
        </div>
    );
}

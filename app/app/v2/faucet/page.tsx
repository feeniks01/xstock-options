"use client";

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Droplets, Loader2, CheckCircle2, ExternalLink, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { fetchVaultData, deriveVaultPda } from '@/lib/vault-sdk';

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export default function FaucetPage() {
    const { connection } = useConnection();
    const { publicKey, connected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [fetchingBalances, setFetchingBalances] = useState(false);
    const [solBalance, setSolBalance] = useState<number | null>(null);
    const [nvdaxBalance, setNvdaxBalance] = useState<number | null>(null);
    const [underlyingMint, setUnderlyingMint] = useState<PublicKey | null>(null);
    const [lastTx, setLastTx] = useState<string | null>(null);

    // Fetch the vault's underlying mint
    const fetchVaultMint = async () => {
        try {
            const vaultData = await fetchVaultData(connection, "NVDAx");
            if (vaultData) {
                setUnderlyingMint(new PublicKey(vaultData.underlyingMint));
                return new PublicKey(vaultData.underlyingMint);
            }
        } catch (error) {
            console.error("Error fetching vault data:", error);
        }
        return null;
    };

    // Fetch balances
    const fetchBalances = async () => {
        if (!publicKey) return;

        setFetchingBalances(true);
        try {
            // SOL balance
            const balance = await connection.getBalance(publicKey);
            setSolBalance(balance / 1e9);

            // Get the mint from vault if we don't have it
            let mint = underlyingMint;
            if (!mint) {
                mint = await fetchVaultMint();
            }

            // NVDAx balance (using vault's underlying mint)
            if (mint) {
                try {
                    const ata = await getAssociatedTokenAddress(mint, publicKey);
                    const tokenBalance = await connection.getTokenAccountBalance(ata);
                    setNvdaxBalance(Number(tokenBalance.value.uiAmount));
                } catch {
                    setNvdaxBalance(0);
                }
            }
        } catch (error) {
            console.error("Error fetching balances:", error);
        } finally {
            setFetchingBalances(false);
        }
    };

    // Request NVDAx tokens from faucet API
    const requestNvdax = async () => {
        if (!publicKey) return;

        setLoading(true);
        const toastId = toast.loading("Requesting NVDAx tokens...");

        try {
            const response = await fetch('/api/faucet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to mint tokens');
            }

            toast.success(`Received ${data.amount} NVDAx!`, { id: toastId, duration: 5000 });
            setLastTx(data.signature);
            await fetchBalances();
        } catch (error: any) {
            console.error("Faucet error:", error);
            toast.error(error.message || "Request failed. Try again later.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // Fetch vault mint and balances on connect
    useEffect(() => {
        if (connected && publicKey) {
            fetchVaultMint().then(() => fetchBalances());
        }
    }, [connected, publicKey]);

    return (
        <div className="min-h-full flex flex-col items-center pt-16 px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
                        <Droplets className="w-8 h-8 text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Token Faucet</h1>
                    <p className="text-gray-400 mt-2">Get testnet NVDAx tokens for the xStock Options platform</p>
                </div>

                {/* Main Card */}
                <div className="rounded-2xl bg-gray-900/50 border border-gray-800 p-6 space-y-6">
                    {/* Connection Status */}
                    {!connected ? (
                        <div className="text-center py-8">
                            <Wallet className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                            <p className="text-gray-400 mb-4">Connect your wallet to use the faucet</p>
                            <WalletMultiButton className="!bg-green-600 hover:!bg-green-700 !rounded-xl !h-12 !px-6" />
                        </div>
                    ) : (
                        <>
                            {/* Current Balances */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-gray-400">Your Balances</h3>
                                    <button
                                        onClick={fetchBalances}
                                        disabled={fetchingBalances}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${fetchingBalances ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
                                        <p className="text-xs text-gray-500 mb-1">SOL</p>
                                        <p className="text-xl font-bold text-white">
                                            {solBalance !== null ? solBalance.toFixed(4) : "—"}
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
                                        <p className="text-xs text-gray-500 mb-1">NVDAx</p>
                                        <p className="text-xl font-bold text-green-400">
                                            {nvdaxBalance !== null ? nvdaxBalance.toFixed(2) : "—"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-800" />

                            {/* NVDAx Faucet */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-400 mb-3">Request NVDAx</h3>
                                <button
                                    onClick={requestNvdax}
                                    disabled={loading}
                                    className="w-full h-14 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Minting...
                                        </>
                                    ) : (
                                        <>
                                            <img src="/nvidiax_logo.png" alt="NVDAx" className="w-6 h-6" />
                                            Get 100 NVDAx
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Mock NVDAx tokens for testing vault deposits
                                </p>
                            </div>

                            {/* SOL Info */}
                            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-200">
                                        <p className="font-medium mb-1">Need SOL for gas?</p>
                                        <p className="text-xs text-gray-400">
                                            Visit{" "}
                                            <a
                                                href="https://faucet.solana.com/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 underline"
                                            >
                                                faucet.solana.com
                                            </a>
                                            {" "}for devnet SOL.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Last Transaction */}
                            {lastTx && (
                                <div className="flex items-center justify-center gap-2 text-sm">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <a
                                        href={`https://explorer.solana.com/tx/${lastTx}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                        View transaction
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Info Footer */}
                <p className="text-center text-xs text-gray-500 mt-6">
                    This faucet is for Solana Devnet only. Tokens have no real value.
                </p>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Wallet } from "@coral-xyz/anchor";
import {
    fetchVaultData,
    VaultData,
    VAULTS,
    buildDepositTransaction,
    buildRequestWithdrawalTransaction,
    buildProcessWithdrawalTransaction,
    getUserShareBalance,
    getUserUnderlyingBalance,
    getUserWithdrawalRequest,
} from "../lib/vault-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export type TransactionStatus = "idle" | "building" | "signing" | "confirming" | "success" | "error";

interface UseVaultReturn {
    vaultData: VaultData | null;
    loading: boolean;
    error: string | null;

    // User balances
    userShareBalance: number;
    userUnderlyingBalance: number;
    pendingWithdrawal: { shares: number; requestEpoch: number; processed: boolean } | null;

    // Transaction methods
    deposit: (amount: number) => Promise<string>;
    requestWithdrawal: (shares: number) => Promise<string>;
    processWithdrawal: () => Promise<string>;

    // Transaction state
    txStatus: TransactionStatus;
    txError: string | null;
    txSignature: string | null;

    // Refresh
    refresh: () => Promise<void>;
}

/**
 * Hook to interact with a vault (read + write)
 */
export function useVault(assetId: string): UseVaultReturn {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [vaultData, setVaultData] = useState<VaultData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [userShareBalance, setUserShareBalance] = useState(0);
    const [userUnderlyingBalance, setUserUnderlyingBalance] = useState(0);
    const [pendingWithdrawal, setPendingWithdrawal] = useState<{ shares: number; requestEpoch: number; processed: boolean } | null>(null);

    const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
    const [txError, setTxError] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);

    const isInitialLoad = useRef(true);
    const lastVaultHash = useRef<string>("");

    // Fetch vault and user data
    const fetchData = useCallback(async () => {
        try {
            // Only show loading on initial load
            if (isInitialLoad.current) {
                setLoading(true);
            }
            setError(null);

            // Get normalized asset ID
            const normalizedAssetId = assetId.toUpperCase().endsWith('X')
                ? assetId.charAt(0).toUpperCase() + assetId.slice(1, -1).toUpperCase() + 'x'
                : assetId;

            const config = VAULTS[assetId.toLowerCase()];
            if (!config) {
                setVaultData(null);
                if (isInitialLoad.current) {
                    isInitialLoad.current = false;
                    setLoading(false);
                }
                return;
            }

            const data = await fetchVaultData(connection, config.assetId);

            // Only update if data changed
            const newHash = JSON.stringify(data);
            if (newHash !== lastVaultHash.current) {
                lastVaultHash.current = newHash;
                setVaultData(data);
            }

            // Fetch user balances if wallet connected
            if (wallet.publicKey) {
                const [shares, underlying] = await Promise.all([
                    getUserShareBalance(connection, wallet.publicKey, config.assetId),
                    getUserUnderlyingBalance(connection, wallet.publicKey, config.assetId),
                ]);

                // Only update if changed
                if (shares !== userShareBalance) setUserShareBalance(shares);
                if (underlying !== userUnderlyingBalance) setUserUnderlyingBalance(underlying);

                // Check for pending withdrawal
                if (wallet.signTransaction) {
                    const anchorWallet = {
                        publicKey: wallet.publicKey,
                        signTransaction: wallet.signTransaction,
                        signAllTransactions: wallet.signAllTransactions!,
                    } as Wallet;
                    const withdrawal = await getUserWithdrawalRequest(connection, anchorWallet, config.assetId);
                    setPendingWithdrawal(withdrawal);
                }
            }
        } catch (err: any) {
            console.error("Error fetching vault:", err);
            setError(err.message || "Failed to fetch vault data");
            setVaultData(null);
        } finally {
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
                setLoading(false);
            }
        }
    }, [assetId, connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Send transaction helper
    const sendTransaction = async (tx: Transaction): Promise<string> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error("Wallet not connected");
        }

        setTxStatus("signing");

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        // Sign transaction
        const signedTx = await wallet.signTransaction(tx);

        setTxStatus("confirming");

        // Send and confirm
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
        });

        setTxSignature(signature);
        setTxStatus("success");

        // Refresh data after transaction
        await fetchData();

        return signature;
    };

    // Deposit
    const deposit = async (amount: number): Promise<string> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error("Wallet not connected");
        }

        const config = VAULTS[assetId.toLowerCase()];
        if (!config) throw new Error("Unknown vault");

        try {
            setTxStatus("building");
            setTxError(null);
            setTxSignature(null);

            const anchorWallet = {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions!,
            } as Wallet;

            const tx = await buildDepositTransaction(
                connection,
                anchorWallet,
                config.assetId,
                amount
            );

            return await sendTransaction(tx);
        } catch (err: any) {
            console.error("Deposit error:", err);
            setTxStatus("error");
            setTxError(err.message || "Deposit failed");
            throw err;
        }
    };

    // Request withdrawal
    const requestWithdrawal = async (shares: number): Promise<string> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error("Wallet not connected");
        }

        const config = VAULTS[assetId.toLowerCase()];
        if (!config) throw new Error("Unknown vault");

        try {
            setTxStatus("building");
            setTxError(null);
            setTxSignature(null);

            const anchorWallet = {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions!,
            } as Wallet;

            const tx = await buildRequestWithdrawalTransaction(
                connection,
                anchorWallet,
                config.assetId,
                shares
            );

            return await sendTransaction(tx);
        } catch (err: any) {
            console.error("Request withdrawal error:", err);
            setTxStatus("error");
            setTxError(err.message || "Request withdrawal failed");
            throw err;
        }
    };

    // Process withdrawal
    const processWithdrawal = async (): Promise<string> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error("Wallet not connected");
        }

        const config = VAULTS[assetId.toLowerCase()];
        if (!config) throw new Error("Unknown vault");

        try {
            setTxStatus("building");
            setTxError(null);
            setTxSignature(null);

            const anchorWallet = {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions!,
            } as Wallet;

            const tx = await buildProcessWithdrawalTransaction(
                connection,
                anchorWallet,
                config.assetId
            );

            return await sendTransaction(tx);
        } catch (err: any) {
            console.error("Process withdrawal error:", err);
            setTxStatus("error");
            setTxError(err.message || "Process withdrawal failed");
            throw err;
        }
    };

    return {
        vaultData,
        loading,
        error,
        userShareBalance,
        userUnderlyingBalance,
        pendingWithdrawal,
        deposit,
        requestWithdrawal,
        processWithdrawal,
        txStatus,
        txError,
        txSignature,
        refresh: fetchData,
    };
}

/**
 * Hook to fetch all vaults' data (read-only)
 * Prevents visual re-renders by only updating when data changes
 */
export function useAllVaults() {
    const { connection } = useConnection();
    const [vaults, setVaults] = useState<Record<string, VaultData | null>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isInitialLoad = useRef(true);
    const lastDataHash = useRef<string>("");

    const fetchData = useCallback(async () => {
        try {
            // Only show loading on initial load, not refreshes
            if (isInitialLoad.current) {
                setLoading(true);
            }
            setError(null);

            const results: Record<string, VaultData | null> = {};

            for (const [key, config] of Object.entries(VAULTS)) {
                try {
                    const data = await fetchVaultData(connection, config.assetId);
                    results[key] = data;
                } catch (err) {
                    console.error(`Error fetching ${key}:`, err);
                    results[key] = null;
                }
            }

            // Only update state if data actually changed (prevents visual flicker)
            const newHash = JSON.stringify(results);
            if (newHash !== lastDataHash.current) {
                lastDataHash.current = newHash;
                setVaults(results);
            }
        } catch (err: any) {
            console.error("Error fetching vaults:", err);
            setError(err.message || "Failed to fetch vaults");
        } finally {
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
                setLoading(false);
            }
        }
    }, [connection]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { vaults, loading, error, refresh: fetchData };
}

/**
 * Hook to get total TVL across all vaults
 */
export function useTotalTVL() {
    const { vaults, loading } = useAllVaults();

    const totalTVL = Object.values(vaults).reduce((sum, vault) => {
        return sum + (vault?.tvl || 0);
    }, 0);

    return { totalTVL, loading };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VAULT_PROGRAM_ID } from "../lib/vault-sdk";

export interface WalletActivity {
    signature: string;
    type: "deposit" | "withdraw" | "withdrawal_request" | "unknown";
    timestamp: Date;
    slot: number;
    success: boolean;
    amount?: number;
    vaultId?: string;
}

/**
 * Hook to fetch real wallet activity involving our vault program
 */
export function useWalletActivity() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();

    const [activities, setActivities] = useState<WalletActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivity = useCallback(async () => {
        if (!publicKey) {
            setActivities([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch recent signatures for the wallet
            const signatures = await connection.getSignaturesForAddress(
                publicKey,
                { limit: 50 },
                "confirmed"
            );

            // Filter for transactions that might involve our program
            const relevantActivities: WalletActivity[] = [];

            for (const sig of signatures) {
                try {
                    // Get transaction details
                    const tx = await connection.getParsedTransaction(
                        sig.signature,
                        { maxSupportedTransactionVersion: 0 }
                    );

                    if (!tx || !tx.meta) continue;

                    // Check if this transaction involves our vault program
                    const accountKeys = tx.transaction.message.accountKeys;
                    const involvesVault = accountKeys.some(
                        (key) => key.pubkey.toString() === VAULT_PROGRAM_ID.toString()
                    );

                    if (!involvesVault) continue;

                    // Parse the transaction type from logs
                    const logs = tx.meta.logMessages || [];
                    let type: WalletActivity["type"] = "unknown";
                    let amount: number | undefined;

                    for (const log of logs) {
                        if (log.includes("Instruction: Deposit")) {
                            type = "deposit";
                        } else if (log.includes("Instruction: RequestWithdrawal")) {
                            type = "withdrawal_request";
                        } else if (log.includes("Instruction: ProcessWithdrawal")) {
                            type = "withdraw";
                        }
                    }

                    // Try to extract amount from token balance changes
                    const preBalances = tx.meta.preTokenBalances || [];
                    const postBalances = tx.meta.postTokenBalances || [];

                    for (let i = 0; i < postBalances.length; i++) {
                        const post = postBalances[i];
                        const pre = preBalances.find(
                            (p) => p.accountIndex === post.accountIndex
                        );

                        if (post.owner === publicKey.toString()) {
                            const postAmount = parseFloat(post.uiTokenAmount.uiAmountString || "0");
                            const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmountString || "0") : 0;
                            const change = Math.abs(postAmount - preAmount);
                            if (change > 0) {
                                amount = change;
                            }
                        }
                    }

                    relevantActivities.push({
                        signature: sig.signature,
                        type,
                        timestamp: new Date((sig.blockTime || 0) * 1000),
                        slot: sig.slot,
                        success: sig.err === null,
                        amount,
                    });
                } catch (txErr) {
                    // Skip individual transaction errors
                    console.warn("Error parsing tx:", sig.signature, txErr);
                }
            }

            setActivities(relevantActivities);
        } catch (err: any) {
            console.error("Error fetching wallet activity:", err);
            setError(err.message || "Failed to fetch activity");
        } finally {
            setLoading(false);
        }
    }, [connection, publicKey]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    return {
        activities,
        loading,
        error,
        refresh: fetchActivity,
    };
}

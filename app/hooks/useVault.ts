"use client";

import { useState, useEffect } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchVaultData, fetchAllVaults, VaultData, VAULTS, deriveVaultPda } from "../lib/vault-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

/**
 * Hook to fetch a single vault's data
 */
export function useVault(symbol: string) {
    const [vaultData, setVaultData] = useState<VaultData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const config = VAULTS[symbol];
                if (!config) {
                    throw new Error(`Unknown vault: ${symbol}`);
                }

                const connection = new Connection(RPC_URL, "confirmed");

                // Derive vault PDA
                const [vaultPda] = deriveVaultPda(config.underlyingMint);

                const data = await fetchVaultData(connection, vaultPda);
                if (data) {
                    data.symbol = symbol;
                }

                setVaultData(data);
            } catch (err: any) {
                console.error("Error fetching vault:", err);
                setError(err.message || "Failed to fetch vault data");
                setVaultData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [symbol]);

    return { vaultData, loading, error };
}

/**
 * Hook to fetch all vaults' data
 */
export function useAllVaults() {
    const [vaults, setVaults] = useState<Record<string, VaultData | null>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const connection = new Connection(RPC_URL, "confirmed");

                // Fetch all vaults with derived PDAs
                const results: Record<string, VaultData | null> = {};

                for (const [symbol, config] of Object.entries(VAULTS)) {
                    try {
                        const [vaultPda] = deriveVaultPda(config.underlyingMint);
                        const data = await fetchVaultData(connection, vaultPda);
                        if (data) {
                            data.symbol = symbol;
                        }
                        results[symbol] = data;
                    } catch (err) {
                        console.error(`Error fetching ${symbol}:`, err);
                        results[symbol] = null;
                    }
                }

                setVaults(results);
            } catch (err: any) {
                console.error("Error fetching vaults:", err);
                setError(err.message || "Failed to fetch vaults");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return { vaults, loading, error };
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

import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Vault } from "../../target/types/vault";

// Program IDs on devnet
export const VAULT_PROGRAM_ID = new PublicKey(
    "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
);

export const ORACLE_PROGRAM_ID = new PublicKey(
    "5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk"
);

export const RFQ_PROGRAM_ID = new PublicKey(
    "3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z"
);

// Vault configuration for each xStock
export interface VaultConfig {
    symbol: string;
    underlyingMint: PublicKey;
    vaultPda?: PublicKey;
}

export const VAULTS: Record<string, VaultConfig> = {
    NVDAx: {
        symbol: "NVDAx",
        underlyingMint: new PublicKey("11111111111111111111111111111111"), // Placeholder - replace with actual USDC mint
    },
    TSLAx: {
        symbol: "TSLAx",
        underlyingMint: new PublicKey("11111111111111111111111111111111"),
    },
    SPYx: {
        symbol: "SPYx",
        underlyingMint: new PublicKey("11111111111111111111111111111111"),
    },
    AAPLx: {
        symbol: "AAPLx",
        underlyingMint: new PublicKey("11111111111111111111111111111111"),
    },
    METAx: {
        symbol: "METAx",
        underlyingMint: new PublicKey("11111111111111111111111111111111"),
    },
};

export interface VaultData {
    symbol: string;
    authority: string;
    underlyingMint: string;
    shareMint: string;
    vaultTokenAccount: string;
    epoch: number;
    totalAssets: string;
    totalShares: string;
    sharePrice: number;
    apy: number;
    tvl: number;
}

/**
 * Fetch vault data from on-chain
 */
export async function fetchVaultData(
    connection: Connection,
    vaultPda: PublicKey
): Promise<VaultData | null> {
    try {
        // Create a dummy wallet for read-only operations
        const dummyWallet = {
            publicKey: PublicKey.default,
            signTransaction: async () => { throw new Error("Not implemented"); },
            signAllTransactions: async () => { throw new Error("Not implemented"); },
        } as unknown as Wallet;

        const provider = new AnchorProvider(connection, dummyWallet, {
            commitment: "confirmed",
        });

        const program = new Program(
            require("../../target/idl/vault.json"),
            provider
        ) as Program<Vault>;

        const vaultAccount = await program.account.vault.fetch(vaultPda);

        // Calculate share price (totalAssets / totalShares)
        const totalAssets = Number(vaultAccount.totalAssets);
        const totalShares = Number(vaultAccount.totalShares);
        const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1.0;

        // Mock APY and TVL for now
        const apy = 12.5; // TODO: Calculate from historical data
        const tvl = totalAssets / 1e6; // Assuming 6 decimals for USDC

        return {
            symbol: "Unknown", // Will be set by caller
            authority: vaultAccount.authority.toBase58(),
            underlyingMint: vaultAccount.underlyingMint.toBase58(),
            shareMint: vaultAccount.shareMint.toBase58(),
            vaultTokenAccount: vaultAccount.vaultTokenAccount.toBase58(),
            epoch: Number(vaultAccount.epoch),
            totalAssets: vaultAccount.totalAssets.toString(),
            totalShares: vaultAccount.totalShares.toString(),
            sharePrice,
            apy,
            tvl,
        };
    } catch (error) {
        console.error("Error fetching vault data:", error);
        return null;
    }
}

/**
 * Fetch all vaults data
 */
export async function fetchAllVaults(
    connection: Connection
): Promise<Record<string, VaultData | null>> {
    const results: Record<string, VaultData | null> = {};

    for (const [symbol, config] of Object.entries(VAULTS)) {
        if (config.vaultPda) {
            const data = await fetchVaultData(connection, config.vaultPda);
            if (data) {
                data.symbol = symbol;
            }
            results[symbol] = data;
        } else {
            results[symbol] = null;
        }
    }

    return results;
}

/**
 * Derive vault PDA for a given underlying mint
 */
export function deriveVaultPda(underlyingMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), underlyingMint.toBuffer()],
        VAULT_PROGRAM_ID
    );
}

import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import vaultIdl from "../anchor/vault_idl.json";

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
    assetId: string;  // Used for PDA derivation
    underlyingMint: PublicKey;
}

// Using devnet USDC as placeholder
const DEVNET_USDC = new PublicKey("D6wYCkoFg1PyQn1fX21Vv2Z1h1M5oSSK26AHtRvahdTB");

export const VAULTS: Record<string, VaultConfig> = {
    nvdax: {
        symbol: "NVDAx",
        assetId: "NVDAx",
        underlyingMint: DEVNET_USDC,
    },
    tslax: {
        symbol: "TSLAx",
        assetId: "TSLAx",
        underlyingMint: DEVNET_USDC,
    },
    spyx: {
        symbol: "SPYx",
        assetId: "SPYx",
        underlyingMint: DEVNET_USDC,
    },
    aaplx: {
        symbol: "AAPLx",
        assetId: "AAPLx",
        underlyingMint: DEVNET_USDC,
    },
    metax: {
        symbol: "METAx",
        assetId: "METAx",
        underlyingMint: DEVNET_USDC,
    },
};

export interface VaultData {
    publicKey: string;
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
    utilizationCapBps: number;
    pendingWithdrawals: string;
    // Notional exposure tracking (fractional options)
    epochNotionalExposed: string;      // Total tokens exposed to options this epoch
    epochPremiumEarned: string;        // Total premium earned this epoch
    epochPremiumPerTokenBps: number;   // Average premium rate in basis points
}

/**
 * Derive vault PDA for a given asset ID
 */
export function deriveVaultPda(assetId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        VAULT_PROGRAM_ID
    );
}

/**
 * Derive share mint PDA for a vault
 */
export function deriveShareMintPda(vaultPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("shares"), vaultPda.toBuffer()],
        VAULT_PROGRAM_ID
    );
}

/**
 * Derive vault token account PDA
 */
export function deriveVaultTokenAccountPda(vaultPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault_tokens"), vaultPda.toBuffer()],
        VAULT_PROGRAM_ID
    );
}

/**
 * Derive withdrawal request PDA
 */
export function deriveWithdrawalPda(vaultPda: PublicKey, userPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("withdrawal"), vaultPda.toBuffer(), userPubkey.toBuffer()],
        VAULT_PROGRAM_ID
    );
}

/**
 * Get the vault program instance
 */
export function getVaultProgram(provider: AnchorProvider): any {
    return new Program(vaultIdl as any, provider);
}

/**
 * Fetch vault data from on-chain with retry logic
 */
export async function fetchVaultData(
    connection: Connection,
    assetId: string,
    retries = 3
): Promise<VaultData | null> {
    const [vaultPda] = deriveVaultPda(assetId);

    // Create a dummy wallet for read-only operations
    const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error("Not implemented"); },
        signAllTransactions: async () => { throw new Error("Not implemented"); },
    } as unknown as Wallet;

    const provider = new AnchorProvider(connection, dummyWallet, {
        commitment: "confirmed",
    });

    const program = getVaultProgram(provider);

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const vaultAccount = await program.account.vault.fetch(vaultPda);

            // Calculate share price (totalAssets / totalShares)
            const totalAssets = Number(vaultAccount.totalAssets);
            const totalShares = Number(vaultAccount.totalShares);
            const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1.0;

            // Mock APY for now - will calculate from historical data
            const apy = 12.5;
            const tvl = totalAssets / 1e6; // Assuming 6 decimals

            return {
                publicKey: vaultPda.toBase58(),
                symbol: assetId,
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
                utilizationCapBps: Number(vaultAccount.utilizationCapBps),
                pendingWithdrawals: vaultAccount.pendingWithdrawals.toString(),
                // Notional exposure tracking (with fallbacks for existing vaults)
                epochNotionalExposed: (vaultAccount.epochNotionalExposed || 0).toString(),
                epochPremiumEarned: (vaultAccount.epochPremiumEarned || 0).toString(),
                epochPremiumPerTokenBps: Number(vaultAccount.epochPremiumPerTokenBps || 0),
            };
        } catch (error) {
            lastError = error as Error;
            console.warn(`Vault fetch attempt ${attempt + 1}/${retries} failed:`, error);

            // Wait before retry with exponential backoff (500ms, 1s, 2s)
            if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            }
        }
    }

    // All retries failed
    console.error("All vault fetch attempts failed:", lastError);
    return null;
}


/**
 * Build a deposit transaction
 */
export async function buildDepositTransaction(
    connection: Connection,
    wallet: Wallet,
    assetId: string,
    amount: number // in base units (e.g., 1_000_000 for 1 USDC)
): Promise<Transaction> {
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = getVaultProgram(provider);

    const config = Object.values(VAULTS).find(v => v.assetId === assetId);
    if (!config) throw new Error(`Unknown vault: ${assetId}`);

    const [vaultPda] = deriveVaultPda(assetId);
    const [shareMintPda] = deriveShareMintPda(vaultPda);
    const [vaultTokenAccountPda] = deriveVaultTokenAccountPda(vaultPda);

    // Get user's token account for the underlying asset
    const userTokenAccount = await getAssociatedTokenAddress(
        config.underlyingMint,
        wallet.publicKey
    );

    // Get user's share token account (create if needed)
    const userShareAccount = await getAssociatedTokenAddress(
        shareMintPda,
        wallet.publicKey
    );

    const tx = new Transaction();

    // Check if user share account exists, create if not
    try {
        await connection.getAccountInfo(userShareAccount);
    } catch {
        tx.add(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                userShareAccount,
                wallet.publicKey,
                shareMintPda
            )
        );
    }

    // Check if account exists and has no data (doesn't exist yet)
    const shareAccountInfo = await connection.getAccountInfo(userShareAccount);
    if (!shareAccountInfo) {
        tx.add(
            createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                userShareAccount,
                wallet.publicKey,
                shareMintPda
            )
        );
    }

    // Build deposit instruction
    const depositIx = await program.methods
        .deposit(new BN(amount))
        .accounts({
            vault: vaultPda,
            shareMint: shareMintPda,
            vaultTokenAccount: vaultTokenAccountPda,
            userTokenAccount: userTokenAccount,
            userShareAccount: userShareAccount,
            user: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    tx.add(depositIx);

    return tx;
}

/**
 * Build a request withdrawal transaction
 */
export async function buildRequestWithdrawalTransaction(
    connection: Connection,
    wallet: Wallet,
    assetId: string,
    shares: number // in base units
): Promise<Transaction> {
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = getVaultProgram(provider);

    const [vaultPda] = deriveVaultPda(assetId);
    const [shareMintPda] = deriveShareMintPda(vaultPda);
    const [withdrawalPda] = deriveWithdrawalPda(vaultPda, wallet.publicKey);

    const userShareAccount = await getAssociatedTokenAddress(
        shareMintPda,
        wallet.publicKey
    );

    const tx = new Transaction();

    const requestWithdrawalIx = await program.methods
        .requestWithdrawal(new BN(shares))
        .accounts({
            vault: vaultPda,
            withdrawalRequest: withdrawalPda,
            userShareAccount: userShareAccount,
            user: wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    tx.add(requestWithdrawalIx);

    return tx;
}

/**
 * Build a process withdrawal transaction (after epoch settles)
 */
export async function buildProcessWithdrawalTransaction(
    connection: Connection,
    wallet: Wallet,
    assetId: string
): Promise<Transaction> {
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = getVaultProgram(provider);

    const config = Object.values(VAULTS).find(v => v.assetId === assetId);
    if (!config) throw new Error(`Unknown vault: ${assetId}`);

    const [vaultPda] = deriveVaultPda(assetId);
    const [shareMintPda] = deriveShareMintPda(vaultPda);
    const [vaultTokenAccountPda] = deriveVaultTokenAccountPda(vaultPda);
    const [withdrawalPda] = deriveWithdrawalPda(vaultPda, wallet.publicKey);

    const userTokenAccount = await getAssociatedTokenAddress(
        config.underlyingMint,
        wallet.publicKey
    );

    const userShareAccount = await getAssociatedTokenAddress(
        shareMintPda,
        wallet.publicKey
    );

    const tx = new Transaction();

    const processWithdrawalIx = await program.methods
        .processWithdrawal()
        .accounts({
            vault: vaultPda,
            withdrawalRequest: withdrawalPda,
            shareMint: shareMintPda,
            vaultTokenAccount: vaultTokenAccountPda,
            userTokenAccount: userTokenAccount,
            userShareAccount: userShareAccount,
            user: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

    tx.add(processWithdrawalIx);

    return tx;
}

/**
 * Get user's share balance for a vault
 */
export async function getUserShareBalance(
    connection: Connection,
    userPubkey: PublicKey,
    assetId: string
): Promise<number> {
    try {
        const [vaultPda] = deriveVaultPda(assetId);
        const [shareMintPda] = deriveShareMintPda(vaultPda);

        const userShareAccount = await getAssociatedTokenAddress(
            shareMintPda,
            userPubkey
        );

        const accountInfo = await connection.getTokenAccountBalance(userShareAccount);
        return Number(accountInfo.value.amount);
    } catch {
        return 0;
    }
}

/**
 * Get user's underlying token balance
 */
export async function getUserUnderlyingBalance(
    connection: Connection,
    userPubkey: PublicKey,
    assetId: string
): Promise<number> {
    try {
        const config = Object.values(VAULTS).find(v => v.assetId === assetId);
        if (!config) return 0;

        const userTokenAccount = await getAssociatedTokenAddress(
            config.underlyingMint,
            userPubkey
        );

        const accountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        return Number(accountInfo.value.amount);
    } catch {
        return 0;
    }
}

/**
 * Check if user has a pending withdrawal request
 */
export async function getUserWithdrawalRequest(
    connection: Connection,
    wallet: Wallet,
    assetId: string
): Promise<{ shares: number; requestEpoch: number; processed: boolean } | null> {
    try {
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
        const program = getVaultProgram(provider);

        const [vaultPda] = deriveVaultPda(assetId);
        const [withdrawalPda] = deriveWithdrawalPda(vaultPda, wallet.publicKey);

        const withdrawalAccount = await program.account.withdrawalRequest.fetch(withdrawalPda);

        return {
            shares: Number(withdrawalAccount.shares),
            requestEpoch: Number(withdrawalAccount.requestEpoch),
            processed: withdrawalAccount.processed,
        };
    } catch {
        return null;
    }
}

/**
 * Build a transaction to advance the epoch (Keeper only)
 */
export async function buildAdvanceEpochTransaction(
    connection: Connection,
    wallet: Wallet,
    assetId: string,
    premiumEarned: number = 0
): Promise<Transaction> {
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = getVaultProgram(provider);

    const [vaultPda] = deriveVaultPda(assetId);

    const tx = new Transaction();

    const advanceEpochIx = await program.methods
        .advanceEpoch(new BN(premiumEarned))
        .accounts({
            vault: vaultPda,
            authority: wallet.publicKey,
        })
        .instruction();

    tx.add(advanceEpochIx);

    return tx;
}

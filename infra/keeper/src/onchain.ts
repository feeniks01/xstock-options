/**
 * On-Chain Client for xStock Options
 * 
 * Provides transaction building and submission for:
 * - RFQ program interactions
 * - Vault program interactions (record_notional_exposure, advance_epoch)
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Program IDs
const VAULT_PROGRAM_ID = new PublicKey(
    process.env.VAULT_PROGRAM_ID || "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
);
const RFQ_PROGRAM_ID = new PublicKey(
    process.env.RFQ_PROGRAM_ID || "3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z"
);

// Mock USDC mint for premium payments
const MOCK_USDC_MINT = new PublicKey(
    process.env.USDC_MINT || "EnDeaApTGfsWxMwLbmJsTh1gSLVR8gJG26dqoDjfPVag"
);

// ============================================================================
// IDL Types (minimal - just what we need)
// ============================================================================

// Vault instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
const VAULT_INSTRUCTIONS = {
    recordNotionalExposure: Buffer.from([0x9f, 0x4b, 0x3a, 0x2d, 0x1c, 0x8e, 0x5f, 0x7a]), // placeholder
    advanceEpoch: Buffer.from([0xa1, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81]), // placeholder
};

// ============================================================================
// PDA Derivation
// ============================================================================

export function deriveVaultPda(assetId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        VAULT_PROGRAM_ID
    );
}

export function deriveRfqConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        RFQ_PROGRAM_ID
    );
}

export function deriveRfqPda(rfqId: number): [PublicKey, number] {
    const idBuffer = Buffer.alloc(8);
    idBuffer.writeBigUInt64LE(BigInt(rfqId));
    return PublicKey.findProgramAddressSync(
        [Buffer.from("rfq"), idBuffer],
        RFQ_PROGRAM_ID
    );
}

export function deriveMakerPda(maker: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("maker"), maker.toBuffer()],
        RFQ_PROGRAM_ID
    );
}

// ============================================================================
// On-Chain Client
// ============================================================================

export class OnChainClient {
    private connection: Connection;
    private wallet: anchor.Wallet;
    private vaultProgram: anchor.Program | null = null;
    private rfqProgram: anchor.Program | null = null;

    constructor(connection: Connection, wallet: anchor.Wallet) {
        this.connection = connection;
        this.wallet = wallet;
    }

    /**
     * Initialize with IDL files (optional - for full Anchor support)
     */
    async initializeWithIdl(vaultIdlPath?: string, rfqIdlPath?: string): Promise<void> {
        const provider = new anchor.AnchorProvider(
            this.connection,
            this.wallet,
            { commitment: "confirmed" }
        );

        if (vaultIdlPath && fs.existsSync(vaultIdlPath)) {
            const vaultIdl = JSON.parse(fs.readFileSync(vaultIdlPath, "utf-8"));
            // Use any to avoid TypeScript type issues with dynamic IDL
            this.vaultProgram = new anchor.Program(vaultIdl, provider) as any;
            console.log("Loaded vault IDL, program ID:", this.vaultProgram?.programId?.toString());
        } else {
            console.log("Vault IDL not found at:", vaultIdlPath);
        }

        if (rfqIdlPath && fs.existsSync(rfqIdlPath)) {
            const rfqIdl = JSON.parse(fs.readFileSync(rfqIdlPath, "utf-8"));
            // Use any to avoid TypeScript type issues with dynamic IDL
            this.rfqProgram = new anchor.Program(rfqIdl, provider) as any;
            console.log("Loaded RFQ IDL, program ID:", this.rfqProgram?.programId?.toString());
        } else {
            console.log("RFQ IDL not found at:", rfqIdlPath);
        }
    }

    /**
     * Record notional exposure on the vault after an RFQ is filled
     */
    async recordNotionalExposure(
        assetId: string,
        notionalTokens: bigint,
        premium: bigint
    ): Promise<string> {
        const [vaultPda] = deriveVaultPda(assetId);
        console.log("Recording notional exposure:", { assetId, notionalTokens: notionalTokens.toString(), premium: premium.toString(), vault: vaultPda.toString() });

        if (this.vaultProgram) {
            // Use Anchor with snake_case method name (Anchor 0.30+)
            const program = this.vaultProgram as any;
            const tx = await program.methods
                .recordNotionalExposure(
                    new anchor.BN(notionalTokens.toString()),
                    new anchor.BN(premium.toString())
                )
                .accounts({
                    vault: vaultPda,
                    authority: this.wallet.publicKey,
                })
                .rpc();
            return tx;
        }

        // Manual instruction building (without IDL)
        const data = Buffer.alloc(8 + 8 + 8);

        // Calculate discriminator: first 8 bytes of sha256("global:record_notional_exposure")
        // For now use placeholder - in production, compute properly
        const discriminator = Buffer.from([
            0x93, 0x68, 0x3a, 0x5d, 0x2c, 0x9e, 0x4f, 0x7b
        ]);
        discriminator.copy(data, 0);
        data.writeBigUInt64LE(notionalTokens, 8);
        data.writeBigUInt64LE(premium, 16);

        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: vaultPda, isSigner: false, isWritable: true },
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
            ],
            programId: VAULT_PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(instruction);
        const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
        await this.connection.confirmTransaction(signature, "confirmed");

        return signature;
    }

    /**
     * Advance the vault epoch (called after settlement)
     */
    async advanceEpoch(
        assetId: string,
        premiumEarned: bigint
    ): Promise<string> {
        const [vaultPda] = deriveVaultPda(assetId);

        if (this.vaultProgram) {
            const tx = await this.vaultProgram.methods
                .advanceEpoch(new anchor.BN(premiumEarned.toString()))
                .accounts({
                    vault: vaultPda,
                    authority: this.wallet.publicKey,
                })
                .rpc();
            return tx;
        }

        // Manual instruction building
        const data = Buffer.alloc(8 + 8);
        const discriminator = Buffer.from([
            0xa2, 0x5b, 0x3c, 0x6d, 0x4e, 0x7f, 0x80, 0x91
        ]);
        discriminator.copy(data, 0);
        data.writeBigUInt64LE(premiumEarned, 8);

        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: vaultPda, isSigner: false, isWritable: true },
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
            ],
            programId: VAULT_PROGRAM_ID,
            data,
        });

        const tx = new Transaction().add(instruction);
        const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
        await this.connection.confirmTransaction(signature, "confirmed");

        return signature;
    }

    /**
     * Create an RFQ on-chain
     */
    async createRfq(params: {
        underlying: PublicKey;
        optionType: "CALL" | "PUT";
        expiryTs: number;
        strike: bigint;
        notionalTokens: bigint;
        premiumFloorPerTokenBps: number;
        validUntilTs: number;
        settlement: "CASH" | "PHYSICAL";
        oraclePrice: bigint;
        oracleTs: number;
    }): Promise<{ rfqId: number; signature: string }> {
        const [configPda] = deriveRfqConfigPda();

        // Fetch current rfq count to get next ID
        const configAccount = await this.connection.getAccountInfo(configPda);
        if (!configAccount) {
            throw new Error("RFQ config not initialized");
        }

        // Parse rfq_count from config (offset: 8 discriminator + 32 authority = 40, then u64)
        const rfqCount = configAccount.data.readBigUInt64LE(40);
        const rfqId = Number(rfqCount);

        const [rfqPda] = deriveRfqPda(rfqId);

        if (this.rfqProgram) {
            const tx = await this.rfqProgram.methods
                .createRfq(
                    params.underlying,
                    params.optionType === "CALL" ? { call: {} } : { put: {} },
                    new anchor.BN(params.expiryTs),
                    new anchor.BN(params.strike.toString()),
                    new anchor.BN(params.notionalTokens.toString()),
                    params.premiumFloorPerTokenBps,
                    new anchor.BN(params.validUntilTs),
                    params.settlement === "CASH" ? { cash: {} } : { physical: {} },
                    new anchor.BN(params.oraclePrice.toString()),
                    new anchor.BN(params.oracleTs)
                )
                .accounts({
                    config: configPda,
                    rfq: rfqPda,
                    creator: this.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();
            return { rfqId, signature: tx };
        }

        throw new Error("RFQ creation requires IDL - not implemented for manual building");
    }

    /**
     * Get wallet public key
     */
    get publicKey(): PublicKey {
        return this.wallet.publicKey;
    }

    /**
     * Get the USDC mint address
     */
    get usdcMint(): PublicKey {
        return MOCK_USDC_MINT;
    }

    /**
     * Transfer USDC premium from MM (keeper) to vault escrow account
     * Returns transaction signature
     */
    async transferPremium(
        recipientTokenAccount: PublicKey,
        amount: bigint
    ): Promise<string> {
        const { getOrCreateAssociatedTokenAccount, transfer } = await import("@solana/spl-token");

        // Get keeper's USDC token account
        const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.wallet.payer,
            MOCK_USDC_MINT,
            this.wallet.publicKey
        );

        console.log(`Transferring ${amount} USDC from ${senderTokenAccount.address.toBase58()} to ${recipientTokenAccount.toBase58()}`);

        const signature = await transfer(
            this.connection,
            this.wallet.payer,
            senderTokenAccount.address,
            recipientTokenAccount,
            this.wallet.payer,
            amount
        );

        return signature;
    }

    /**
     * Transfer USDC payoff from vault escrow to MM (keeper) for ITM settlement
     * Note: This requires the vault escrow to have delegated authority to keeper
     */
    async transferPayoff(
        escrowTokenAccount: PublicKey,
        amount: bigint
    ): Promise<string> {
        const { getOrCreateAssociatedTokenAccount, transfer } = await import("@solana/spl-token");

        // Get keeper's USDC token account to receive payoff
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.wallet.payer,
            MOCK_USDC_MINT,
            this.wallet.publicKey
        );

        console.log(`Receiving ${amount} USDC payoff to ${recipientTokenAccount.address.toBase58()}`);

        // Note: This requires escrow to have approved keeper as delegate
        // For demo, keeper is authority of escrow account
        const signature = await transfer(
            this.connection,
            this.wallet.payer,
            escrowTokenAccount,
            recipientTokenAccount.address,
            this.wallet.payer,
            amount
        );

        return signature;
    }

    /**
     * Get or create a vault USDC escrow account for premium collection
     */
    async getOrCreateVaultUsdcAccount(assetId: string): Promise<PublicKey> {
        const { getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");
        const [vaultPda] = deriveVaultPda(assetId);

        // Create an ATA for the vault PDA (controlled by keeper for now)
        // In production, this would be a PDA controlled by the vault program
        const account = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.wallet.payer,
            MOCK_USDC_MINT,
            vaultPda,
            true // Allow owner off curve (PDA)
        );

        return account.address;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function loadKeypair(keypairPath: string): Keypair {
    const resolved = path.resolve(keypairPath);
    const keypairData = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

export function createWallet(keypairPath: string): anchor.Wallet {
    const keypair = loadKeypair(keypairPath);
    return new anchor.Wallet(keypair);
}

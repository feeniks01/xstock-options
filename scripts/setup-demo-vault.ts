/**
 * Setup Demo Vault
 * 
 * Creates a fresh vault with YOUR wallet as authority.
 * No Solana CLI needed - just provide your keypair.
 * 
 * Usage:
 *   1. Export your Phantom private key and save as JSON array
 *   2. Run: KEYPAIR=./my-wallet.json npx ts-node scripts/setup-demo-vault.ts
 * 
 * Or if you have ~/.config/solana/id.json:
 *   npx ts-node scripts/setup-demo-vault.ts
 */

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
    createMint, 
    getOrCreateAssociatedTokenAccount, 
    mintTo,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const VAULT_PROGRAM_ID = new PublicKey("8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY");

// Load keypair from file
function loadKeypair(): Keypair {
    // Check env var first
    const keypairPath = process.env.KEYPAIR || path.join(os.homedir(), ".config/solana/id.json");
    
    if (!fs.existsSync(keypairPath)) {
        console.error(`\n❌ Keypair not found at: ${keypairPath}`);
        console.error(`\nTo use your Phantom wallet:`);
        console.error(`1. In Phantom: Settings → Security → Export Private Key`);
        console.error(`2. Convert to JSON array format (see below)`);
        console.error(`3. Save to a file like 'my-wallet.json'`);
        console.error(`4. Run: KEYPAIR=./my-wallet.json npx ts-node scripts/setup-demo-vault.ts`);
        process.exit(1);
    }
    
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

async function main() {
    console.log("\n🚀 xStock Options - Demo Vault Setup");
    console.log("=====================================\n");

    const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
    );

    // Load your keypair
    const keypair = loadKeypair();
    const wallet: Wallet = {
        publicKey: keypair.publicKey,
        signTransaction: async (tx) => { tx.sign(keypair); return tx; },
        signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign(keypair)); return txs; },
        payer: keypair
    } as any;

    console.log(`Your Wallet: ${keypair.publicKey.toBase58()}`);

    // Check SOL balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
        console.error(`\n❌ Not enough SOL! Need at least 0.1 SOL for setup.`);
        console.error(`\nGet devnet SOL:`);
        console.error(`1. Go to https://faucet.solana.com`);
        console.error(`2. Enter your wallet: ${keypair.publicKey.toBase58()}`);
        console.error(`3. Request airdrop`);
        console.error(`4. Run this script again`);
        process.exit(1);
    }

    // Use a unique asset ID to avoid conflicts
    const timestamp = Date.now().toString().slice(-6);
    const assetId = `DEMO${timestamp}`;
    
    console.log(`\n📦 Creating vault for asset: ${assetId}`);

    // Step 1: Create token mint
    console.log(`\n1️⃣ Creating token mint...`);
    const tokenMint = await createMint(
        connection,
        keypair,
        keypair.publicKey,  // Mint authority = you
        null,               // No freeze authority
        6                   // 6 decimals
    );
    console.log(`   Token Mint: ${tokenMint.toBase58()}`);

    // Step 2: Mint some tokens to yourself
    console.log(`\n2️⃣ Minting 10,000 tokens to your wallet...`);
    const yourTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        tokenMint,
        keypair.publicKey
    );
    
    await mintTo(
        connection,
        keypair,
        tokenMint,
        yourTokenAccount.address,
        keypair,
        10_000 * 1e6  // 10,000 tokens
    );
    console.log(`   Your Token Account: ${yourTokenAccount.address.toBase58()}`);
    console.log(`   Balance: 10,000 tokens`);

    // Step 3: Initialize vault
    console.log(`\n3️⃣ Initializing vault...`);
    
    // Load IDL
    const idlPath = path.join(__dirname, "../app/anchor/vault_idl.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program(idl, provider);

    // Derive PDAs
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        VAULT_PROGRAM_ID
    );
    const [shareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shares"), vaultPda.toBuffer()],
        VAULT_PROGRAM_ID
    );
    const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_tokens"), vaultPda.toBuffer()],
        VAULT_PROGRAM_ID
    );

    console.log(`   Vault PDA: ${vaultPda.toBase58()}`);

    try {
        const tx = await (program.methods as any)
            .initializeVault(assetId, 7500)  // 75% utilization cap
            .accounts({
                vault: vaultPda,
                underlyingMint: tokenMint,
                shareMint: shareMintPda,
                vaultTokenAccount: vaultTokenAccountPda,
                authority: keypair.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .rpc();

        console.log(`   ✅ Vault created! Tx: ${tx}`);
    } catch (error: any) {
        if (error.message?.includes("already in use")) {
            console.log(`   ⚠️ Vault already exists, continuing...`);
        } else {
            throw error;
        }
    }

    // Step 4: Generate .env.local content
    console.log(`\n4️⃣ Configuration for your app:`);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Add to app/.env.local:`);
    console.log(`${"=".repeat(60)}`);
    const keypairArray = JSON.stringify(Array.from(keypair.secretKey));
    console.log(`MINT_AUTHORITY_PRIVATE_KEY=${keypairArray}`);
    console.log(`${"=".repeat(60)}`);

    // Step 5: Update vault-sdk.ts config
    console.log(`\n5️⃣ Add this vault to app/lib/vault-sdk.ts:`);
    console.log(`${"=".repeat(60)}`);
    console.log(`
// Add to VAULTS object:
demo: {
    symbol: "${assetId}",
    assetId: "${assetId}",
    underlyingMint: new PublicKey("${tokenMint.toBase58()}"),
},
`);
    console.log(`${"=".repeat(60)}`);

    // Summary
    console.log(`\n✅ SETUP COMPLETE!`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Asset ID: ${assetId}`);
    console.log(`Token Mint: ${tokenMint.toBase58()}`);
    console.log(`Vault PDA: ${vaultPda.toBase58()}`);
    console.log(`Your Wallet: ${keypair.publicKey.toBase58()}`);
    console.log(`Your Balance: 10,000 tokens`);
    console.log(`${"=".repeat(60)}`);
    
    console.log(`\n📝 Next Steps:`);
    console.log(`1. Copy the MINT_AUTHORITY_PRIVATE_KEY to app/.env.local`);
    console.log(`2. Add the vault config to app/lib/vault-sdk.ts`);
    console.log(`3. Restart the frontend: cd app && pnpm dev`);
    console.log(`4. Visit http://localhost:3000/v2/earn/${assetId.toLowerCase()}`);
    console.log(`5. Deposit some tokens`);
    console.log(`6. Run: npx ts-node scripts/demo-epoch.ts --asset=${assetId}`);
    console.log(`\n`);
}

main().catch((error) => {
    console.error("\n❌ Setup failed:", error.message);
    if (error.logs) {
        console.error("Program logs:", error.logs.slice(-5));
    }
    process.exit(1);
});


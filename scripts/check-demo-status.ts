/**
 * Check Demo Status
 * 
 * Quick health check for hackathon demo readiness
 * Uses IDL from app/anchor (no anchor build needed)
 * 
 * Usage: npx ts-node scripts/check-demo-status.ts
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const VAULT_PROGRAM_ID = new PublicKey("8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY");

// Load wallet from default solana config
function loadLocalWallet(): Wallet {
    const keypairPath = path.join(os.homedir(), ".config/solana/id.json");
    if (!fs.existsSync(keypairPath)) {
        throw new Error("No wallet found at ~/.config/solana/id.json");
    }
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const { Keypair } = require("@solana/web3.js");
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    return { publicKey: keypair.publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs, payer: keypair } as any;
}

async function main() {
    console.log("\n🔍 xStock Options - Demo Status Check");
    console.log("=====================================\n");

    const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
    );
    
    let wallet: Wallet;
    try {
        wallet = loadLocalWallet();
        console.log(`Admin Wallet: ${wallet.publicKey.toBase58()}`);
    } catch (e: any) {
        console.log("⚠️  No wallet found at ~/.config/solana/id.json");
        console.log("   Run: solana-keygen new");
        return;
    }

    // Check SOL balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`SOL Balance: ${(balance / 1e9).toFixed(4)} SOL`);
    
    if (balance < 0.1 * 1e9) {
        console.log("⚠️  Low SOL! Run: solana airdrop 2");
    }

    // Load vault IDL from app/anchor
    const idlPath = path.join(__dirname, "../app/anchor/vault_idl.json");
    let idl: any;
    try {
        idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
        console.log("\n✅ Vault IDL found at app/anchor/vault_idl.json");
    } catch {
        console.log("\n❌ Vault IDL not found at app/anchor/vault_idl.json");
        return;
    }

    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program(idl, provider);

    // Check vault
    const assetId = "NVDAx";
    
    console.log("\n📦 Vault Status:");
    console.log("-".repeat(50));

    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        VAULT_PROGRAM_ID
    );

    try {
        const vault = await (program.account as any).vault.fetch(vaultPda);
        const tvl = vault.totalAssets.toNumber() / 1e6;
        const shares = vault.totalShares.toNumber() / 1e6;
        const sharePrice = shares > 0 ? vault.totalAssets.toNumber() / vault.totalShares.toNumber() : 1;

        console.log(`\n✅ ${assetId} Vault FOUND`);
        console.log(`   PDA: ${vaultPda.toBase58()}`);
        console.log(`   Epoch: ${vault.epoch.toNumber()}`);
        console.log(`   TVL: ${tvl.toFixed(2)} tokens`);
        console.log(`   Shares: ${shares.toFixed(2)}`);
        console.log(`   Share Price: ${sharePrice.toFixed(6)}`);
        console.log(`   Underlying Mint: ${vault.underlyingMint.toBase58()}`);

        // Check if we're mint authority
        try {
            const mintInfo = await getMint(connection, vault.underlyingMint);
            const isMintAuth = mintInfo.mintAuthority?.equals(wallet.publicKey);
            console.log(`   Mint Authority: ${isMintAuth ? "✅ You (faucet will work)" : "❌ Someone else"}`);
            if (!isMintAuth && mintInfo.mintAuthority) {
                console.log(`   (Current authority: ${mintInfo.mintAuthority.toBase58()})`);
            }
        } catch {
            console.log(`   Mint: ❌ Could not fetch mint info`);
        }

    } catch (error: any) {
        console.log(`\n❌ ${assetId} Vault NOT FOUND on devnet`);
        console.log(`   Error: ${error.message}`);
        console.log(`\n   To fix: Run anchor build && anchor deploy`);
        console.log(`   Or use a pre-deployed vault`);
    }

    // Check .env.local
    const envPath = path.join(__dirname, "../app/.env.local");
    const hasEnvLocal = fs.existsSync(envPath);
    const envContent = hasEnvLocal ? fs.readFileSync(envPath, "utf-8") : "";
    const hasMintKey = envContent.includes("MINT_AUTHORITY_PRIVATE_KEY");

    // Demo checklist
    console.log("\n\n📋 Demo Checklist:");
    console.log("-".repeat(50));
    console.log(`1. [${balance > 0.1e9 ? "✅" : "❌"}] Admin wallet has SOL`);
    console.log(`2. [${hasEnvLocal ? "✅" : "❌"}] app/.env.local exists`);
    console.log(`3. [${hasMintKey ? "✅" : "❌"}] MINT_AUTHORITY_PRIVATE_KEY set in .env.local`);
    console.log(`4. [ ] Frontend running (cd app && pnpm dev)`);
    console.log(`5. [ ] Test faucet at /v2/faucet`);
    console.log(`6. [ ] Test deposit at /v2/earn/nvdax`);
    console.log(`7. [ ] Advance epoch: npx ts-node scripts/demo-epoch.ts`);
    
    console.log("\n🌐 URLs (once frontend running):");
    console.log("   Dashboard: http://localhost:3000/v2");
    console.log("   Faucet: http://localhost:3000/v2/faucet");
    console.log("   Deposit: http://localhost:3000/v2/earn/nvdax");

    console.log("\n=====================================\n");
}

main().catch(console.error);

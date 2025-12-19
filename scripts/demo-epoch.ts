/**
 * Demo Epoch Advancement Script
 * 
 * Hackathon Demo: Manually advances epoch with simulated premium
 * This shows users earning yield without needing the full RFQ system.
 * Uses IDL from app/anchor (no anchor build needed)
 * 
 * Usage: 
 *   npx ts-node scripts/demo-epoch.ts
 *   npx ts-node scripts/demo-epoch.ts --premium=5  (5% premium)
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const VAULT_PROGRAM_ID = new PublicKey(
    "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
);

// Load wallet from KEYPAIR env var or default solana config
function loadLocalWallet(): any {
    // Check for KEYPAIR env var first (can be path to JSON file)
    const envKeypair = process.env.KEYPAIR;
    let keypairPath: string;
    
    if (envKeypair) {
        // If it's a relative path, resolve from project root
        keypairPath = path.isAbsolute(envKeypair) 
            ? envKeypair 
            : path.join(process.cwd(), envKeypair);
    } else {
        keypairPath = path.join(os.homedir(), ".config/solana/id.json");
    }
    
    if (!fs.existsSync(keypairPath)) {
        throw new Error(`No wallet found at ${keypairPath}`);
    }
    
    console.log(`Loading wallet from: ${keypairPath}`);
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    return { 
        publicKey: keypair.publicKey, 
        signTransaction: async (tx: any) => { tx.sign(keypair); return tx; }, 
        signAllTransactions: async (txs: any) => { txs.forEach((tx: any) => tx.sign(keypair)); return txs; }, 
        payer: keypair 
    };
}

async function main() {
    const connection = new Connection(
        process.env.RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
    );
    
    const wallet = loadLocalWallet();
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

    // Load IDL from app/anchor
    const idlPath = path.join(__dirname, "../app/anchor/vault_idl.json");
    let idl: any;
    try {
        idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    } catch {
        console.error("❌ IDL not found at app/anchor/vault_idl.json");
        process.exit(1);
    }

    const program = new Program(idl, provider);

    // Parse args
    const args = process.argv.slice(2);
    const assetArg = args.find(arg => arg.startsWith("--asset="));
    const premiumPctArg = args.find(arg => arg.startsWith("--premium="));

    const assetId = assetArg ? assetArg.split("=")[1] : "NVDAx";
    const premiumPct = premiumPctArg ? parseFloat(premiumPctArg.split("=")[1]) : 1.0; // Default 1%

    console.log("\n🎮 xStock Options - Demo Epoch Advance");
    console.log("=====================================");
    console.log(`Asset: ${assetId}`);
    console.log(`Premium: ${premiumPct}%`);
    console.log(`Admin: ${wallet.publicKey.toBase58()}`);

    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        VAULT_PROGRAM_ID
    );

    // Fetch vault
    let vault: any;
    try {
        vault = await (program.account as any).vault.fetch(vaultPda);
    } catch (error) {
        console.error(`\n❌ Vault "${assetId}" not found on devnet.`);
        console.log("   Run init-vault.ts first or check if deployed.");
        process.exit(1);
    }

    const totalAssets = vault.totalAssets.toNumber();
    const totalShares = vault.totalShares.toNumber();
    const currentEpoch = vault.epoch.toNumber();

    console.log(`\n📊 Current Vault State:`);
    console.log(`   Epoch: ${currentEpoch}`);
    console.log(`   TVL: ${(totalAssets / 1e6).toFixed(2)} tokens`);
    console.log(`   Shares: ${(totalShares / 1e6).toFixed(2)}`);

    if (totalAssets === 0) {
        console.log("\n⚠️  Vault has no deposits. Premium won't show yield.");
        console.log("   Have users deposit first via /v2/earn/nvdax");
    }

    // Calculate premium (X% of TVL)
    const premiumBaseUnits = Math.floor(totalAssets * (premiumPct / 100));
    const premiumTokens = premiumBaseUnits / 1e6;

    console.log(`\n💰 Simulating epoch premium:`);
    console.log(`   Premium: ${premiumTokens.toFixed(4)} tokens (${premiumPct}% of TVL)`);

    // Calculate new share price
    const newTotalAssets = totalAssets + premiumBaseUnits;
    const oldSharePrice = totalShares > 0 ? totalAssets / totalShares : 1;
    const newSharePrice = totalShares > 0 ? newTotalAssets / totalShares : 1;
    const shareGain = oldSharePrice > 0 ? ((newSharePrice - oldSharePrice) / oldSharePrice) * 100 : 0;

    console.log(`   Old share price: ${oldSharePrice.toFixed(6)}`);
    console.log(`   New share price: ${newSharePrice.toFixed(6)}`);
    console.log(`   Share value gain: +${shareGain.toFixed(2)}%`);

    // Confirm
    console.log("\n🔄 Advancing epoch...");

    try {
        const tx = await (program.methods as any)
            .advanceEpoch(new BN(premiumBaseUnits))
            .accounts({
                vault: vaultPda,
                authority: wallet.publicKey,
            })
            .rpc();

        console.log(`\n✅ Epoch advanced successfully!`);
        console.log(`   New epoch: ${currentEpoch + 1}`);
        console.log(`   Tx: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

        // Fetch updated vault
        const updatedVault = await (program.account as any).vault.fetch(vaultPda);
        const newSharePriceActual = updatedVault.totalShares.toNumber() > 0 
            ? updatedVault.totalAssets.toNumber() / updatedVault.totalShares.toNumber() 
            : 1;
        
        console.log(`\n📊 Updated Vault State:`);
        console.log(`   Epoch: ${updatedVault.epoch.toNumber()}`);
        console.log(`   TVL: ${(updatedVault.totalAssets.toNumber() / 1e6).toFixed(2)} tokens`);
        console.log(`   Share price: ${newSharePriceActual.toFixed(6)}`);

    } catch (error: any) {
        console.error("\n❌ Failed to advance epoch:", error.message);
        if (error.logs) {
            console.error("Logs:", error.logs.slice(-5));
        }
        process.exit(1);
    }

    console.log("\n=====================================");
    console.log("🎉 Users will now see increased share value!");
    console.log("   They can withdraw to realize the yield.");
    console.log("=====================================\n");
}

main().catch(console.error);

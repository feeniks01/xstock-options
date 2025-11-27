import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import fs from "fs";
import os from "os";

// Load default wallet
const homeDir = os.homedir();
const keypairPath = `${homeDir}/.config/solana/id.json`;
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
const payer = Keypair.fromSecretKey(secretKey);

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
    console.log("Payer:", payer.publicKey.toBase58());

    // 1. Create xStock Mint
    const xStockMint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        0 // 0 decimals for "1 share" simplicity
    );
    console.log("xStock Mint:", xStockMint.toBase58());

    // 2. Create USDC Mint
    const usdcMint = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        6 // 6 decimals for USDC
    );
    console.log("USDC Mint:", usdcMint.toBase58());

    // 3. Mint to Payer
    const xStockAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        xStockMint,
        payer.publicKey
    );
    await mintTo(
        connection,
        payer,
        xStockMint,
        xStockAta.address,
        payer,
        100 // 100 shares
    );
    console.log("Minted 100 xStock to payer");

    const usdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        usdcMint,
        payer.publicKey
    );
    await mintTo(
        connection,
        payer,
        usdcMint,
        usdcAta.address,
        payer,
        10000 * 1_000_000 // 10,000 USDC
    );
    console.log("Minted 10,000 USDC to payer");

    console.log("\nUpdate your frontend constants with these mints!");
}

main().catch(console.error);

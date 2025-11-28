import { createMint } from "@solana/spl-token";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import fs from "fs";
import os from "os";

async function main() {
    // Connect to devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Load payer
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);

    console.log("Creating mints with payer:", payer.publicKey.toBase58());

    // Create xStock Mint (6 decimals)
    const xStockMint = await createMint(
        connection,
        payer,
        payer.publicKey, // Mint Authority
        null, // Freeze Authority
        6 // Decimals
    );
    console.log("New xStock Mint:", xStockMint.toBase58());

    // Create Quote Mint (6 decimals)
    const quoteMint = await createMint(
        connection,
        payer,
        payer.publicKey, // Mint Authority
        null, // Freeze Authority
        6 // Decimals
    );
    console.log("New Quote Mint:", quoteMint.toBase58());

    console.log("\nUpdate app/utils/constants.ts with these new values!");
}

main().catch(err => {
    console.error("Error creating mints:", err);
});

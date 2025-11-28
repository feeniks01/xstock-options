import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createMintToInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import os from "os";

// Mints from deployment
const MOCK_MINT = new PublicKey("BAjbiKHET3QPxCURq6tBDZmSs62jCQrZTg2FKcK56AY2");
const QUOTE_MINT = new PublicKey("DG7pxSEQQ7rCPnLPcQTP3dtJTvZ6qCaf44vZ8xTyC95K");

async function main() {
    const userAddress = process.argv[2];
    if (!userAddress) {
        console.error("Please provide a user address as an argument.");
        process.exit(1);
    }

    const userPublicKey = new PublicKey(userAddress);

    // Load deployer wallet
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    console.log(`Minting tokens to ${userAddress}...`);

    // Get ATAs
    const xStockAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        MOCK_MINT,
        userPublicKey
    );

    const quoteAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        QUOTE_MINT,
        userPublicKey
    );

    // Mint tokens
    const tx = new Transaction();

    // Mint 1000 xStock (6 decimals)
    tx.add(createMintToInstruction(MOCK_MINT, xStockAta.address, payer.publicKey, 1000 * 1_000_000));

    // Mint 10,000 USDC (6 decimals)
    tx.add(createMintToInstruction(QUOTE_MINT, quoteAta.address, payer.publicKey, 10_000 * 1_000_000));

    const sig = await connection.sendTransaction(tx, [payer]);
    await connection.confirmTransaction(sig);

    console.log("Minted successfully!");
    console.log("Tx:", sig);
}

main().catch(console.error);

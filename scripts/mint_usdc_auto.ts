import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createMintToInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Constants
const QUOTE_MINT = new PublicKey("5AuU5y36pg19rnVoXepsVXcoeQiX36hvAk2EGcBhktbp");
const RECIPIENT = new PublicKey("DL64LYhWgG1Vie3LWpydPSLvBbotbbHD4Bg3U8Se7gLE");
const AMOUNT = 20_000; // 20,000 USDC

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load wallet
    const homeDir = os.homedir();
    const keypairPath = path.join(homeDir, ".config", "solana", "id.json");
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);

    console.log("Minting", AMOUNT, "USDC to:", RECIPIENT.toBase58());

    // Get ATA
    const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        QUOTE_MINT,
        RECIPIENT
    );

    // Mint
    const tx = new Transaction().add(
        createMintToInstruction(
            QUOTE_MINT,
            ata.address,
            payer.publicKey,
            AMOUNT * 1_000_000 // 6 decimals
        )
    );

    const sig = await connection.sendTransaction(tx, [payer]);
    console.log("Transaction sent. Confirming...");
    await connection.confirmTransaction(sig);
    console.log("Success! Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);

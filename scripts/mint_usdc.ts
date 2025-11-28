import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createMintToInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import os from "os";

const USDC_MINT = new PublicKey("DG7pxSEQQ7rCPnLPcQTP3dtJTvZ6qCaf44vZ8xTyC95K");

async function main() {
    const userAddress = process.argv[2];
    const amount = process.argv[3];

    if (!userAddress || !amount) {
        console.error("Usage: npx ts-node scripts/mint_usdc.ts <address> <amount>");
        console.error("Example: npx ts-node scripts/mint_usdc.ts 5vgN...xdX 1000");
        process.exit(1);
    }

    const userPublicKey = new PublicKey(userAddress);
    const usdcAmount = parseFloat(amount);

    if (isNaN(usdcAmount) || usdcAmount <= 0) {
        console.error("Amount must be a positive number");
        process.exit(1);
    }

    // Load deployer wallet
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    console.log(`Minting ${usdcAmount} USDC to ${userAddress}...`);

    // Get or create ATA for USDC
    const usdcAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        USDC_MINT,
        userPublicKey
    );

    // Mint USDC (6 decimals)
    const tx = new Transaction();
    tx.add(createMintToInstruction(
        USDC_MINT,
        usdcAta.address,
        payer.publicKey,
        usdcAmount * 1_000_000
    ));

    const sig = await connection.sendTransaction(tx, [payer]);
    await connection.confirmTransaction(sig);

    console.log(`✅ Minted ${usdcAmount} USDC successfully!`);
    console.log(`Tx: ${sig}`);
}

main().catch(console.error);

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import os from "os";

const XSTOCK_MINT = new PublicKey("BAjbiKHET3QPxCURq6tBDZmSs62jCQrZTg2FKcK56AY2");

async function main() {
    const userAddress = process.argv[2];

    if (!userAddress) {
        console.error("Usage: npx ts-node scripts/create_xstock_account.ts <address>");
        process.exit(1);
    }

    const userPublicKey = new PublicKey(userAddress);

    // Load deployer wallet
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    console.log(`Creating xStock token account for ${userAddress}...`);

    const xStockAta = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        XSTOCK_MINT,
        userPublicKey
    );

    console.log(`✅ xStock account created: ${xStockAta.address.toBase58()}`);
}

main().catch(console.error);

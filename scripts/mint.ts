import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createMintToInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import os from "os";
import readline from "readline";

// Mints from deployment
const MOCK_MINT = new PublicKey("6a57JJHxnTkbb6YDWmZPtWirFpfdxLcpNqeD5zqjziiD");
const QUOTE_MINT = new PublicKey("5AuU5y36pg19rnVoXepsVXcoeQiX36hvAk2EGcBhktbp");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};

async function main() {
    console.log("--- xStock Options Minting Script ---");

    // Load deployer wallet once
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payer = Keypair.fromSecretKey(secretKey);
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    let currentWalletAddress: string | null = null;
    let keepRunning = true;

    while (keepRunning) {
        // 1. Get Wallet Address (if not set)
        if (!currentWalletAddress) {
            currentWalletAddress = await question("\nEnter wallet address to mint to: ");
            while (!currentWalletAddress) {
                currentWalletAddress = await question("Please enter a valid wallet address: ");
            }
        } else {
            console.log(`\nUsing wallet: ${currentWalletAddress}`);
        }

        let userPublicKey: PublicKey;
        try {
            userPublicKey = new PublicKey(currentWalletAddress);
        } catch (e) {
            console.error("Invalid public key. Resetting wallet.");
            currentWalletAddress = null;
            continue;
        }

        // 2. Get Token Type
        console.log("\nWhich token do you want to mint?");
        console.log("1. xStock (Mock Stock)");
        console.log("2. USDC (Mock Quote)");
        console.log("3. Both");
        let tokenChoice = await question("Enter choice (1, 2, or 3): ");
        while (!["1", "2", "3"].includes(tokenChoice)) {
            tokenChoice = await question("Invalid choice. Enter 1, 2, or 3: ");
        }

        // 3. Get Quantity & Execute
        try {
            const tx = new Transaction();
            let summary = "";

            if (tokenChoice === "1" || tokenChoice === "3") {
                let qtyStr = await question(`Enter quantity of xStock to mint: `);
                let qty = parseFloat(qtyStr);
                while (isNaN(qty) || qty <= 0) {
                    qtyStr = await question("Invalid quantity. Enter a positive number: ");
                    qty = parseFloat(qtyStr);
                }

                const ata = await getOrCreateAssociatedTokenAccount(
                    connection,
                    payer,
                    MOCK_MINT,
                    userPublicKey
                );
                tx.add(createMintToInstruction(MOCK_MINT, ata.address, payer.publicKey, qty * 1_000_000));
                summary += `${qty} xStock`;
            }

            if (tokenChoice === "3") summary += " and ";

            if (tokenChoice === "2" || tokenChoice === "3") {
                let qtyStr = await question(`Enter quantity of USDC to mint: `);
                let qty = parseFloat(qtyStr);
                while (isNaN(qty) || qty <= 0) {
                    qtyStr = await question("Invalid quantity. Enter a positive number: ");
                    qty = parseFloat(qtyStr);
                }

                const ata = await getOrCreateAssociatedTokenAccount(
                    connection,
                    payer,
                    QUOTE_MINT,
                    userPublicKey
                );
                tx.add(createMintToInstruction(QUOTE_MINT, ata.address, payer.publicKey, qty * 1_000_000));
                summary += `${qty} USDC`;
            }

            console.log(`\nMinting ${summary} to ${currentWalletAddress}...`);
            const sig = await connection.sendTransaction(tx, [payer]);
            console.log("Transaction sent. Confirming...");
            await connection.confirmTransaction(sig);
            console.log(`✅ Successfully minted!`);
            console.log(`Tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

        } catch (e) {
            console.error("\n❌ Minting failed:", e);
        }

        // 4. Post-Mint Menu
        console.log("\nWhat would you like to do next?");
        console.log("1. Mint another token to the SAME wallet");
        console.log("2. Mint to a DIFFERENT wallet");
        console.log("3. Finish and Exit");

        let nextStep = await question("Enter choice (1, 2, or 3): ");
        while (!["1", "2", "3"].includes(nextStep)) {
            nextStep = await question("Invalid choice. Enter 1, 2, or 3: ");
        }

        if (nextStep === "2") {
            currentWalletAddress = null; // Reset wallet to prompt again
        } else if (nextStep === "3") {
            keepRunning = false;
            console.log("Goodbye! 👋");
        }
        // If 1, loop continues with same currentWalletAddress
    }

    rl.close();
}

main().catch(console.error);

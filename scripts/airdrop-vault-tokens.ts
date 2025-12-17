/**
 * Airdrop Vault Tokens
 * Mints the vault's underlying token to your wallet for testing deposits
 * 
 * Usage: ANCHOR_WALLET=~/.config/solana/id.json npx ts-node airdrop-vault-tokens.ts
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAccount,
    getMint,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";

const VAULT_PROGRAM_ID = new PublicKey("8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local();
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = new Program(
        require("../target/idl/vault.json"),
        provider
    ) as Program<Vault>;

    const args = process.argv.slice(2);
    const assetIdArg = args.find(arg => arg.startsWith("--asset="));
    const amountArg = args.find(arg => arg.startsWith("--amount="));
    const recipientArg = args.find(arg => arg.startsWith("--recipient="));

    const assetId = assetIdArg ? assetIdArg.split("=")[1] : "NVDAx";
    const amount = amountArg ? parseFloat(amountArg.split("=")[1]) : 1000; // Default 1000 tokens
    const recipientPubkey = recipientArg
        ? new PublicKey(recipientArg.split("=")[1])
        : wallet.publicKey;

    console.log("==========================================");
    console.log("Vault Token Airdrop - Devnet");
    console.log("==========================================");
    console.log("Your wallet:", wallet.publicKey.toBase58());
    console.log("Recipient:", recipientPubkey.toBase58());
    console.log("Asset:", assetId);
    console.log("Amount:", amount, assetId);
    console.log("==========================================\n");

    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        program.programId
    );

    // Fetch vault data
    let vault;
    try {
        vault = await program.account.vault.fetch(vaultPda);
        console.log("✅ Found vault:", vaultPda.toBase58());
        console.log("   Underlying Mint:", vault.underlyingMint.toBase58());
    } catch (error) {
        console.error("❌ Vault not found for asset:", assetId);
        console.log("   Run init-vault.ts first to create the vault.");
        return;
    }

    const underlyingMint = vault.underlyingMint;

    // Get mint info
    const mintInfo = await getMint(connection, underlyingMint);
    const decimals = mintInfo.decimals;
    const tokenAmount = Math.floor(amount * Math.pow(10, decimals));

    console.log(`   Decimals: ${decimals}`);
    console.log(`   Amount in base units: ${tokenAmount}`);

    // Check if we're the mint authority
    if (!mintInfo.mintAuthority?.equals(wallet.publicKey)) {
        console.error("\n❌ You are not the mint authority for this token!");
        console.log("   Mint authority:", mintInfo.mintAuthority?.toBase58() || "None");
        console.log("   Your wallet:", wallet.publicKey.toBase58());
        console.log("\n   Only the mint authority can airdrop tokens.");
        return;
    }

    console.log("\n✅ You are the mint authority!");

    // Get or create recipient's token account
    console.log("\n📝 Getting/creating recipient token account...");
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        underlyingMint,
        recipientPubkey
    );
    console.log("   Token account:", recipientTokenAccount.address.toBase58());

    // Check current balance
    const balanceBefore = Number(recipientTokenAccount.amount) / Math.pow(10, decimals);
    console.log(`   Current balance: ${balanceBefore} ${assetId}`);

    // Mint tokens
    console.log(`\n📝 Minting ${amount} ${assetId}...`);
    try {
        const signature = await mintTo(
            connection,
            wallet.payer,
            underlyingMint,
            recipientTokenAccount.address,
            wallet.payer,
            tokenAmount
        );
        console.log("✅ Minted successfully!");
        console.log("   Tx:", signature);
    } catch (error) {
        console.error("❌ Failed to mint:", error);
        return;
    }

    // Check new balance
    const accountAfter = await getAccount(connection, recipientTokenAccount.address);
    const balanceAfter = Number(accountAfter.amount) / Math.pow(10, decimals);
    console.log(`\n✅ New balance: ${balanceAfter} ${assetId}`);
    console.log("==========================================");
}

main().catch(console.error);

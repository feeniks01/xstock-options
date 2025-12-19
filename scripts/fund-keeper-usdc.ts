import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";

const MOCK_USDC_MINT = new PublicKey("EnDeaApTGfsWxMwLbmJsTh1gSLVR8gJG26dqoDjfPVag");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local();

    console.log("=================================");
    console.log("Fund Keeper with Mock USDC");
    console.log("=================================");
    console.log("Keeper wallet:", wallet.publicKey.toBase58());
    console.log("Mock USDC mint:", MOCK_USDC_MINT.toBase58());

    try {
        // Check if the mint exists and get info
        const mintInfo = await getMint(connection, MOCK_USDC_MINT);
        console.log("\nMint decimals:", mintInfo.decimals);
        console.log("Mint authority:", mintInfo.mintAuthority?.toBase58() || "frozen");

        // Get or create keeper's USDC token account
        const keeperUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            MOCK_USDC_MINT,
            wallet.publicKey
        );
        console.log("\nKeeper USDC account:", keeperUsdcAccount.address.toBase58());
        console.log("Current balance:", Number(keeperUsdcAccount.amount) / 10 ** mintInfo.decimals);

        // Check if we're the mint authority
        if (mintInfo.mintAuthority?.equals(wallet.publicKey)) {
            // Mint 10000 USDC to keeper
            const amountToMint = BigInt(10000 * 10 ** mintInfo.decimals);
            console.log(`\n📝 Minting ${10000} USDC to keeper...`);

            const sig = await mintTo(
                connection,
                wallet.payer,
                MOCK_USDC_MINT,
                keeperUsdcAccount.address,
                wallet.payer, // mint authority
                amountToMint
            );

            console.log("✅ Minted! Tx:", sig);

            // Verify new balance
            const newAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                wallet.payer,
                MOCK_USDC_MINT,
                wallet.publicKey
            );
            console.log("New balance:", Number(newAccount.amount) / 10 ** mintInfo.decimals);
        } else {
            console.log("\n⚠️ Not mint authority - cannot mint directly.");
            console.log("You'll need to fund via the faucet or get tokens from authority:",
                mintInfo.mintAuthority?.toBase58());
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

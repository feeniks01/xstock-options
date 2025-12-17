import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Oracle } from "../target/types/oracle";
import { Connection, PublicKey } from "@solana/web3.js";

// Pyth price account for NVDAx on devnet
// You can find Pyth price accounts at: https://pyth.network/developers/price-feed-ids
const NVDAX_PYTH_PRICE_ACCOUNT = new PublicKey(
    "GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU" // This is a placeholder - need actual Pyth account
);

const ORACLE_PROGRAM_ID = new PublicKey(
    "5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk"
);

async function main() {
    // Configure the client to use devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local();
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = new Program(
        require("../target/idl/oracle.json"),
        provider
    ) as Program<Oracle>;

    console.log("=================================");
    console.log("Oracle Devnet Test");
    console.log("=================================");
    console.log("Program ID:", program.programId.toBase58());
    console.log("Wallet:", wallet.publicKey.toBase58());
    console.log("");

    const assetId = "NVDAx";

    // Derive AssetConfig PDA
    const [assetConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("asset"), Buffer.from(assetId)],
        program.programId
    );

    console.log("AssetConfig PDA:", assetConfigPda.toBase58());

    // Check if AssetConfig already exists
    try {
        const existingConfig = await program.account.assetConfig.fetch(assetConfigPda);
        console.log("\n✅ AssetConfig already exists:");
        console.log("  Asset ID:", existingConfig.assetId);
        console.log("  Pyth Price Account:", existingConfig.pythPriceAccount.toBase58());
        console.log("  Authority:", existingConfig.authority.toBase58());
    } catch (error) {
        console.log("\n📝 AssetConfig does not exist. Initializing...");

        try {
            const tx = await program.methods
                .initializeAsset(assetId, NVDAX_PYTH_PRICE_ACCOUNT)
                .accountsPartial({
                    assetConfig: assetConfigPda,
                    authority: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log("✅ AssetConfig initialized!");
            console.log("  Transaction:", tx);

            const config = await program.account.assetConfig.fetch(assetConfigPda);
            console.log("  Asset ID:", config.assetId);
            console.log("  Pyth Price Account:", config.pythPriceAccount.toBase58());
        } catch (initError) {
            console.error("❌ Failed to initialize AssetConfig:", initError);
            return;
        }
    }

    // Test get_price (note: this will fail if Pyth account doesn't have valid data)
    console.log("\n📊 Testing get_price...");
    try {
        const result = await program.methods
            .getPrice()
            .accountsPartial({
                assetConfig: assetConfigPda,
                pythPriceAccount: NVDAX_PYTH_PRICE_ACCOUNT,
            })
            .view();

        console.log("✅ Price retrieved successfully!");
        console.log("  Price:", result.price);
        console.log("  Confidence:", result.conf);
        console.log("  Exponent:", result.exponent);
        console.log("  Publish Time:", new Date(result.publishTime * 1000).toISOString());

        // Calculate actual price
        const actualPrice = Number(result.price) * Math.pow(10, result.exponent);
        console.log("  Actual Price: $" + actualPrice.toFixed(2));
    } catch (priceError: any) {
        console.log("⚠️  get_price failed (expected if using placeholder Pyth account)");
        console.log("  Error:", priceError.message || priceError);
        console.log("\n💡 To fix: Update NVDAX_PYTH_PRICE_ACCOUNT with actual Pyth price account");
        console.log("   Find it at: https://pyth.network/developers/price-feed-ids");
    }

    console.log("\n=================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

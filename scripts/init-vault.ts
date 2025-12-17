import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
    createMint,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const VAULT_PROGRAM_ID = new PublicKey(
    "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
);

// V1 Mock Token Mints (already created on devnet)
const V1_MOCK_NVDAX_MINT = new PublicKey("H9AqpTYHCGCvJ12YxRX5goGNTcG9VAai1hgQHzVf68vT");
const V1_MOCK_USDC_MINT = new PublicKey("EnDeaApTGfsWxMwLbmJsTh1gSLVR8gJG26dqoDjfPVag");

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

    console.log("=================================");
    console.log("Vault Initialization - Devnet");
    console.log("=================================");
    console.log("Program ID:", program.programId.toBase58());
    console.log("Wallet:", wallet.publicKey.toBase58());

    const args = process.argv.slice(2);
    const assetIdArg = args.find(arg => arg.startsWith("--asset="));
    const mintArg = args.find(arg => arg.startsWith("--mint="));

    const assetId = assetIdArg ? assetIdArg.split("=")[1] : "NVDAx";
    const existingMintStr = mintArg ? mintArg.split("=")[1] : null;
    const utilizationCapBps = 8000; // 80% utilization cap

    console.log(`\nPARAMS: Asset=${assetId}, Mint=${existingMintStr || "(Create New)"}`);

    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        program.programId
    );
    console.log("Vault PDA:", vaultPda.toBase58());

    // Check if vault already exists
    try {
        const existingVault = await program.account.vault.fetch(vaultPda);
        console.log("\n✅ Vault already exists:");
        console.log("  Asset ID:", existingVault.assetId);
        console.log("  Authority:", existingVault.authority.toBase58());
        console.log("  Underlying Mint:", existingVault.underlyingMint.toBase58());
        console.log("  Share Mint:", existingVault.shareMint.toBase58());
        return;
    } catch (error) {
        // Vault doesn't exist, continue with initialization
    }

    let underlyingMint: PublicKey;
    if (existingMintStr) {
        underlyingMint = new PublicKey(existingMintStr);
        console.log("\nUsing specified underlying mint:", underlyingMint.toBase58());
    } else if (assetId === "NVDAx") {
        // Use the existing V1 mock NVDAx mint
        underlyingMint = V1_MOCK_NVDAX_MINT;
        console.log("\n✅ Using V1 Mock NVDAx mint:", underlyingMint.toBase58());
    } else {
        // Create a new mock token for other assets
        console.log("\n📝 Creating new mock mint for", assetId, "...");
        try {
            underlyingMint = await createMint(
                connection,
                wallet.payer,
                wallet.publicKey,
                null,
                6 // 6 decimals
            );
            console.log("✅ Created mock mint:", underlyingMint.toBase58());
        } catch (error) {
            console.error("❌ Failed to create mint:", error);
            return;
        }
    }

    // Derive share mint PDA
    const [shareMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("shares"), vaultPda.toBuffer()],
        program.programId
    );
    console.log("Share Mint PDA:", shareMintPda.toBase58());

    // Derive vault token account PDA - seed is "vault_tokens" + vault PDA
    const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_tokens"), vaultPda.toBuffer()],
        program.programId
    );
    console.log("Vault Token Account PDA:", vaultTokenAccountPda.toBase58());

    console.log("\n📝 Initializing vault...");

    try {
        const tx = await program.methods
            .initializeVault(assetId, utilizationCapBps)
            .accountsPartial({
                vault: vaultPda,
                underlyingMint: underlyingMint,
                shareMint: shareMintPda,
                vaultTokenAccount: vaultTokenAccountPda,
                authority: wallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("\n✅ Vault initialized!");
        console.log("  Transaction:", tx);

        // Fetch vault data
        const vault = await program.account.vault.fetch(vaultPda);
        console.log("\n📊 Vault State:");
        console.log("  Asset ID:", vault.assetId);
        console.log("  Authority:", vault.authority.toBase58());
        console.log("  Underlying Mint:", vault.underlyingMint.toBase58());
        console.log("  Share Mint:", vault.shareMint.toBase58());

        console.log("\n=================================");
        console.log("VAULT_PDA=" + vaultPda.toBase58());
        console.log("UNDERLYING_MINT=" + underlyingMint.toBase58());
        console.log("SHARE_MINT=" + shareMintPda.toBase58());
        console.log("=================================");

    } catch (initError: any) {
        console.error("❌ Failed to initialize vault:");
        console.error(initError.logs || initError.message || initError);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

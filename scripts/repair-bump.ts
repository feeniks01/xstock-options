import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { Connection, PublicKey } from "@solana/web3.js";

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
    console.log("Vault Bump Repair");
    console.log("=================================");
    console.log("Program ID:", program.programId.toBase58());
    console.log("Wallet:", wallet.publicKey.toBase58());

    // Vault PDA for NVDAx
    const assetId = "NVDAx";
    const [vaultPda, correctBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        program.programId
    );

    console.log("\nVault PDA:", vaultPda.toBase58());
    console.log("Correct bump:", correctBump);

    // Fetch current vault state
    const vault = await program.account.vault.fetch(vaultPda);
    console.log("\nCurrent vault bump:", vault.bump);

    if (vault.bump === correctBump) {
        console.log("\n✅ Bump is already correct!");
        return;
    }

    console.log(`\n📝 Repairing bump: ${vault.bump} -> ${correctBump}...`);

    try {
        const tx = await program.methods
            .repairBump(correctBump)
            .accounts({
                vault: vaultPda,
                authority: wallet.publicKey,
            })
            .rpc();

        console.log("\n✅ Bump repaired!");
        console.log("Transaction:", tx);

        // Verify
        const updatedVault = await program.account.vault.fetch(vaultPda);
        console.log("\nNew vault bump:", updatedVault.bump);

    } catch (error: any) {
        console.error("\n❌ Failed to repair bump:");
        console.error(error.logs || error.message || error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

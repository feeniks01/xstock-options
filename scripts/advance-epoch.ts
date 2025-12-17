import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { Connection, PublicKey } from "@solana/web3.js";

const VAULT_PROGRAM_ID = new PublicKey(
    "8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY"
);

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
    const premiumArg = args.find(arg => arg.startsWith("--premium="));

    const assetId = assetIdArg ? assetIdArg.split("=")[1] : "NVDAx";
    const premium = premiumArg ? Number(premiumArg.split("=")[1]) : 0; // Base units for now (e.g. 0 premium)

    console.log("=================================");
    console.log("Advance Epoch Script");
    console.log("=================================");
    console.log(`Asset: ${assetId}`);
    console.log(`Premium to distribute: ${premium}`);

    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from(assetId)],
        program.programId
    );

    try {
        const vaultBefore = await program.account.vault.fetch(vaultPda);
        console.log(`Current Epoch: ${vaultBefore.epoch.toString()}`);

        const tx = await program.methods
            .advanceEpoch(new anchor.BN(premium))
            .accounts({
                vault: vaultPda,
                authority: wallet.publicKey,
            })
            .rpc();

        console.log("\n✅ Epoch advanced successfully!");
        console.log("Transaction Signature:", tx);

        const vaultAfter = await program.account.vault.fetch(vaultPda);
        console.log(`New Epoch: ${vaultAfter.epoch.toString()}`);

    } catch (e: any) {
        console.error("\n❌ Error advancing epoch:");
        console.error(e);
        if (e.logs) {
            console.error("\nLogs:");
            e.logs.forEach((log: string) => console.log(log));
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

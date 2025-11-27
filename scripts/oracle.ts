import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, Idl } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import idl from "../app/anchor/idl.json";

// Load default wallet
const homeDir = os.homedir();
const keypairPath = `${homeDir}/.config/solana/id.json`;
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
const payer = Keypair.fromSecretKey(secretKey);
const wallet = new Wallet(payer);

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, wallet, {});
const programId = new PublicKey("Hc2qWi4vf3zng35gyucQNfZVi6ik7kkgwg3NonMsLcFJ");
// @ts-ignore
const program = new Program(idl as Idl, programId, provider);

async function main() {
    const [oraclePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("mock_oracle")],
        programId
    );

    console.log("Oracle PDA:", oraclePda.toBase58());

    // Check if initialized
    const account = await connection.getAccountInfo(oraclePda);

    if (!account) {
        console.log("Initializing Oracle...");
        await program.methods
            .initializeOracle(new BN(150 * 1_000_000)) // Initial price 150 USDC
            .accounts({
                admin: payer.publicKey,
                priceOracle: oraclePda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        console.log("Oracle Initialized at 150 USDC");
    } else {
        console.log("Updating Oracle...");
        const newPrice = process.argv[2] ? parseInt(process.argv[2]) : 150;
        await program.methods
            .updatePrice(new BN(newPrice * 1_000_000))
            .accounts({
                admin: payer.publicKey,
                priceOracle: oraclePda,
            })
            .rpc();
        console.log(`Oracle Updated to ${newPrice} USDC`);
    }
}

// Helper for BN if not imported
import { BN } from "@coral-xyz/anchor";

main().catch(console.error);

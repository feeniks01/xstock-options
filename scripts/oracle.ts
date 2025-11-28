import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, Idl } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import idl from "../app/anchor/xstock_idl.json";

// Load default wallet
const homeDir = os.homedir();
const keypairPath = `${homeDir}/.config/solana/id.json`;
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
const payer = Keypair.fromSecretKey(secretKey);
const wallet = new Wallet(payer);

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, wallet, {});
const PROGRAM_ID = new PublicKey("9VRMEYvEiKPeGz9N8wVQjvT5qpqcHqNqd31kSYZhop2s");
console.log("Program ID:", PROGRAM_ID.toBase58());
console.log("Provider:", provider.connection.rpcEndpoint);
console.log("IDL:", JSON.stringify(idl).substring(0, 100));
// @ts-ignore
idl.address = PROGRAM_ID.toBase58();
// @ts-ignore
if (!idl.types) { idl.types = idl.accounts; }
// @ts-ignore
const program = new Program(idl as any, provider);
const ix = program.idl.instructions.find((i: any) => i.name === "initializeOracle");
console.log("InitializeOracle Accounts:", JSON.stringify(ix?.accounts, null, 2));

async function main() {
    const [oraclePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("mock_oracle")],
        PROGRAM_ID
    );

    console.log("Oracle PDA:", oraclePda.toBase58());

    // Check if initialized
    const account = await connection.getAccountInfo(oraclePda);

    if (!account) {
        console.log("Initializing Oracle...");
        const ix = await program.methods
            .initializeOracle(new BN(150 * 1_000_000)) // Initial price 150 USDC
            .accounts({
                admin: payer.publicKey,
                priceOracle: oraclePda,
                systemProgram: SystemProgram.programId,
            })
            .instruction();

        console.log("Keys:", ix.keys.map((k: any) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })));

        // Manually fix mutability if needed
        const oracleKeyIndex = ix.keys.findIndex((k: any) => k.pubkey.equals(oraclePda));
        if (oracleKeyIndex >= 0) {
            console.log("Forcing priceOracle to be writable");
            ix.keys[oracleKeyIndex].isWritable = true;
        }

        const tx = new Transaction().add(ix);
        await provider.sendAndConfirm(tx);
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

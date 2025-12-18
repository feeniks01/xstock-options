/**
 * Update Token Metadata
 * Adds or updates Metaplex Token Metadata (name, symbol, URI/logo) for mock tokens
 * 
 * Usage: ANCHOR_WALLET=~/.config/solana/id.json npx ts-node update-token-metadata.ts
 * 
 * Prerequisites:
 * - You must be the mint authority (for create) or update authority (for update)
 * - Token logos should be hosted on GitHub (or upload to Arweave/IPFS)
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";

const VAULT_PROGRAM_ID = new PublicKey("8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY");

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// GitHub raw URLs for metadata (update to your actual GitHub username/org)
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/feeniks01/xstock-options/main/app/public";

// Derive Metadata PDA
function getMetadataPDA(mint: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );
    return pda;
}

// Create UpdateMetadataAccountV2 instruction data
function createUpdateMetadataData(
    name: string,
    symbol: string,
    uri: string,
): Buffer {
    // Instruction discriminator for UpdateMetadataAccountV2 = 15
    const DISCRIMINATOR = 15;

    const data = Buffer.alloc(1000);
    let offset = 0;

    // Discriminator
    data.writeUInt8(DISCRIMINATOR, offset);
    offset += 1;

    // updateMetadataAccountArgsV2:
    // data: Option<DataV2> - Some = 1
    data.writeUInt8(1, offset);
    offset += 1;

    // DataV2 struct:
    // name (string)
    data.writeUInt32LE(name.length, offset);
    offset += 4;
    data.write(name, offset);
    offset += name.length;

    // symbol (string)
    data.writeUInt32LE(symbol.length, offset);
    offset += 4;
    data.write(symbol, offset);
    offset += symbol.length;

    // uri (string)
    data.writeUInt32LE(uri.length, offset);
    offset += 4;
    data.write(uri, offset);
    offset += uri.length;

    // sellerFeeBasisPoints (u16)
    data.writeUInt16LE(0, offset);
    offset += 2;

    // creators (Option<Vec<Creator>>): None = 0
    data.writeUInt8(0, offset);
    offset += 1;

    // collection (Option): None = 0
    data.writeUInt8(0, offset);
    offset += 1;

    // uses (Option): None = 0
    data.writeUInt8(0, offset);
    offset += 1;

    // updateAuthority (Option<Pubkey>): None = 0 (keep same)
    data.writeUInt8(0, offset);
    offset += 1;

    // primarySaleHappened (Option<bool>): None = 0
    data.writeUInt8(0, offset);
    offset += 1;

    // isMutable (Option<bool>): Some(true) = 1, 1
    data.writeUInt8(1, offset);
    offset += 1;
    data.writeUInt8(1, offset);
    offset += 1;

    return data.subarray(0, offset);
}

// Create CreateMetadataAccountV3 instruction data
function createMetadataData(
    name: string,
    symbol: string,
    uri: string,
): Buffer {
    const DISCRIMINATOR = 33;

    const data = Buffer.alloc(1000);
    let offset = 0;

    data.writeUInt8(DISCRIMINATOR, offset);
    offset += 1;

    // name
    data.writeUInt32LE(name.length, offset);
    offset += 4;
    data.write(name, offset);
    offset += name.length;

    // symbol
    data.writeUInt32LE(symbol.length, offset);
    offset += 4;
    data.write(symbol, offset);
    offset += symbol.length;

    // uri
    data.writeUInt32LE(uri.length, offset);
    offset += 4;
    data.write(uri, offset);
    offset += uri.length;

    // sellerFeeBasisPoints
    data.writeUInt16LE(0, offset);
    offset += 2;

    // creators: None
    data.writeUInt8(0, offset);
    offset += 1;

    // collection: None
    data.writeUInt8(0, offset);
    offset += 1;

    // uses: None
    data.writeUInt8(0, offset);
    offset += 1;

    // isMutable
    data.writeUInt8(1, offset);
    offset += 1;

    // collectionDetails: None
    data.writeUInt8(0, offset);
    offset += 1;

    return data.subarray(0, offset);
}

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = anchor.Wallet.local();

    console.log("==========================================");
    console.log("Token Metadata Updater - Devnet");
    console.log("==========================================");
    console.log("Your wallet:", wallet.publicKey.toBase58());
    console.log("==========================================\n");

    // Token mints to update
    const TOKENS = [
        {
            mint: new PublicKey("D6wYCkoFg1PyQn1fX21Vv2Z1h1M5oSSK26AHtRvahdTB"),
            name: "Mock NVDAx",
            symbol: "NVDAx",
            uri: `${GITHUB_RAW_BASE}/metadata/nvdax.json`,
        },
    ];

    for (const token of TOKENS) {
        console.log(`\n📝 Processing ${token.symbol}...`);
        console.log("   Mint:", token.mint.toBase58());
        console.log("   New Name:", token.name);
        console.log("   URI:", token.uri);

        const metadataPDA = getMetadataPDA(token.mint);
        console.log("   Metadata PDA:", metadataPDA.toBase58());

        // Check if metadata already exists
        const metadataAccount = await connection.getAccountInfo(metadataPDA);
        const metadataExists = metadataAccount !== null;

        console.log("   Metadata exists:", metadataExists);

        let instructionData: Buffer;
        let keys: any[];

        if (metadataExists) {
            console.log("   📝 Updating existing metadata...");
            instructionData = createUpdateMetadataData(token.name, token.symbol, token.uri);
            keys = [
                { pubkey: metadataPDA, isSigner: false, isWritable: true },
                { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // update authority
            ];
        } else {
            console.log("   📝 Creating new metadata...");
            instructionData = createMetadataData(token.name, token.symbol, token.uri);
            keys = [
                { pubkey: metadataPDA, isSigner: false, isWritable: true },
                { pubkey: token.mint, isSigner: false, isWritable: false },
                { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // mint authority
                { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
                { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // update authority
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ];
        }

        try {
            const instruction = {
                keys,
                programId: TOKEN_METADATA_PROGRAM_ID,
                data: instructionData,
            };

            const tx = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
            console.log("   ✅ Success! Tx:", signature);
            console.log("   🔗 Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        } catch (error: any) {
            console.error("   ❌ Failed:", error.message);
            if (error.logs) {
                error.logs.slice(-10).forEach((log: string) => console.error("   ", log));
            }
        }
    }

    console.log("\n==========================================");
    console.log("Done!");
    console.log("==========================================");
}

main().catch(console.error);

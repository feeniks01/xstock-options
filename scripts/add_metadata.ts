import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi";
import { createMetadataAccountV3 } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import os from "os";

// Mints
const MOCK_MINT = new PublicKey("BAjbiKHET3QPxCURq6tBDZmSs62jCQrZTg2FKcK56AY2");
const QUOTE_MINT = new PublicKey("DG7pxSEQQ7rCPnLPcQTP3dtJTvZ6qCaf44vZ8xTyC95K");

async function main() {
    // Load wallet
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/id.json`;
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
    const payerKeypair = Keypair.fromSecretKey(secretKey);

    // Create Umi instance
    const umi = createUmi("https://api.devnet.solana.com");
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    const signer = createSignerFromKeypair(umi, keypair);

    umi.use(signerIdentity(signer));

    console.log("Adding metadata to xStock...");
    await createMetadataAccountV3(umi, {
        mint: fromWeb3JsPublicKey(MOCK_MINT),
        mintAuthority: signer,
        payer: signer,
        data: {
            name: "xStock Option Token",
            symbol: "xSTOCK",
            uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json", // Placeholder URI
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        },
        isMutable: true,
        collectionDetails: null,
    }).sendAndConfirm(umi);
    console.log("xStock metadata added.");

    console.log("Adding metadata to USDC...");
    await createMetadataAccountV3(umi, {
        mint: fromWeb3JsPublicKey(QUOTE_MINT),
        mintAuthority: signer,
        payer: signer,
        data: {
            name: "Mock USDC",
            symbol: "USDC",
            uri: "https://shdw-drive.genesysgo.net/6tcnBSybPG7piEDShBcrVtYJDPSvGrDbVvXmXKpzBvWP/usdc.json",
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        },
        isMutable: true,
        collectionDetails: null,
    }).sendAndConfirm(umi);
    console.log("USDC metadata added.");
}

main().catch(console.error);

/**
 * Convert Phantom Private Key to Solana Keypair JSON
 * 
 * Usage: npx ts-node scripts/convert-phantom-key.ts YOUR_PHANTOM_PRIVATE_KEY
 */

import * as bs58 from "bs58";
import * as fs from "fs";

const phantomKey = process.argv[2];

if (!phantomKey) {
    console.log("\n📋 Paste your Phantom private key as an argument:");
    console.log("   npx ts-node scripts/convert-phantom-key.ts YOUR_KEY_HERE\n");
    process.exit(1);
}

try {
    // Decode base58 private key
    const decoded = bs58.decode(phantomKey);
    const keypairArray = Array.from(decoded);
    
    // Save to file
    const outputPath = "./my-wallet.json";
    fs.writeFileSync(outputPath, JSON.stringify(keypairArray));
    
    // Get public key
    const { Keypair } = require("@solana/web3.js");
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairArray));
    
    console.log("\n✅ Keypair converted!");
    console.log(`   Public Key: ${keypair.publicKey.toBase58()}`);
    console.log(`   Saved to: ${outputPath}`);
    console.log("\n📝 Next: Run the setup script:");
    console.log(`   KEYPAIR=${outputPath} npx ts-node scripts/setup-demo-vault.ts\n`);
} catch (error: any) {
    console.error("\n❌ Invalid key format:", error.message);
    process.exit(1);
}


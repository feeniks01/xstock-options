import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const MINT_ADDRESS = new PublicKey("5AuU5y36pg19rnVoXepsVXcoeQiX36hvAk2EGcBhktbp");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const mintInfo = await getMint(connection, MINT_ADDRESS);
    console.log(`Mint: ${MINT_ADDRESS.toBase58()}`);
    console.log(`Decimals: ${mintInfo.decimals}`);
    console.log(`Supply: ${mintInfo.supply}`);
}

main().catch(console.error);

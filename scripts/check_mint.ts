import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const MOCK_MINT = new PublicKey("6a57JJHxnTkbb6YDWmZPtWirFpfdxLcpNqeD5zqjziiD");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const mintInfo = await getMint(connection, MOCK_MINT);
    console.log("Mint:", MOCK_MINT.toBase58());
    console.log("Decimals:", mintInfo.decimals);
    console.log("Supply:", mintInfo.supply.toString());
}

main().catch(console.error);

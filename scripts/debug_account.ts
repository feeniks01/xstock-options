import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const ACCOUNT_ADDR = "2Hrevx5KpfGRgvbBrX6Wz6MW721pZxP3VfTwxREGjoGp";
const WALLET_ADDR = "5vgNkaubssvJ7q6tuSx6QFt9Lkit4WuvMApLFGGkZxdX";
const MINT_ADDR = "BAjbiKHET3QPxCURq6tBDZmSs62jCQrZTg2FKcK56AY2";

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const pubkey = new PublicKey(ACCOUNT_ADDR);
    const wallet = new PublicKey(WALLET_ADDR);
    const mint = new PublicKey(MINT_ADDR);

    console.log(`Checking account: ${ACCOUNT_ADDR}`);

    const info = await connection.getAccountInfo(pubkey);
    if (!info) {
        console.log("Account does NOT exist.");
    } else {
        console.log("Account exists.");
        console.log("Owner:", info.owner.toBase58());
        console.log("Data length:", info.data.length);
    }

    // Check expected ATA
    const [expectedAta] = PublicKey.findProgramAddressSync(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );
    console.log(`Expected ATA for wallet ${WALLET_ADDR} and mint ${MINT_ADDR}:`);
    console.log(expectedAta.toBase58());

    if (expectedAta.equals(pubkey)) {
        console.log("MATCH: This IS the expected ATA.");
    } else {
        console.log("MISMATCH: This is NOT the expected ATA.");
    }
}

main().catch(console.error);

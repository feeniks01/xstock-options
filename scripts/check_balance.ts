import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const WALLET = process.argv[2] || "AMeRGBtpAvgzMVbmAu7sSYZwGCAH51c2G6nMsyMvq1Vx";
const XSTOCK_MINT = "6a57JJHxnTkbb6YDWmZPtWirFpfdxLcpNqeD5zqjziiD";
const USDC_MINT = "5AuU5y36pg19rnVoXepsVXcoeQiX36hvAk2EGcBhktbp";

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = new PublicKey(WALLET);

    console.log(`\nChecking wallet: ${WALLET}\n`);

    // Check SOL balance
    const solBalance = await connection.getBalance(wallet);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);

    // Check USDC token account
    const [usdcAta] = PublicKey.findProgramAddressSync(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(USDC_MINT).toBuffer()],
        new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );
    console.log(`\nUSDC ATA: ${usdcAta.toBase58()}`);

    try {
        const usdcAccount = await getAccount(connection, usdcAta);
        console.log(`✅ USDC Account exists`);
        console.log(`   Balance: ${Number(usdcAccount.amount) / 1_000_000} USDC`);
    } catch (e) {
        console.log(`❌ USDC ATA does not exist`);
    }

    // Check xStock token account
    const [xStockAta] = PublicKey.findProgramAddressSync(
        [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(XSTOCK_MINT).toBuffer()],
        new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );
    console.log(`\nxStock ATA: ${xStockAta.toBase58()}`);

    try {
        const xStockAccount = await getAccount(connection, xStockAta);
        console.log(`✅ xStock Account exists`);
        console.log(`   Balance: ${Number(xStockAccount.amount) / 1_000_000} tokens`);
    } catch (e) {
        console.log(`❌ xStock ATA does not exist (this is OK for buying, only needed for exercising)`);
    }
}

main().catch(console.error);

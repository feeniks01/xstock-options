import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "../app/anchor/idl.json";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";

const programId = new PublicKey("Hc2qWi4vf3zng35gyucQNfZVi6ik7kkgwg3NonMsLcFJ");

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Create a dummy wallet for read-only operations
    const dummyWallet: Wallet = {
        publicKey: PublicKey.default,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
    };

    const provider = new AnchorProvider(connection, dummyWallet, {});
    // @ts-ignore
    idl.address = programId.toBase58();
    // @ts-ignore
    const program = new Program(idl as any, provider);

    console.log("Fetching all CoveredCall accounts...\n");

    try {
        // @ts-ignore
        const accounts = await program.account.coveredCall.all();

        if (accounts.length === 0) {
            console.log("No covered call accounts found.");
        } else {
            console.log(`Found ${accounts.length} covered call account(s):\n`);

            accounts.forEach((acc: any, idx: number) => {
                const data = acc.account;
                console.log(`--- Listing ${idx + 1} ---`);
                console.log(`Address: ${acc.publicKey.toBase58()}`);
                console.log(`Seller: ${data.seller.toBase58()}`);
                console.log(`Buyer: ${data.buyer ? data.buyer.toBase58() : "None (Not Sold)"}`);
                console.log(`xStock Mint: ${data.xstockMint.toBase58()}`);
                console.log(`Quote Mint: ${data.quoteMint.toBase58()}`);
                console.log(`Strike: ${data.strike.toNumber() / 1_000_000} USDC`);
                console.log(`Premium: ${data.premium.toNumber() / 1_000_000} USDC`);
                console.log(`Expiry: ${new Date(data.expiryTs.toNumber() * 1000).toLocaleString()}`);
                console.log(`Exercised: ${data.exercised}`);
                console.log(`Cancelled: ${data.cancelled}`);
                console.log("");
            });
        }
    } catch (err) {
        console.error("Error fetching accounts:", err);
    }
}

main().catch(console.error);

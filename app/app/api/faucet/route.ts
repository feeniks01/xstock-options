/**
 * NVDAx Faucet API
 * Mints mock NVDAx tokens to the requesting wallet
 * Uses the same mint as the deployed vault
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, getMint } from '@solana/spl-token';

// Mock NVDAx token mint on devnet - this is the actual underlying mint used by the vault
const MOCK_NVDAX_MINT = new PublicKey("D6wYCkoFg1PyQn1fX21Vv2Z1h1M5oSSK26AHtRvahdTB");

// Mint authority private key (from environment variable)
// This should be the keypair that created the mock token (JSON array format)
const getMintAuthority = (): Keypair | null => {
    const privateKey = process.env.MINT_AUTHORITY_PRIVATE_KEY;
    if (!privateKey) {
        console.error("MINT_AUTHORITY_PRIVATE_KEY not set in environment");
        return null;
    }
    try {
        // Parse JSON array format: [1,2,3,...,64]
        const secretKey = JSON.parse(privateKey);
        return Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch (error) {
        console.error("Invalid MINT_AUTHORITY_PRIVATE_KEY format (expected JSON array):", error);
        return null;
    }
};

// Rate limiting - simple in-memory store
const mintRequests: Map<string, number> = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per wallet

export async function POST(request: NextRequest) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress) {
            return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
        }

        // Validate wallet address
        let recipientPubkey: PublicKey;
        try {
            recipientPubkey = new PublicKey(walletAddress);
        } catch {
            return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
        }

        // Rate limiting check
        const lastRequest = mintRequests.get(walletAddress);
        if (lastRequest && Date.now() - lastRequest < COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - lastRequest)) / 1000);
            return NextResponse.json(
                { error: `Rate limited. Try again in ${remainingSeconds} seconds.` },
                { status: 429 }
            );
        }

        // Get mint authority
        const mintAuthority = getMintAuthority();
        if (!mintAuthority) {
            return NextResponse.json(
                { error: "Faucet not configured. Contact admin." },
                { status: 500 }
            );
        }

        // Connect to devnet
        const connection = new Connection(
            process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
            "confirmed"
        );

        console.log("Using underlying mint:", MOCK_NVDAX_MINT.toBase58());

        // Get mint info
        const mintInfo = await getMint(connection, MOCK_NVDAX_MINT);

        // Verify we have mint authority
        if (!mintInfo.mintAuthority?.equals(mintAuthority.publicKey)) {
            console.error("Configured keypair is not the mint authority");
            console.error("Expected:", mintAuthority.publicKey.toBase58());
            console.error("Got:", mintInfo.mintAuthority?.toBase58());
            return NextResponse.json(
                { error: "Faucet misconfigured. Contact admin." },
                { status: 500 }
            );
        }

        // Amount to mint: 100 NVDAx tokens
        const amountTokens = 100;
        const decimals = mintInfo.decimals;
        const amountBaseUnits = amountTokens * Math.pow(10, decimals);

        // Get or create recipient's token account
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            mintAuthority,
            MOCK_NVDAX_MINT,
            recipientPubkey
        );

        // Mint tokens
        const signature = await mintTo(
            connection,
            mintAuthority,
            MOCK_NVDAX_MINT,
            recipientTokenAccount.address,
            mintAuthority,
            amountBaseUnits
        );

        // Record this request for rate limiting
        mintRequests.set(walletAddress, Date.now());

        return NextResponse.json({
            success: true,
            signature,
            amount: amountTokens,
            tokenAccount: recipientTokenAccount.address.toBase58(),
            mint: MOCK_NVDAX_MINT.toBase58(),
        });

    } catch (error: any) {
        console.error("Faucet error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to mint tokens" },
            { status: 500 }
        );
    }
}

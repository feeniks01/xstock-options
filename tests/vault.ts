import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";

describe("vault", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Vault as Program<Vault>;
    const authority = provider.wallet;
    const assetId = "NVDAx";

    let vaultPda: anchor.web3.PublicKey;
    let shareMintPda: anchor.web3.PublicKey;
    let vaultTokenAccountPda: anchor.web3.PublicKey;
    let underlyingMint: anchor.web3.PublicKey;
    let userTokenAccount: anchor.web3.PublicKey;
    let userShareAccount: anchor.web3.PublicKey;

    before(async () => {
        // Derive PDAs
        [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), Buffer.from(assetId)],
            program.programId
        );

        [shareMintPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("shares"), vaultPda.toBuffer()],
            program.programId
        );

        [vaultTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("vault_tokens"), vaultPda.toBuffer()],
            program.programId
        );

        // Create underlying token mint
        underlyingMint = await createMint(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            authority.publicKey,
            null,
            6 // 6 decimals
        );

        // Create user's token accounts
        const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            underlyingMint,
            authority.publicKey
        );
        userTokenAccount = userTokenAccountInfo.address;

        // Mint some tokens to user
        await mintTo(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            underlyingMint,
            userTokenAccount,
            authority.publicKey,
            1_000_000_000 // 1000 tokens
        );
    });

    it("initializes a vault", async () => {
        const utilizationCapBps = 7500; // 75%

        const tx = await program.methods
            .initializeVault(assetId, utilizationCapBps)
            .accounts({
                vault: vaultPda,
                underlyingMint: underlyingMint,
                shareMint: shareMintPda,
                vaultTokenAccount: vaultTokenAccountPda,
                authority: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log("Initialize vault tx:", tx);

        const vault = await program.account.vault.fetch(vaultPda);
        expect(vault.assetId).to.equal(assetId);
        expect(vault.utilizationCapBps).to.equal(utilizationCapBps);
        expect(vault.totalAssets.toNumber()).to.equal(0);
        expect(vault.totalShares.toNumber()).to.equal(0);
        expect(vault.epoch.toNumber()).to.equal(0);
    });

    it("deposits tokens and mints shares", async () => {
        // Create user's share account
        const userShareAccountInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            shareMintPda,
            authority.publicKey
        );
        userShareAccount = userShareAccountInfo.address;

        const depositAmount = new anchor.BN(100_000_000); // 100 tokens

        const tx = await program.methods
            .deposit(depositAmount)
            .accounts({
                vault: vaultPda,
                shareMint: shareMintPda,
                vaultTokenAccount: vaultTokenAccountPda,
                userTokenAccount: userTokenAccount,
                userShareAccount: userShareAccount,
                user: authority.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log("Deposit tx:", tx);

        const vault = await program.account.vault.fetch(vaultPda);
        expect(vault.totalAssets.toNumber()).to.equal(100_000_000);
        expect(vault.totalShares.toNumber()).to.equal(100_000_000); // 1:1 for first deposit
    });

    it("advances epoch with premium", async () => {
        const premiumEarned = new anchor.BN(5_000_000); // 5 tokens premium

        const tx = await program.methods
            .advanceEpoch(premiumEarned)
            .accounts({
                vault: vaultPda,
                authority: authority.publicKey,
            })
            .rpc();

        console.log("Advance epoch tx:", tx);

        const vault = await program.account.vault.fetch(vaultPda);
        expect(vault.epoch.toNumber()).to.equal(1);
        expect(vault.totalAssets.toNumber()).to.equal(105_000_000); // Original + premium
        expect(vault.totalShares.toNumber()).to.equal(100_000_000); // Shares unchanged
    });

    it("requests withdrawal", async () => {
        const [withdrawalPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("withdrawal"), vaultPda.toBuffer(), authority.publicKey.toBuffer()],
            program.programId
        );

        const sharesToWithdraw = new anchor.BN(50_000_000); // 50 shares

        const tx = await program.methods
            .requestWithdrawal(sharesToWithdraw)
            .accounts({
                vault: vaultPda,
                withdrawalRequest: withdrawalPda,
                userShareAccount: userShareAccount,
                user: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Request withdrawal tx:", tx);

        const withdrawal = await program.account.withdrawalRequest.fetch(withdrawalPda);
        expect(withdrawal.shares.toNumber()).to.equal(50_000_000);
        expect(withdrawal.requestEpoch.toNumber()).to.equal(1);
        expect(withdrawal.processed).to.be.false;
    });
});

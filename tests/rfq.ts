import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rfq } from "../target/types/rfq";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";

describe("rfq", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Rfq as Program<Rfq>;
    const authority = provider.wallet;

    let configPda: anchor.web3.PublicKey;
    let makerKeypair: anchor.web3.Keypair;
    let makerAccountPda: anchor.web3.PublicKey;
    let rfqPda: anchor.web3.PublicKey;
    let usdcMint: anchor.web3.PublicKey;
    let creatorTokenAccount: anchor.web3.PublicKey;
    let makerTokenAccount: anchor.web3.PublicKey;

    before(async () => {
        // Derive config PDA
        [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("config")],
            program.programId
        );

        // Create maker keypair
        makerKeypair = anchor.web3.Keypair.generate();

        // Airdrop SOL to maker
        const airdropSig = await provider.connection.requestAirdrop(
            makerKeypair.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(airdropSig);

        // Derive maker account PDA
        [makerAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("maker"), makerKeypair.publicKey.toBuffer()],
            program.programId
        );

        // Create USDC mock mint
        usdcMint = await createMint(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            authority.publicKey,
            null,
            6
        );

        // Create creator's token account
        const creatorTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            usdcMint,
            authority.publicKey
        );
        creatorTokenAccount = creatorTokenAccountInfo.address;

        // Create maker's token account and mint tokens
        const makerTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            usdcMint,
            makerKeypair.publicKey
        );
        makerTokenAccount = makerTokenAccountInfo.address;

        await mintTo(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            usdcMint,
            makerTokenAccount,
            authority.publicKey,
            100_000_000_000 // 100,000 USDC
        );
    });

    it("initializes the RFQ config", async () => {
        const tx = await program.methods
            .initialize()
            .accounts({
                config: configPda,
                authority: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Initialize config tx:", tx);

        const config = await program.account.config.fetch(configPda);
        expect(config.authority.toString()).to.equal(authority.publicKey.toString());
        expect(config.rfqCount.toNumber()).to.equal(0);
    });

    it("adds a maker to the allowlist", async () => {
        const tx = await program.methods
            .addMaker(makerKeypair.publicKey)
            .accounts({
                config: configPda,
                makerAccount: makerAccountPda,
                authority: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Add maker tx:", tx);

        const makerAccount = await program.account.makerAccount.fetch(makerAccountPda);
        expect(makerAccount.maker.toString()).to.equal(makerKeypair.publicKey.toString());
        expect(makerAccount.isActive).to.be.true;
        expect(makerAccount.totalFills.toNumber()).to.equal(0);
    });

    it("creates an RFQ", async () => {
        // First get current rfq count
        const config = await program.account.config.fetch(configPda);
        const rfqId = config.rfqCount;

        [rfqPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("rfq"), rfqId.toArrayLike(Buffer, "le", 8)],
            program.programId
        );

        const underlying = anchor.web3.Keypair.generate().publicKey;
        const optionType = { call: {} };
        const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400); // 1 day
        const strike = new anchor.BN(150_000_000); // $150
        const size = new anchor.BN(10_000_000); // 10 contracts
        const premiumFloor = new anchor.BN(500_000); // $0.50
        const validUntilTs = new anchor.BN(Math.floor(Date.now() / 1000) + 300); // 5 min
        const settlement = { cash: {} };
        const oraclePrice = new anchor.BN(145_000_000); // $145
        const oracleTs = new anchor.BN(Math.floor(Date.now() / 1000));

        const tx = await program.methods
            .createRfq(
                underlying,
                optionType,
                expiryTs,
                strike,
                size,
                premiumFloor,
                validUntilTs,
                settlement,
                oraclePrice,
                oracleTs
            )
            .accounts({
                config: configPda,
                rfq: rfqPda,
                creator: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Create RFQ tx:", tx);

        const rfq = await program.account.rfq.fetch(rfqPda);
        expect(rfq.id.toNumber()).to.equal(0);
        expect(rfq.strike.toNumber()).to.equal(150_000_000);
        expect(rfq.premiumFloor.toNumber()).to.equal(500_000);
        expect(rfq.status.open).to.exist;
    });

    it("fills an RFQ", async () => {
        const premium = new anchor.BN(1_000_000); // $1.00 premium

        const tx = await program.methods
            .fillRfq(premium)
            .accounts({
                config: configPda,
                rfq: rfqPda,
                makerAccount: makerAccountPda,
                creatorTokenAccount: creatorTokenAccount,
                makerTokenAccount: makerTokenAccount,
                maker: makerKeypair.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([makerKeypair])
            .rpc();

        console.log("Fill RFQ tx:", tx);

        const rfq = await program.account.rfq.fetch(rfqPda);
        expect(rfq.status.filled).to.exist;
        expect(rfq.filledBy.toString()).to.equal(makerKeypair.publicKey.toString());
        expect(rfq.filledPremium.toNumber()).to.equal(1_000_000);

        const makerAccount = await program.account.makerAccount.fetch(makerAccountPda);
        expect(makerAccount.totalFills.toNumber()).to.equal(1);
        expect(makerAccount.totalPremiumPaid.toNumber()).to.equal(1_000_000);
    });
});

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Oracle } from "../target/types/oracle";
import { expect } from "chai";

describe("oracle (Pyth integration)", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Oracle as Program<Oracle>;
    const authority = provider.wallet;
    const assetId = "NVDAx";

    // Mock Pyth price account (in production, use real Pyth account)
    const mockPythPriceAccount = anchor.web3.Keypair.generate().publicKey;

    let assetConfigPda: anchor.web3.PublicKey;
    let bump: number;

    before(async () => {
        [assetConfigPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("asset"), Buffer.from(assetId)],
            program.programId
        );
    });

    it("initializes an asset config", async () => {
        const tx = await program.methods
            .initializeAsset(assetId, mockPythPriceAccount)
            .accounts({
                assetConfig: assetConfigPda,
                authority: authority.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("Initialize asset tx:", tx);

        const account = await program.account.assetConfig.fetch(assetConfigPda);
        expect(account.authority.toString()).to.equal(authority.publicKey.toString());
        expect(account.assetId).to.equal(assetId);
        expect(account.pythPriceAccount.toString()).to.equal(mockPythPriceAccount.toString());
    });

    it("updates the Pyth price account", async () => {
        const newPythAccount = anchor.web3.Keypair.generate().publicKey;

        const tx = await program.methods
            .updatePythAccount(newPythAccount)
            .accounts({
                assetConfig: assetConfigPda,
                authority: authority.publicKey,
            })
            .rpc();

        console.log("Update Pyth account tx:", tx);

        const account = await program.account.assetConfig.fetch(assetConfigPda);
        expect(account.pythPriceAccount.toString()).to.equal(newPythAccount.toString());
    });

    it("rejects unauthorized updates", async () => {
        const unauthorizedUser = anchor.web3.Keypair.generate();
        const newPythAccount = anchor.web3.Keypair.generate().publicKey;

        try {
            await program.methods
                .updatePythAccount(newPythAccount)
                .accounts({
                    assetConfig: assetConfigPda,
                    authority: unauthorizedUser.publicKey,
                })
                .signers([unauthorizedUser])
                .rpc();
            expect.fail("Should have thrown an error");
        } catch (error) {
            expect(error.message).to.include("A has one constraint was violated");
        }
    });

    // Note: get_price instruction requires an actual Pyth price account with valid data
    // For testing on devnet, use a real Pyth price account like:
    // NVDAX: Feed ID 0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f
});

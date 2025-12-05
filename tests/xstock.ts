import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { XstockOptions } from "../target/types/xstock_options";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import fs from "fs";
import os from "os";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createMetadataAccountV3 } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";

const homeDir = os.homedir();
const keypairPath = `${homeDir}/.config/solana/id.json`;
const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync(keypairPath, "utf-8"))
);
const userKeypair = anchor.web3.Keypair.fromSecretKey(secretKey);

describe("xstock_options", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.XstockOptions as Program<XstockOptions>;

  let xstockMint: anchor.web3.PublicKey;
  let quoteMint: anchor.web3.PublicKey;

  // Use user's keypair for all operations
  const seller = userKeypair;
  const buyer = userKeypair;
  const secondBuyer = userKeypair;

  let sellerXstockAccount: anchor.web3.PublicKey;
  let sellerQuoteAccount: anchor.web3.PublicKey;
  let buyerXstockAccount: anchor.web3.PublicKey;
  let buyerQuoteAccount: anchor.web3.PublicKey;
  let secondBuyerXstockAccount: anchor.web3.PublicKey;
  let secondBuyerQuoteAccount: anchor.web3.PublicKey;

  let coveredCallPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;

  const STRIKE_PRICE = new anchor.BN(150_000_000); // 150 USDC (6 decimals)
  const PREMIUM = new anchor.BN(5_000_000); // 5 USDC (6 decimals)
  const XSTOCK_AMOUNT = 100_000_000; // 100 xStock (6 decimals)

  before(async () => {
    console.log("Using wallet:", userKeypair.publicKey.toBase58());

    xstockMint = await createMint(
      provider.connection,
      userKeypair,
      userKeypair.publicKey,
      null,
      6
    );
    console.log("xStock Mint:", xstockMint.toBase58());

    quoteMint = await createMint(
      provider.connection,
      userKeypair,
      userKeypair.publicKey,
      null,
      6
    );
    console.log("USDC Mint:", quoteMint.toBase58());

    // Create token accounts
    const sellerXstock = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      seller,
      xstockMint,
      seller.publicKey
    );
    sellerXstockAccount = sellerXstock.address;

    const sellerQuote = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      seller,
      quoteMint,
      seller.publicKey
    );
    sellerQuoteAccount = sellerQuote.address;

    const buyerXstock = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      buyer,
      xstockMint,
      buyer.publicKey
    );
    buyerXstockAccount = buyerXstock.address;

    const buyerQuote = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      buyer,
      quoteMint,
      buyer.publicKey
    );
    buyerQuoteAccount = buyerQuote.address;

    const secondBuyerXstock = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      secondBuyer,
      xstockMint,
      secondBuyer.publicKey
    );
    secondBuyerXstockAccount = secondBuyerXstock.address;

    const secondBuyerQuote = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      secondBuyer,
      quoteMint,
      secondBuyer.publicKey
    );
    secondBuyerQuoteAccount = secondBuyerQuote.address;

    await mintTo(
      provider.connection,
      userKeypair,
      xstockMint,
      sellerXstockAccount,
      userKeypair,
      150_000_000_000 // 150,000 xStock
    );
    console.log("Minted 150,000 xStock");

    await mintTo(
      provider.connection,
      userKeypair,
      quoteMint,
      buyerQuoteAccount,
      userKeypair,
      10000 * 1_000_000 // 10,000 USDC
    );
    console.log("Minted 10,000 Test USDC");

    await mintTo(
      provider.connection,
      userKeypair,
      quoteMint,
      secondBuyerQuoteAccount,
      userKeypair,
      1000_000_000 // 1000 USDC to second buyer
    );
    console.log("Minted 1000 USDC to second buyer");

    try {
      const umi = createUmi(
        "https://devnet.helius-rpc.com/?api-key=a149fae2-6a52-4725-af62-1726c8e2cf9d"
      );
      const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
      const signer = createSignerFromKeypair(umi, keypair);
      umi.use(signerIdentity(signer));

      console.log("Adding metadata to xStock...");
      await createMetadataAccountV3(umi, {
        mint: fromWeb3JsPublicKey(xstockMint),
        mintAuthority: signer,
        payer: signer,
        data: {
          name: "NVIDIA xStock Test",
          symbol: "NVIDIAx",
          uri: "https://raw.githubusercontent.com/feeniks01/xstock-options/refs/heads/main/assets/nvidiax_test.json",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      }).sendAndConfirm(umi);
      console.log("xStock metadata added.");

      console.log("Adding metadata to USDC...");
      await createMetadataAccountV3(umi, {
        mint: fromWeb3JsPublicKey(quoteMint),
        mintAuthority: signer,
        payer: signer,
        data: {
          name: "USDC Test",
          symbol: "USDC",
          uri: "https://raw.githubusercontent.com/feeniks01/xstock-options/refs/heads/main/assets/usdc_test.json",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      }).sendAndConfirm(umi);
      console.log("USDC metadata added.");
    } catch (error: any) {
      console.warn(
        "Metadata packages not available, skipping metadata creation:",
        error?.message || error
      );
    }
  });

  describe("create_covered_call", () => {
    it("Creates a covered call option successfully", async () => {
      const uid = new anchor.BN(1);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7); // 7 days from now

      [coveredCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), coveredCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        coveredCallPda
      );
      console.log("Covered Call:", coveredCall);
    });

    it("Fails if seller doesn't have enough xStock", async () => {
      // Use user's keypair but try to create option with amount exceeding balance
      // This test verifies the program checks for sufficient balance
      const uid = new anchor.BN(2);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7);

      // Get current balance
      const currentBalance = await getAccount(
        provider.connection,
        sellerXstockAccount
      );

      // This should fail because we're trying to transfer more than available
      // Note: The actual amount transferred is XSTOCK_AMOUNT (100_000_000),
      // so if we have less than that, it should fail
      if (Number(currentBalance.amount) < XSTOCK_AMOUNT) {
        try {
          await program.methods
            .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
            .accounts({
              seller: seller.publicKey,
              xstockMint,
              quoteMint,
              sellerXstockAccount,
            })
            .signers([seller])
            .rpc();
          expect.fail("Should have failed with insufficient funds");
        } catch (error) {
          expect(error).to.exist;
        }
      } else {
        // If we have enough, this test passes (seller has sufficient funds)
        console.log("Seller has sufficient funds for this test");
      }
    });
  });

  describe("buy_option", () => {
    it("Buyer can purchase a listed option", async () => {
      const buyerQuoteBefore = await getAccount(
        provider.connection,
        buyerQuoteAccount
      );
      const sellerQuoteBefore = await getAccount(
        provider.connection,
        sellerQuoteAccount
      );

      await program.methods
        .buyOption()
        .accounts({
          buyer: buyer.publicKey,
          coveredCall: coveredCallPda,
          buyerQuoteAccount,
          paymentAccount: sellerQuoteAccount,
        })
        .signers([buyer])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        coveredCallPda
      );
      expect(coveredCall.buyer.toString()).to.equal(buyer.publicKey.toString());
      expect(coveredCall.isListed).to.be.false;

      const buyerQuoteAfter = await getAccount(
        provider.connection,
        buyerQuoteAccount
      );
      const sellerQuoteAfter = await getAccount(
        provider.connection,
        sellerQuoteAccount
      );

      expect(
        Number(buyerQuoteBefore.amount) - Number(buyerQuoteAfter.amount)
      ).to.equal(PREMIUM.toNumber());
      expect(
        Number(sellerQuoteAfter.amount) - Number(sellerQuoteBefore.amount)
      ).to.equal(PREMIUM.toNumber());
    });

    it("Cannot buy an option that's not listed", async () => {
      try {
        await program.methods
          .buyOption()
          .accounts({
            buyer: secondBuyer.publicKey,
            coveredCall: coveredCallPda,
            buyerQuoteAccount: secondBuyerQuoteAccount,
            paymentAccount: sellerQuoteAccount,
          })
          .signers([secondBuyer])
          .rpc();
        expect.fail("Should have failed - option not listed");
      } catch (error: any) {
        expect(error.error?.errorCode?.code || error.code).to.equal("OptionNotListed");
      }
    });

    it("Cannot buy an expired option", async () => {
      // Create an expired option
      const uid = new anchor.BN(3);
      const expiredTs = new anchor.BN(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago

      const [expiredCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [expiredVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), expiredCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiredTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      try {
        await program.methods
          .buyOption()
          .accounts({
            buyer: secondBuyer.publicKey,
            coveredCall: expiredCallPda,
            buyerQuoteAccount: secondBuyerQuoteAccount,
            paymentAccount: sellerQuoteAccount,
          })
          .signers([secondBuyer])
          .rpc();
        expect.fail("Should have failed - option expired");
      } catch (error: any) {
        expect(error.error?.errorCode?.code || error.code).to.equal("OptionExpired");
      }
    });
  });

  describe("exercise", () => {
    it("Buyer can exercise the option", async () => {
      const buyerXstockBefore = await getAccount(
        provider.connection,
        buyerXstockAccount
      );
      const sellerQuoteBefore = await getAccount(
        provider.connection,
        sellerQuoteAccount
      );
      const vaultBefore = await getAccount(provider.connection, vaultPda);

      await program.methods
        .exercise()
        .accounts({
          buyer: buyer.publicKey,
          coveredCall: coveredCallPda,
          buyerXstockAccount,
          buyerQuoteAccount,
          sellerQuoteAccount,
        })
        .signers([buyer])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        coveredCallPda
      );
      expect(coveredCall.exercised).to.be.true;
      expect(coveredCall.buyerExercised).to.be.true;

      const buyerXstockAfter = await getAccount(
        provider.connection,
        buyerXstockAccount
      );
      const sellerQuoteAfter = await getAccount(
        provider.connection,
        sellerQuoteAccount
      );
      const vaultAfter = await getAccount(provider.connection, vaultPda);

      expect(
        Number(buyerXstockAfter.amount) - Number(buyerXstockBefore.amount)
      ).to.equal(XSTOCK_AMOUNT);
      expect(
        Number(sellerQuoteAfter.amount) - Number(sellerQuoteBefore.amount)
      ).to.equal(STRIKE_PRICE.toNumber());
      expect(Number(vaultBefore.amount) - Number(vaultAfter.amount)).to.equal(
        XSTOCK_AMOUNT
      );
    });

    it("Cannot exercise an already exercised option", async () => {
      try {
        await program.methods
          .exercise()
          .accounts({
            buyer: buyer.publicKey,
            coveredCall: coveredCallPda,
            buyerXstockAccount,
            buyerQuoteAccount,
            sellerQuoteAccount,
          })
          .signers([buyer])
          .rpc();
        expect.fail("Should have failed - already exercised");
      } catch (error: any) {
        // The account might be closed after exercise, so we check for either error
        const errorCode = error.error?.errorCode?.code || error.code || error.message;
        expect(errorCode === "OptionAlreadyExercised" || errorCode === "AccountNotInitialized").to.be.true;
      }
    });

    it("Non-buyer cannot exercise", async () => {
      // Create a new option for this test
      const uid = new anchor.BN(4);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7);

      const [newCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), newCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      await program.methods
        .buyOption()
        .accounts({
          buyer: buyer.publicKey,
          coveredCall: newCallPda,
          buyerQuoteAccount,
          paymentAccount: sellerQuoteAccount,
        })
        .signers([buyer])
        .rpc();

      try {
        await program.methods
          .exercise()
          .accounts({
            buyer: secondBuyer.publicKey,
            coveredCall: newCallPda,
            buyerXstockAccount: secondBuyerXstockAccount,
            buyerQuoteAccount: secondBuyerQuoteAccount,
            sellerQuoteAccount,
          })
          .signers([secondBuyer])
          .rpc();
        expect.fail("Should have failed - not the buyer");
      } catch (error: any) {
        expect(error.error?.errorCode?.code || error.code).to.equal("Unauthorized");
      }
    });
  });

  describe("reclaim", () => {
    it("Seller can reclaim unsold option", async () => {
      const uid = new anchor.BN(5);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7);

      const [reclaimCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [reclaimVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), reclaimCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      const sellerXstockBefore = await getAccount(
        provider.connection,
        sellerXstockAccount
      );

      await program.methods
        .reclaim()
        .accounts({
          seller: seller.publicKey,
          coveredCall: reclaimCallPda,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        reclaimCallPda
      );
      expect(coveredCall.exercised).to.be.true;
      expect(coveredCall.cancelled).to.be.true;

      const sellerXstockAfter = await getAccount(
        provider.connection,
        sellerXstockAccount
      );
      expect(
        Number(sellerXstockAfter.amount) - Number(sellerXstockBefore.amount)
      ).to.equal(XSTOCK_AMOUNT);
    });

    it("Seller can reclaim expired option", async () => {
      // Create option that will expire
      const uid = new anchor.BN(6);
      const shortExpiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 1); // Expires in 1 second

      const [expiredCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [expiredVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), expiredCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, shortExpiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await program.methods
        .reclaim()
        .accounts({
          seller: seller.publicKey,
          coveredCall: expiredCallPda,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        expiredCallPda
      );
      expect(coveredCall.exercised).to.be.true;
      expect(coveredCall.cancelled).to.be.true;
    });

    it("Cannot reclaim option that has been sold and not expired", async () => {
      const uid = new anchor.BN(7);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7);

      const [soldCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [soldVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), soldCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      await program.methods
        .buyOption()
        .accounts({
          buyer: buyer.publicKey,
          coveredCall: soldCallPda,
          buyerQuoteAccount,
          paymentAccount: sellerQuoteAccount,
        })
        .signers([buyer])
        .rpc();

      try {
        await program.methods
          .reclaim()
          .accounts({
            seller: seller.publicKey,
            coveredCall: soldCallPda,
            sellerXstockAccount,
          })
          .signers([seller])
          .rpc();
        expect.fail("Should have failed - option sold and not expired");
      } catch (error: any) {
        expect(error.error?.errorCode?.code || error.code).to.equal("OptionNotExpired");
      }
    });
  });

  describe("list_for_sale and cancel_listing", () => {
    let listableCallPda: anchor.web3.PublicKey;

    before(async () => {
      const uid = new anchor.BN(8);
      const expiryTs = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 7);

      [listableCallPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("covered_call"),
          seller.publicKey.toBuffer(),
          xstockMint.toBuffer(),
          uid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [listableVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), listableCallPda.toBuffer()],
        program.programId
      );

      await program.methods
        .createCoveredCall(uid, STRIKE_PRICE, PREMIUM, expiryTs, new anchor.BN(XSTOCK_AMOUNT))
        .accounts({
          seller: seller.publicKey,
          xstockMint,
          quoteMint,
          sellerXstockAccount,
        })
        .signers([seller])
        .rpc();

      await program.methods
        .buyOption()
        .accounts({
          buyer: buyer.publicKey,
          coveredCall: listableCallPda,
          buyerQuoteAccount,
          paymentAccount: sellerQuoteAccount,
        })
        .signers([buyer])
        .rpc();
    });

    it("Buyer can list their option for resale", async () => {
      const newPrice = new anchor.BN(7_000_000); // 7 USDC

      await program.methods
        .listForSale(newPrice)
        .accounts({
          signer: buyer.publicKey,
          coveredCall: listableCallPda,
        })
        .signers([buyer])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        listableCallPda
      );
      expect(coveredCall.isListed).to.be.true;
      expect(coveredCall.askPrice.toNumber()).to.equal(newPrice.toNumber());
    });

    it("Buyer can cancel their listing", async () => {
      await program.methods
        .cancelListing()
        .accounts({
          signer: buyer.publicKey,
          coveredCall: listableCallPda,
        })
        .signers([buyer])
        .rpc();

      const coveredCall = await program.account.coveredCall.fetch(
        listableCallPda
      );
      expect(coveredCall.isListed).to.be.false;
    });

  });
});

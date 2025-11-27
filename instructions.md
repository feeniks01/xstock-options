One-Click Covered Calls for xStocks (Solana, Devnet)

1. Summary

Build a Solana-based covered call primitive for xStocks (on-chain tokenized stocks).

Holders of a specific xStock token can, in one flow:
	•	Lock 1 xStock in a program-owned vault
	•	Set strike, premium (in USDC), and expiry
	•	List it as a covered call option
	•	Allow a buyer to purchase the option (paying premium)
	•	At expiry, the option can be exercised or reclaimed based on a price oracle

This project targets the Solana main track and is designed to meet:
	•	Solana track technical requirements
	•	General submission + judging criteria
	•	Optional alignment with Circle USDC / payments bounty via USDC integration

⸻

2. Tracks & Compliance

2.1 Target Track
	•	Primary: Solana Main Track
	•	Deploy program on Solana devnet
	•	Use:
	•	Anchor Framework (Rust) for the on-chain program
	•	@solana/web3.js + Anchor TS in the frontend/client

2.2 Optional Bounty Alignment
	•	Circle / USDC Bounty (optional stretch):
	•	Use USDC on Solana as the quote asset for premiums and (future) strike payments
	•	Stretch: integrate Circle APIs for off-ramp / payments (not required for core MVP)

⸻

3. Problem

There is no simple, approachable UX for writing options on tokenized stocks (xStocks) on Solana.

Users who hold xStocks today:
	•	Can hold, trade, or maybe lend
	•	Cannot easily generate yield via covered calls with a simple, non-degen interface

We want to provide:
	•	A minimal on-chain options lifecycle for xStocks
	•	A user-facing flow that feels like “Robinhood covered calls, but on Solana + USDC”

⸻

4. Goals

G1 — On-chain Covered Call Lifecycle (Solana devnet)

Implement an Anchor program that:
	•	Lets an xStock holder create a covered call listing (lock collateral, set parameters)
	•	Lets a counterparty buy the option (paying premium in USDC)
	•	Supports exercise or reclaim after expiry based on a price feed

G2 — Clean, End-to-End Demo
	•	Wallet-connect UI (web) using Solana wallet adapter
	•	Core flows:
	•	Create covered call
	•	View available calls
	•	Buy option
	•	Exercise or reclaim
	•	Fully working on devnet with a visible program ID and a public GitHub repo

G3 — Technical Rigor & Documentation
	•	Correct use of Solana primitives (accounts, PDAs, token program) and Anchor patterns
	•	Public repo with:
	•	README with table of contents
	•	Setup instructions
	•	Local dev / devnet deployment steps
	•	Architecture + high-level technical summary to plug into submission

⸻

5. Non-Goals (MVP)

Not required for hackathon MVP:
	•	Greeks (delta, gamma, vega, theta) or implied volatility modeling
	•	General options marketplace / AMM / orderbook
	•	Puts, spreads, multi-leg strategies
	•	Cross-asset or cross-chain options
	•	Full Circle API integration (can be stretch)
	•	Support for many xStock mints (MVP: 1 hardcoded xStock + 1 USDC mint)

⸻

6. Architecture Overview

6.1 Components
	1.	Solana / Anchor Program
	•	Implements covered call logic
	•	Owns PDAs for state and vault token accounts
	•	Deployed to devnet
	2.	Frontend (React + @solana/web3.js + Anchor TS)
	•	Connects to devnet via RPC
	•	Provides wallet connect and simple flows
	•	Calls program instructions through Anchor client
	3.	Mock Price Oracle (On-chain Account)
	•	Stores a u64 price updated by an admin key on devnet
	•	Used to determine ITM / OTM at expiry
	•	Future: replace with a Pyth price feed

⸻

7. On-Chain Data Model

7.1 Account: CoveredCall

#[account]
pub struct CoveredCall {
    pub seller: Pubkey,          // writer of the option
    pub buyer: Option<Pubkey>,   // buyer (None if unsold)
    pub xstock_mint: Pubkey,     // xStock mint (fixed for MVP)
    pub quote_mint: Pubkey,      // USDC mint
    pub strike: u64,             // strike in quote token smallest units
    pub premium: u64,            // premium in quote token
    pub expiry_ts: i64,          // unix timestamp
    pub exercised: bool,         // true if already exercised
    pub cancelled: bool,         // true if cancelled pre-sale
}

7.2 Account: Vault (xStock Collateral)
	•	SPL token account PDA that holds exactly 1 xStock per option listing
	•	Owned by the program

7.3 Account: PriceOracle (Mock for MVP)

#[account]
pub struct PriceOracle {
    pub price: u64,   // mocked price of underlying in quote units
}


⸻

8. PDAs
	•	CoveredCall PDA
	•	Seeds: ["covered_call", seller_pubkey, call_id]
	•	Vault PDA
	•	Seeds: ["vault", covered_call_pda]
	•	PriceOracle PDA
	•	Seeds: ["mock_oracle"]

⸻

9. Instructions

9.1 create_covered_call

Called by: Seller

Inputs:
	•	strike: u64
	•	premium: u64
	•	expiry_ts: i64

Accounts:
	•	Seller main account
	•	Seller xStock token account
	•	CoveredCall PDA (init)
	•	Vault PDA token account (init)
	•	xStock mint
	•	USDC mint
	•	Token program, system program, rent, etc.

Behavior:
	•	Initialize CoveredCall with given params:
	•	seller, xstock_mint, quote_mint, strike, premium, expiry_ts
	•	Transfer exactly 1 xStock from seller’s token account into Vault PDA token account
	•	Require expiry_ts > current_timestamp
	•	Ensure only the chosen xstock_mint + quote_mint are allowed (hardcoded or config)

⸻

9.2 buy_option

Called by: Buyer

Inputs: none (parameters read from CoveredCall)

Accounts:
	•	Buyer main account
	•	Buyer USDC token account
	•	Seller USDC token account
	•	CoveredCall
	•	Token program

Behavior:
	•	Check:
	•	CoveredCall.buyer is None
	•	cancelled == false
	•	now < expiry_ts
	•	Transfer premium amount of USDC from buyer’s token account → seller’s token account
	•	Set CoveredCall.buyer = Some(buyer_pubkey)

⸻

9.3 exercise

Called by: Buyer

Inputs: none

Accounts:
	•	Buyer main account
	•	Buyer xStock token account
	•	CoveredCall
	•	Vault PDA token account
	•	PriceOracle account
	•	Token program

Behavior (MVP-simple version):
	•	Require:
	•	CoveredCall.buyer == Some(caller)
	•	now >= expiry_ts
	•	exercised == false
	•	Load price from PriceOracle
	•	If price > strike:
	•	Transfer 1 xStock from Vault token account → buyer xStock token account
	•	Set exercised = true
	•	Else: fail (option is OTM → use reclaim instead)

MVP simplification: we do not transfer strike USDC in this version. In the pitch, we acknowledge this and note that the full implementation would escrow and settle strike as well.

⸻

9.4 reclaim

Called by: Seller

Inputs: none

Accounts:
	•	Seller main account
	•	Seller xStock token account
	•	CoveredCall
	•	Vault token account
	•	PriceOracle
	•	Token program

Behavior:

Two valid cases:
	1.	Expired, unsold:
	•	buyer == None, now >= expiry_ts
	•	Transfer 1 xStock from Vault → seller token account
	•	Close / mark CoveredCall as reclaimed
	2.	Expired, sold but OTM:
	•	buyer.is_some()
	•	now >= expiry_ts
	•	Load price from PriceOracle
	•	If price <= strike:
	•	Transfer 1 xStock from Vault → seller token account
	•	Close / mark CoveredCall as reclaimed

⸻

9.5 update_price (Admin Only)

Called by: Admin wallet (trusted for devnet)

Inputs:
	•	new_price: u64

Behavior:
	•	Update PriceOracle.price = new_price

Used to manually simulate ITM/OTM states during demo.

⸻

10. Frontend / UX Requirements

10.1 Tech Stack
	•	React (Next.js or Vite)
	•	Solana Wallet Adapter
	•	Anchor TypeScript client (@coral-xyz/anchor)
	•	@solana/web3.js

10.2 Screens & User Flows

1) Home / Dashboard
	•	Connect wallet button
	•	Sections:
	•	“Your Covered Calls”
	•	“Available Covered Calls”

2) Create Covered Call
Form:
	•	Strike (number)
	•	Premium (number)
	•	Expiry:
	•	Dropdown: 24h, 72h, 7d → frontend converts to expiry_ts
	•	“Create Covered Call” button

Flow:
	•	Validate user has ≥ 1 xStock token
	•	Call create_covered_call
	•	Show transaction signature & status

3) Browse / Buy Options
For each CoveredCall:
	•	Display:
	•	Seller short address
	•	Strike
	•	Premium
	•	Expiry (countdown)
	•	Status: “Available”, “Sold”, “Expired”, “Exercised”
	•	If:
	•	buyer == None
	•	now < expiry_ts
	•	cancelled == false
→ show “Buy Option” button, calling buy_option

4) Buyer Actions
If current wallet is buyer:
	•	After expiry:
	•	Show “Exercise” button
	•	Exercise shows success / failure depending on oracle price

5) Seller Actions
If current wallet is seller:
	•	After expiry + unsold → show “Reclaim Collateral”
	•	After expiry + sold but OTM → show “Reclaim Collateral”

⸻

11. Repo, Docs, and Submission Readiness

11.1 GitHub Repo Structure (Public)
	•	/program/ – Anchor program crate
	•	/app/ – React frontend
	•	/scripts/ – Setup scripts (mint test tokens, initialize oracle, etc.)

11.2 README Requirements

README must include (to satisfy hackathon):
	•	Table of Contents
	•	Project overview (≤250 words)
	•	Setup instructions:
	•	Prereqs (Rust, Anchor, Node, Solana CLI)
	•	How to run a local validator (optional)
	•	How to deploy to devnet
	•	How to run frontend locally
	•	Architecture overview:
	•	Diagram or bullet breakdown of:
	•	Program accounts
	•	PDAs
	•	Instruction flows
	•	Technical Summary:
	•	Problem being solved
	•	Why Solana (low fees, composability, UX)
	•	Which Solana tools used (Anchor, web3.js, wallet adapter)
	•	Deployed program address (devnet)
	•	Example test users / scripts (e.g., how to mint xStock + USDC for testing)

⸻

12. Judging Criteria Tie-In

Explicitly addressed:
	•	Technical rigor:
	•	Real on-chain program, PDAs, SPL token vaults, correct Solana patterns
	•	Real impact:
	•	Clear, understandable yield primitive for tokenized stocks
	•	Strong UX:
	•	Simple “Create / Buy / Exercise / Reclaim” flows
	•	Focused execution:
	•	Single-asset, covered call only, but fully polished
	•	Clear presentation:
	•	3-minute demo & README explaining problem + solution + flow
	•	Adoption thinking:
	•	Clear path to:
	•	More xStocks
	•	Real price oracles
	•	Circle / USDC + maybe integration with real RWA/xStock issuers

⸻

13. Build Order (for Cursor / task planning)
	1.	Anchor project + boilerplate program
	2.	Define accounts + PDAs (CoveredCall, Vault, PriceOracle)
	3.	Implement create_covered_call (xStock vault working)
	4.	Implement buy_option (USDC premium payment)
	5.	Implement update_price + exercise + reclaim
	6.	Deploy to devnet, record program ID
	7.	Frontend:
	•	Wallet connect
	•	Create → List → Buy → Exercise/Reclaim
	8.	Write README with ToC + architecture summary
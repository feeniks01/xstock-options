use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("9VRMEYvEiKPeGz9N8wVQjvT5qpqcHqNqd31kSYZhop2s");

#[program]
pub mod xstock_options {
    use super::*;

    pub fn create_covered_call(
        ctx: Context<CreateCoveredCall>,
        strike: u64,
        premium: u64,
        expiry_ts: i64,
    ) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        covered_call.seller = ctx.accounts.seller.key();
        covered_call.xstock_mint = ctx.accounts.xstock_mint.key();
        covered_call.quote_mint = ctx.accounts.quote_mint.key();
        covered_call.strike = strike;
        covered_call.premium = premium;
        covered_call.expiry_ts = expiry_ts;
        covered_call.exercised = false;
        covered_call.cancelled = false;
        covered_call.buyer = None;
        covered_call.buyer_exercised = false;
        // Auto-list on creation so options are immediately available in marketplace
        covered_call.is_listed = true;
        covered_call.ask_price = premium;

        // Transfer 1 xStock to vault
        // Assuming xStock has 0 decimals or we transfer 1 * 10^decimals. 
        // Instructions say "exactly 1 xStock". If decimals=0, amount=1. If decimals=6, amount=1_000_000.
        // For MVP, let's assume amount=1 (atomic unit) or pass amount?
        // Instructions say "Transfer exactly 1 xStock". I'll assume 1 atomic unit for now, 
        // or better, 1 full token (10^decimals). 
        // Let's stick to 1 atomic unit as per "1 xStock token" usually implies 1 unit if NFT-like, 
        // or 10^decimals if fungible. 
        // I'll use 1 atomic unit for simplicity unless specified. 
        // Actually, for "xStock", it's likely fungible. I'll transfer 1 * 10^decimals?
        // Let's just transfer 1 atomic unit for the MVP to keep it simple, 
        // assuming the test mint has 0 decimals or user knows what they are doing.
        // Transfer 1 xStock to vault (1 token = 1 share with 6 decimals)

        // Transfer xStock to Vault (100 shares per contract)
        let cpi_accounts = Transfer {
            from: ctx.accounts.seller_xstock_account.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, 100_000_000)?; // 100 xStock (6 decimals)

        Ok(())
    }

    pub fn buy_option(ctx: Context<BuyOption>) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        require!(covered_call.is_listed, ErrorCode::OptionNotListed);
        require!(!covered_call.exercised, ErrorCode::OptionAlreadyExercised);
        require!(!covered_call.cancelled, ErrorCode::OptionCancelled);
        
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < covered_call.expiry_ts, ErrorCode::OptionExpired);

        // Transfer Premium (USDC) from Buyer to Seller
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_quote_account.to_account_info(),
            to: ctx.accounts.seller_quote_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, covered_call.ask_price)?;

        // Update Option State
        covered_call.buyer = Some(ctx.accounts.buyer.key());
        covered_call.is_listed = false; // Delist after purchase

        Ok(())
    }

    pub fn exercise(ctx: Context<Exercise>) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        require!(covered_call.buyer == Some(ctx.accounts.buyer.key()), ErrorCode::Unauthorized);
        require!(!covered_call.exercised, ErrorCode::OptionAlreadyExercised);
        
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < covered_call.expiry_ts, ErrorCode::OptionExpired);

        // REMOVED: On-chain price check. 
        // We now trust the frontend/user to only exercise when profitable.
        // This saves gas and removes the need for an oracle.

        // Transfer Strike Price (USDC) from Buyer to Seller
        let cpi_accounts_payment = Transfer {
            from: ctx.accounts.buyer_quote_account.to_account_info(),
            to: ctx.accounts.seller_quote_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts_payment);
        token::transfer(cpi_ctx, covered_call.strike)?;

        // Transfer xStock from Vault to Buyer
        let seeds = &[
            b"vault",
            covered_call.to_account_info().key.as_ref(),
            &[ctx.bumps.vault_account],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts_transfer = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.buyer_xstock_account.to_account_info(),
            authority: ctx.accounts.vault_account.to_account_info(),
        };
        let cpi_program_transfer = ctx.accounts.token_program.to_account_info();
        let cpi_ctx_transfer = CpiContext::new_with_signer(cpi_program_transfer, cpi_accounts_transfer, signer);
        token::transfer(cpi_ctx_transfer, 100_000_000)?; // 100 xStock

        covered_call.exercised = true;
        covered_call.buyer_exercised = true;

        Ok(())
    }

    pub fn reclaim(ctx: Context<Reclaim>) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        require!(covered_call.seller == ctx.accounts.seller.key(), ErrorCode::Unauthorized);
        require!(!covered_call.exercised, ErrorCode::OptionAlreadyExercised);

        let clock = Clock::get()?;
        // Seller can reclaim if expired OR if they own it (no buyer) and want to cancel
        let is_expired = clock.unix_timestamp >= covered_call.expiry_ts;
        let is_unsold = covered_call.buyer.is_none();

        require!(is_expired || is_unsold, ErrorCode::OptionNotExpired);

        // Transfer xStock from Vault back to Seller
        let seeds = &[
            b"vault",
            covered_call.to_account_info().key.as_ref(),
            &[ctx.bumps.vault_account],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.seller_xstock_account.to_account_info(),
            authority: ctx.accounts.vault_account.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, 100_000_000)?; // 100 xStock

        covered_call.exercised = true; // Mark as "exercised" (closed)
        covered_call.cancelled = true;

        Ok(())
    }

    pub fn list_for_sale(ctx: Context<ListForSale>, price: u64) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        require!(covered_call.buyer == Some(ctx.accounts.seller.key()) || covered_call.seller == ctx.accounts.seller.key(), ErrorCode::Unauthorized);
        require!(!covered_call.exercised, ErrorCode::OptionAlreadyExercised);
        
        covered_call.is_listed = true;
        covered_call.ask_price = price;
        
        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let covered_call = &mut ctx.accounts.covered_call;
        require!(covered_call.buyer == Some(ctx.accounts.seller.key()) || covered_call.seller == ctx.accounts.seller.key(), ErrorCode::Unauthorized);
        
        covered_call.is_listed = false;
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(strike: u64, premium: u64, expiry_ts: i64)]
pub struct CreateCoveredCall<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub xstock_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init, 
        payer = seller, 
        space = 8 + 32 + 33 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8, // Updated size: 173 bytes
        seeds = [b"covered_call", seller.key().as_ref(), xstock_mint.key().as_ref(), &expiry_ts.to_le_bytes()],
        bump
    )]
    pub covered_call: Account<'info, CoveredCall>,
    #[account(mut)]
    pub seller_xstock_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = seller,
        seeds = [b"vault", covered_call.key().as_ref()],
        bump,
        token::mint = xstock_mint,
        token::authority = vault_account
    )]
    pub vault_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyOption<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub covered_call: Account<'info, CoveredCall>,
    #[account(mut)]
    pub buyer_quote_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub seller_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Exercise<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub covered_call: Account<'info, CoveredCall>,
    #[account(
        mut,
        seeds = [b"vault", covered_call.key().as_ref()],
        bump,
    )]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = buyer_xstock_account.mint == xstock_mint.key(),
        constraint = buyer_xstock_account.owner == buyer.key()
    )]
    pub buyer_xstock_account: Account<'info, TokenAccount>,
    pub xstock_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = buyer_quote_account.mint == covered_call.quote_mint,
        constraint = buyer_quote_account.owner == buyer.key()
    )]
    pub buyer_quote_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = seller_quote_account.mint == covered_call.quote_mint,
        constraint = seller_quote_account.owner == covered_call.seller
    )]
    pub seller_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Reclaim<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        has_one = xstock_mint,
        constraint = covered_call.seller == seller.key(),
        constraint = !covered_call.exercised,
    )]
    pub covered_call: Account<'info, CoveredCall>,
    #[account(
        mut,
        seeds = [b"vault", covered_call.key().as_ref()],
        bump,
    )]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = seller_xstock_account.mint == xstock_mint.key(),
        constraint = seller_xstock_account.owner == seller.key()
    )]
    pub seller_xstock_account: Account<'info, TokenAccount>,
    pub xstock_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ListForSale<'info> {
    #[account(mut)]
    pub seller: Signer<'info>, // The current buyer becoming the seller
    #[account(mut)]
    pub covered_call: Account<'info, CoveredCall>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub covered_call: Account<'info, CoveredCall>,
}

#[account]
pub struct CoveredCall {
    pub seller: Pubkey,
    pub buyer: Option<Pubkey>,
    pub xstock_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub strike: u64,
    pub premium: u64,
    pub expiry_ts: i64,
    pub exercised: bool,
    pub buyer_exercised: bool,
    pub cancelled: bool,
    pub is_listed: bool,
    pub ask_price: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Option already sold")]
    AlreadySold,
    #[msg("Option cancelled")]
    OptionCancelled,
    #[msg("Option expired")]
    OptionExpired,
    #[msg("Option not expired yet")]
    OptionNotExpired,
    #[msg("Caller is not the buyer")]
    Unauthorized,
    #[msg("Option already exercised or reclaimed")]
    OptionAlreadyExercised,
    #[msg("Option is not listed for sale")]
    OptionNotListed,
    #[msg("Insufficient funds")]
    InsufficientFunds,
}

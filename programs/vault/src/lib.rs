use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};

declare_id!("8gJHdrseXDiqUuBUBtMuNgn6G6GoLZ8oLiPHwru7NuPY");

#[program]
pub mod vault {
    use super::*;

    /// Initialize a new vault for a specific xStock asset
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        asset_id: String,
        utilization_cap_bps: u16,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.asset_id = asset_id;
        vault.underlying_mint = ctx.accounts.underlying_mint.key();
        vault.share_mint = ctx.accounts.share_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.total_assets = 0;
        vault.total_shares = 0;
        vault.epoch = 0;
        vault.utilization_cap_bps = utilization_cap_bps;
        vault.last_roll_timestamp = 0;
        vault.pending_withdrawals = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Deposit underlying tokens and receive vault shares
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault = &mut ctx.accounts.vault;

        // Calculate shares to mint (1:1 if first deposit, otherwise pro-rata)
        let shares_to_mint = if vault.total_shares == 0 {
            amount
        } else {
            // shares = amount * total_shares / total_assets
            (amount as u128)
                .checked_mul(vault.total_shares as u128)
                .unwrap()
                .checked_div(vault.total_assets as u128)
                .unwrap() as u64
        };

        require!(shares_to_mint > 0, VaultError::ZeroShares);

        // Transfer underlying tokens from user to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Mint vault shares to user
        let asset_id = vault.asset_id.as_bytes();
        let seeds = &[
            b"vault",
            asset_id,
            &[vault.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.user_share_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            shares_to_mint,
        )?;

        // Update vault state
        vault.total_assets = vault.total_assets.checked_add(amount).unwrap();
        vault.total_shares = vault.total_shares.checked_add(shares_to_mint).unwrap();

        emit!(DepositEvent {
            vault: vault.key(),
            user: ctx.accounts.user.key(),
            amount,
            shares_minted: shares_to_mint,
            epoch: vault.epoch,
        });

        Ok(())
    }

    /// Request withdrawal (queued until epoch end)
    pub fn request_withdrawal(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);

        let withdrawal = &mut ctx.accounts.withdrawal_request;
        let vault = &mut ctx.accounts.vault;

        // Check user has enough shares
        require!(
            ctx.accounts.user_share_account.amount >= shares,
            VaultError::InsufficientShares
        );

        // Create or update withdrawal request
        withdrawal.user = ctx.accounts.user.key();
        withdrawal.vault = vault.key();
        withdrawal.shares = shares;
        withdrawal.request_epoch = vault.epoch;
        withdrawal.processed = false;
        withdrawal.bump = ctx.bumps.withdrawal_request;

        // Track pending withdrawals in vault
        vault.pending_withdrawals = vault.pending_withdrawals.checked_add(shares).unwrap();

        emit!(WithdrawalRequestedEvent {
            vault: vault.key(),
            user: ctx.accounts.user.key(),
            shares,
            request_epoch: vault.epoch,
        });

        Ok(())
    }

    /// Process withdrawal after epoch settles
    pub fn process_withdrawal(ctx: Context<ProcessWithdrawal>) -> Result<()> {
        let withdrawal = &mut ctx.accounts.withdrawal_request;
        let vault = &mut ctx.accounts.vault;

        require!(!withdrawal.processed, VaultError::AlreadyProcessed);
        require!(
            vault.epoch > withdrawal.request_epoch,
            VaultError::EpochNotSettled
        );

        let shares = withdrawal.shares;

        // Calculate underlying amount to return
        let amount = (shares as u128)
            .checked_mul(vault.total_assets as u128)
            .unwrap()
            .checked_div(vault.total_shares as u128)
            .unwrap() as u64;

        // Burn user's shares
        let asset_id = vault.asset_id.as_bytes();
        let seeds = &[
            b"vault",
            asset_id,
            &[vault.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    from: ctx.accounts.user_share_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            shares,
        )?;

        // Transfer underlying tokens back to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Update vault state
        vault.total_assets = vault.total_assets.checked_sub(amount).unwrap();
        vault.total_shares = vault.total_shares.checked_sub(shares).unwrap();
        vault.pending_withdrawals = vault.pending_withdrawals.checked_sub(shares).unwrap();

        // Mark withdrawal as processed
        withdrawal.processed = true;

        emit!(WithdrawalProcessedEvent {
            vault: vault.key(),
            user: ctx.accounts.user.key(),
            shares,
            amount,
            epoch: vault.epoch,
        });

        Ok(())
    }

    /// Advance epoch (called by keeper after settlement)
    pub fn advance_epoch(ctx: Context<AdvanceEpoch>, premium_earned: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        // Add premium to total assets (increases share value)
        vault.total_assets = vault.total_assets.checked_add(premium_earned).unwrap();
        vault.epoch = vault.epoch.checked_add(1).unwrap();
        vault.last_roll_timestamp = clock.unix_timestamp;

        emit!(EpochAdvancedEvent {
            vault: vault.key(),
            new_epoch: vault.epoch,
            premium_earned,
            total_assets: vault.total_assets,
            total_shares: vault.total_shares,
        });

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub asset_id: String,
    pub underlying_mint: Pubkey,
    pub share_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_assets: u64,
    pub total_shares: u64,
    pub epoch: u64,
    pub utilization_cap_bps: u16,
    pub last_roll_timestamp: i64,
    pub pending_withdrawals: u64,
    pub bump: u8,
}

#[account]
pub struct WithdrawalRequest {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub shares: u64,
    pub request_epoch: u64,
    pub processed: bool,
    pub bump: u8,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 64 + 32 + 32 + 32 + 8 + 8 + 8 + 2 + 8 + 8 + 1,
        seeds = [b"vault", asset_id.as_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    pub underlying_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        mint::decimals = underlying_mint.decimals,
        mint::authority = vault,
        seeds = [b"shares", vault.key().as_ref()],
        bump
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = underlying_mint,
        token::authority = vault,
        seeds = [b"vault_tokens", vault.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.asset_id.as_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        address = vault.share_mint
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault.vault_token_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vault.underlying_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vault.share_mint
    )]
    pub user_share_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RequestWithdrawal<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.asset_id.as_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 1,
        seeds = [b"withdrawal", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub withdrawal_request: Account<'info, WithdrawalRequest>,

    #[account(
        token::mint = vault.share_mint,
        token::authority = user
    )]
    pub user_share_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessWithdrawal<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.asset_id.as_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"withdrawal", vault.key().as_ref(), user.key().as_ref()],
        bump = withdrawal_request.bump,
        has_one = user,
        has_one = vault
    )]
    pub withdrawal_request: Account<'info, WithdrawalRequest>,

    #[account(
        mut,
        address = vault.share_mint
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        address = vault.vault_token_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vault.underlying_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vault.share_mint
    )]
    pub user_share_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdvanceEpoch<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.asset_id.as_bytes()],
        bump = vault.bump,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,

    pub authority: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct DepositEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub shares_minted: u64,
    pub epoch: u64,
}

#[event]
pub struct WithdrawalRequestedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub shares: u64,
    pub request_epoch: u64,
}

#[event]
pub struct WithdrawalProcessedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub shares: u64,
    pub amount: u64,
    pub epoch: u64,
}

#[event]
pub struct EpochAdvancedEvent {
    pub vault: Pubkey,
    pub new_epoch: u64,
    pub premium_earned: u64,
    pub total_assets: u64,
    pub total_shares: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Calculated shares must be greater than zero")]
    ZeroShares,
    #[msg("Insufficient shares")]
    InsufficientShares,
    #[msg("Withdrawal already processed")]
    AlreadyProcessed,
    #[msg("Epoch has not settled yet")]
    EpochNotSettled,
}

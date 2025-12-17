use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("3M2K6htNbWyZHtvvUyUME19f5GUS6x8AtGmitFENDT5Z");

#[program]
pub mod rfq {
    use super::*;

    /// Initialize the RFQ program config (admin only)
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.rfq_count = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Add a maker to the allowlist
    pub fn add_maker(ctx: Context<AddMaker>, maker: Pubkey) -> Result<()> {
        let maker_account = &mut ctx.accounts.maker_account;
        maker_account.maker = maker;
        maker_account.is_active = true;
        maker_account.total_fills = 0;
        maker_account.total_premium_paid = 0;
        maker_account.bump = ctx.bumps.maker_account;

        emit!(MakerAddedEvent { maker });
        Ok(())
    }

    /// Create an RFQ (called by vault/keeper)
    pub fn create_rfq(
        ctx: Context<CreateRfq>,
        underlying: Pubkey,
        option_type: OptionType,
        expiry_ts: i64,
        strike: u64,
        size: u64,
        premium_floor: u64,
        valid_until_ts: i64,
        settlement: SettlementType,
        oracle_price: u64,
        oracle_ts: i64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let rfq = &mut ctx.accounts.rfq;
        let clock = Clock::get()?;

        require!(valid_until_ts > clock.unix_timestamp, RfqError::InvalidExpiry);
        require!(expiry_ts > clock.unix_timestamp, RfqError::InvalidExpiry);

        rfq.id = config.rfq_count;
        rfq.creator = ctx.accounts.creator.key();
        rfq.underlying = underlying;
        rfq.option_type = option_type;
        rfq.expiry_ts = expiry_ts;
        rfq.strike = strike;
        rfq.size = size;
        rfq.premium_floor = premium_floor;
        rfq.valid_until_ts = valid_until_ts;
        rfq.settlement = settlement;
        rfq.oracle_price = oracle_price;
        rfq.oracle_ts = oracle_ts;
        rfq.status = RfqStatus::Open;
        rfq.filled_by = Pubkey::default();
        rfq.filled_premium = 0;
        rfq.created_at = clock.unix_timestamp;
        rfq.bump = ctx.bumps.rfq;

        config.rfq_count = config.rfq_count.checked_add(1).unwrap();

        emit!(RfqCreatedEvent {
            rfq_id: rfq.id,
            underlying,
            strike,
            size,
            premium_floor,
            valid_until_ts,
        });

        Ok(())
    }

    /// Fill an RFQ (called by maker)
    pub fn fill_rfq(ctx: Context<FillRfq>, premium: u64) -> Result<()> {
        let rfq = &mut ctx.accounts.rfq;
        let maker_account = &mut ctx.accounts.maker_account;
        let clock = Clock::get()?;

        // Validate RFQ is open and not expired
        require!(rfq.status == RfqStatus::Open, RfqError::RfqNotOpen);
        require!(clock.unix_timestamp < rfq.valid_until_ts, RfqError::RfqExpired);
        
        // Validate maker is active
        require!(maker_account.is_active, RfqError::MakerNotActive);
        
        // Validate premium meets floor
        require!(premium >= rfq.premium_floor, RfqError::PremiumBelowFloor);

        // Transfer premium from maker to RFQ creator (vault)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.maker_token_account.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: ctx.accounts.maker.to_account_info(),
                },
            ),
            premium,
        )?;

        // Update RFQ state
        rfq.status = RfqStatus::Filled;
        rfq.filled_by = ctx.accounts.maker.key();
        rfq.filled_premium = premium;

        // Update maker stats
        maker_account.total_fills = maker_account.total_fills.checked_add(1).unwrap();
        maker_account.total_premium_paid = maker_account
            .total_premium_paid
            .checked_add(premium)
            .unwrap();

        emit!(RfqFilledEvent {
            rfq_id: rfq.id,
            maker: ctx.accounts.maker.key(),
            premium,
        });

        Ok(())
    }

    /// Cancel an RFQ (creator or authority only)
    pub fn cancel_rfq(ctx: Context<CancelRfq>) -> Result<()> {
        let rfq = &mut ctx.accounts.rfq;

        require!(rfq.status == RfqStatus::Open, RfqError::RfqNotOpen);

        rfq.status = RfqStatus::Cancelled;

        emit!(RfqCancelledEvent { rfq_id: rfq.id });

        Ok(())
    }

    /// Expire an RFQ (anyone can call if past valid_until_ts)
    pub fn expire_rfq(ctx: Context<ExpireRfq>) -> Result<()> {
        let rfq = &mut ctx.accounts.rfq;
        let clock = Clock::get()?;

        require!(rfq.status == RfqStatus::Open, RfqError::RfqNotOpen);
        require!(clock.unix_timestamp >= rfq.valid_until_ts, RfqError::RfqNotExpired);

        rfq.status = RfqStatus::Expired;

        emit!(RfqExpiredEvent { rfq_id: rfq.id });

        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub rfq_count: u64,
    pub bump: u8,
}

#[account]
pub struct MakerAccount {
    pub maker: Pubkey,
    pub is_active: bool,
    pub total_fills: u64,
    pub total_premium_paid: u64,
    pub bump: u8,
}

#[account]
pub struct Rfq {
    pub id: u64,
    pub creator: Pubkey,
    pub underlying: Pubkey,
    pub option_type: OptionType,
    pub expiry_ts: i64,
    pub strike: u64,
    pub size: u64,
    pub premium_floor: u64,
    pub valid_until_ts: i64,
    pub settlement: SettlementType,
    pub oracle_price: u64,
    pub oracle_ts: i64,
    pub status: RfqStatus,
    pub filled_by: Pubkey,
    pub filled_premium: u64,
    pub created_at: i64,
    pub bump: u8,
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OptionType {
    Call,
    Put,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum SettlementType {
    Cash,
    Physical,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RfqStatus {
    Open,
    Filled,
    Cancelled,
    Expired,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(maker: Pubkey)]
pub struct AddMaker<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1 + 8 + 8 + 1,
        seeds = [b"maker", maker.as_ref()],
        bump
    )]
    pub maker_account: Account<'info, MakerAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateRfq<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = creator,
        space = 8 + 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 32 + 8 + 8 + 1,
        seeds = [b"rfq", config.rfq_count.to_le_bytes().as_ref()],
        bump
    )]
    pub rfq: Account<'info, Rfq>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FillRfq<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"rfq", rfq.id.to_le_bytes().as_ref()],
        bump = rfq.bump
    )]
    pub rfq: Account<'info, Rfq>,

    #[account(
        mut,
        seeds = [b"maker", maker.key().as_ref()],
        bump = maker_account.bump
    )]
    pub maker_account: Account<'info, MakerAccount>,

    /// The token account to receive premium (vault's account)
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// The maker's token account to pay premium from
    #[account(mut)]
    pub maker_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub maker: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelRfq<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"rfq", rfq.id.to_le_bytes().as_ref()],
        bump = rfq.bump,
        constraint = rfq.creator == authority.key() || config.authority == authority.key()
    )]
    pub rfq: Account<'info, Rfq>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExpireRfq<'info> {
    #[account(
        mut,
        seeds = [b"rfq", rfq.id.to_le_bytes().as_ref()],
        bump = rfq.bump
    )]
    pub rfq: Account<'info, Rfq>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct MakerAddedEvent {
    pub maker: Pubkey,
}

#[event]
pub struct RfqCreatedEvent {
    pub rfq_id: u64,
    pub underlying: Pubkey,
    pub strike: u64,
    pub size: u64,
    pub premium_floor: u64,
    pub valid_until_ts: i64,
}

#[event]
pub struct RfqFilledEvent {
    pub rfq_id: u64,
    pub maker: Pubkey,
    pub premium: u64,
}

#[event]
pub struct RfqCancelledEvent {
    pub rfq_id: u64,
}

#[event]
pub struct RfqExpiredEvent {
    pub rfq_id: u64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum RfqError {
    #[msg("Invalid expiry timestamp")]
    InvalidExpiry,
    #[msg("RFQ is not open")]
    RfqNotOpen,
    #[msg("RFQ has expired")]
    RfqExpired,
    #[msg("Maker is not active")]
    MakerNotActive,
    #[msg("Premium is below floor")]
    PremiumBelowFloor,
    #[msg("RFQ has not expired yet")]
    RfqNotExpired,
}

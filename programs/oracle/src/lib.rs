use anchor_lang::prelude::*;

declare_id!("5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk");

// Maximum age of price update in seconds (5 minutes)
pub const MAX_PRICE_AGE_SECS: i64 = 300;

/// Pyth price structure (matching on-chain format)
/// Reference: https://docs.pyth.network/price-feeds/pythnet-price-feeds/on-chain-data
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PythPrice {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: i64,
}

/// Parse Pyth price from account data
/// Pyth account layout: https://github.com/pyth-network/pyth-sdk-solana
fn parse_pyth_price(data: &[u8]) -> Option<PythPrice> {
    // Minimum size check (simplified parsing)
    if data.len() < 96 {
        return None;
    }

    // The Pyth price account has a specific layout
    // Offset 208: price (i64)
    // Offset 216: conf (u64)  
    // Offset 224: expo (i32)
    // Offset 232: publish_time (i64)
    // 
    // This is for the legacy Pyth format. For simplicity, we'll accept Pyth
    // price account info as an input and trust the Hermes-posted data.
    //
    // In production, you'd validate the account owner is the Pyth program.

    // For now, just extract basic price info from known offsets
    // Note: This may need adjustment based on actual Pyth account layout
    let price = i64::from_le_bytes(data[208..216].try_into().ok()?);
    let conf = u64::from_le_bytes(data[216..224].try_into().ok()?);
    let expo = i32::from_le_bytes(data[224..228].try_into().ok()?);
    let publish_time = i64::from_le_bytes(data[232..240].try_into().ok()?);

    Some(PythPrice {
        price,
        conf,
        expo,
        publish_time,
    })
}

#[program]
pub mod oracle {
    use super::*;

    /// Initialize an asset config that maps asset_id to a Pyth price account
    pub fn initialize_asset(
        ctx: Context<InitializeAsset>,
        asset_id: String,
        pyth_price_account: Pubkey,
    ) -> Result<()> {
        let asset_config = &mut ctx.accounts.asset_config;
        asset_config.authority = ctx.accounts.authority.key();
        asset_config.asset_id = asset_id;
        asset_config.pyth_price_account = pyth_price_account;
        asset_config.bump = ctx.bumps.asset_config;
        Ok(())
    }

    /// Get price from Pyth - reads the Pyth price account and validates freshness
    pub fn get_price(ctx: Context<GetPrice>) -> Result<PriceResult> {
        let asset_config = &ctx.accounts.asset_config;
        let pyth_price_info = &ctx.accounts.pyth_price_account;
        let clock = Clock::get()?;

        // Verify the Pyth account matches what's configured
        require_keys_eq!(
            pyth_price_info.key(),
            asset_config.pyth_price_account,
            OracleError::InvalidPriceAccount
        );

        // Parse the Pyth price data
        let pyth_data = pyth_price_info.try_borrow_data()?;
        let price = parse_pyth_price(&pyth_data)
            .ok_or(OracleError::InvalidPriceData)?;

        // Check staleness
        let age = clock.unix_timestamp.saturating_sub(price.publish_time);
        require!(age <= MAX_PRICE_AGE_SECS, OracleError::StalePrice);

        let result = PriceResult {
            price: price.price,
            conf: price.conf,
            exponent: price.expo,
            publish_time: price.publish_time,
        };

        emit!(PriceRead {
            asset_id: asset_config.asset_id.clone(),
            price: result.price,
            conf: result.conf,
            exponent: result.exponent,
            publish_time: result.publish_time,
        });

        Ok(result)
    }

    /// Update the Pyth price account for an asset (admin only)
    pub fn update_pyth_account(
        ctx: Context<UpdatePythAccount>,
        new_pyth_price_account: Pubkey,
    ) -> Result<()> {
        let asset_config = &mut ctx.accounts.asset_config;
        asset_config.pyth_price_account = new_pyth_price_account;
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct AssetConfig {
    pub authority: Pubkey,
    pub asset_id: String,
    pub pyth_price_account: Pubkey,
    pub bump: u8,
}

impl AssetConfig {
    pub const MAX_ASSET_ID_LEN: usize = 16;
    pub const LEN: usize = 8 + 32 + 4 + Self::MAX_ASSET_ID_LEN + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct PriceResult {
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
}

// ============================================================================
// Contexts
// ============================================================================

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct InitializeAsset<'info> {
    #[account(
        init,
        payer = authority,
        space = AssetConfig::LEN,
        seeds = [b"asset", asset_id.as_bytes()],
        bump
    )]
    pub asset_config: Account<'info, AssetConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    pub asset_config: Account<'info, AssetConfig>,

    /// CHECK: This is a Pyth price account - we validate the pubkey matches config
    pub pyth_price_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdatePythAccount<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub asset_config: Account<'info, AssetConfig>,

    pub authority: Signer<'info>,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct PriceRead {
    pub asset_id: String,
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum OracleError {
    #[msg("Invalid Pyth price account")]
    InvalidPriceAccount,
    #[msg("Invalid Pyth price data format")]
    InvalidPriceData,
    #[msg("Price is stale")]
    StalePrice,
}

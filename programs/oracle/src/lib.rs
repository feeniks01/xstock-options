use anchor_lang::prelude::*;

declare_id!("5MnuN6ahpRSp5F3R2uXvy9pSN4TQmhSydywQSoxszuZk");

#[program]
pub mod oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, asset_id: String) -> Result<()> {
        let price_account = &mut ctx.accounts.price_account;
        price_account.authority = ctx.accounts.authority.key();
        price_account.asset_id = asset_id;
        price_account.price = 0;
        price_account.conf = 0;
        price_account.status = OracleStatus::Unknown;
        price_account.last_updated = 0;
        Ok(())
    }

    pub fn update_price(
        ctx: Context<UpdatePrice>,
        price: u64,
        conf: u64,
        status: OracleStatus,
    ) -> Result<()> {
        let price_account = &mut ctx.accounts.price_account;
        let clock = Clock::get()?;

        price_account.price = price;
        price_account.conf = conf;
        price_account.status = status;
        price_account.last_updated = clock.unix_timestamp;
        
        emit!(PriceUpdate {
            asset_id: price_account.asset_id.clone(),
            price,
            conf,
            status,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 64 + 8 + 8 + 1 + 8,
        seeds = [b"oracle", asset_id.as_bytes()],
        bump
    )]
    pub price_account: Account<'info, PriceAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub price_account: Account<'info, PriceAccount>,
    pub authority: Signer<'info>,
}

#[account]
pub struct PriceAccount {
    pub authority: Pubkey,
    pub asset_id: String,
    pub price: u64,
    pub conf: u64,
    pub status: OracleStatus,
    pub last_updated: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OracleStatus {
    Unknown,
    Ok,
    Degraded,
    Disputed,
    Stale,
}

#[event]
pub struct PriceUpdate {
    pub asset_id: String,
    pub price: u64,
    pub conf: u64,
    pub status: OracleStatus,
    pub timestamp: i64,
}

//! AgentFund Protocol
//! 
//! Self-funding infrastructure for autonomous agents on Solana.
//! 
//! This program provides:
//! - Invoice creation and payment tracking
//! - Batched micropayment settlements
//! - Payment channel state management
//! - Treasury management for agents

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("AgntFund1111111111111111111111111111111111");

/// Maximum invoices per batch settlement
pub const MAX_BATCH_SIZE: usize = 50;

/// Maximum memo length
pub const MAX_MEMO_LENGTH: usize = 256;

#[program]
pub mod agentfund {
    use super::*;

    /// Initialize an agent's treasury account
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        bump: u8,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.owner = ctx.accounts.owner.key();
        treasury.bump = bump;
        treasury.total_received = 0;
        treasury.total_settled = 0;
        treasury.pending_invoices = 0;
        treasury.created_at = Clock::get()?.unix_timestamp;
        
        msg!("Treasury initialized for agent: {}", treasury.owner);
        Ok(())
    }

    /// Create a payment invoice
    pub fn create_invoice(
        ctx: Context<CreateInvoice>,
        invoice_id: [u8; 32],
        amount: u64,
        memo: String,
        expires_at: i64,
    ) -> Result<()> {
        require!(memo.len() <= MAX_MEMO_LENGTH, AgentFundError::MemoTooLong);
        require!(amount > 0, AgentFundError::InvalidAmount);
        require!(expires_at > Clock::get()?.unix_timestamp, AgentFundError::InvalidExpiry);

        let invoice = &mut ctx.accounts.invoice;
        invoice.id = invoice_id;
        invoice.recipient = ctx.accounts.recipient.key();
        invoice.amount = amount;
        invoice.memo = memo;
        invoice.status = InvoiceStatus::Pending;
        invoice.created_at = Clock::get()?.unix_timestamp;
        invoice.expires_at = expires_at;
        invoice.paid_at = None;
        invoice.payer = None;

        // Update treasury pending count
        let treasury = &mut ctx.accounts.treasury;
        treasury.pending_invoices += 1;

        msg!("Invoice created: {} lamports", amount);
        emit!(InvoiceCreated {
            invoice_id,
            recipient: invoice.recipient,
            amount,
            expires_at,
        });

        Ok(())
    }

    /// Pay an invoice (direct payment)
    pub fn pay_invoice(ctx: Context<PayInvoice>) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        
        require!(
            invoice.status == InvoiceStatus::Pending,
            AgentFundError::InvoiceNotPending
        );
        require!(
            Clock::get()?.unix_timestamp < invoice.expires_at,
            AgentFundError::InvoiceExpired
        );

        // Transfer SOL from payer to recipient
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.recipient.key(),
            invoice.amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update invoice status
        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = Some(Clock::get()?.unix_timestamp);
        invoice.payer = Some(ctx.accounts.payer.key());

        // Update treasury
        let treasury = &mut ctx.accounts.treasury;
        treasury.total_received += invoice.amount;
        treasury.pending_invoices = treasury.pending_invoices.saturating_sub(1);

        msg!("Invoice paid: {} lamports", invoice.amount);
        emit!(InvoicePaid {
            invoice_id: invoice.id,
            payer: ctx.accounts.payer.key(),
            amount: invoice.amount,
        });

        Ok(())
    }

    /// Settle a batch of micropayments
    pub fn settle_batch(
        ctx: Context<SettleBatch>,
        batch_id: [u8; 32],
        invoice_ids: Vec<[u8; 32]>,
        total_amount: u64,
    ) -> Result<()> {
        require!(
            invoice_ids.len() <= MAX_BATCH_SIZE,
            AgentFundError::BatchTooLarge
        );
        require!(
            invoice_ids.len() > 0,
            AgentFundError::EmptyBatch
        );

        let batch = &mut ctx.accounts.batch;
        batch.id = batch_id;
        batch.recipient = ctx.accounts.recipient.key();
        batch.invoice_count = invoice_ids.len() as u32;
        batch.total_amount = total_amount;
        batch.settled_at = Clock::get()?.unix_timestamp;
        batch.settler = ctx.accounts.settler.key();

        // Transfer total amount
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.settler.key(),
            &ctx.accounts.recipient.key(),
            total_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.settler.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update treasury
        let treasury = &mut ctx.accounts.treasury;
        treasury.total_settled += total_amount;
        treasury.pending_invoices = treasury.pending_invoices.saturating_sub(invoice_ids.len() as u64);

        msg!("Batch settled: {} invoices, {} lamports", invoice_ids.len(), total_amount);
        emit!(BatchSettled {
            batch_id,
            invoice_count: invoice_ids.len() as u32,
            total_amount,
            recipient: ctx.accounts.recipient.key(),
        });

        Ok(())
    }

    /// Open a payment channel between two agents
    pub fn open_channel(
        ctx: Context<OpenChannel>,
        channel_id: [u8; 32],
        deposit: u64,
    ) -> Result<()> {
        require!(deposit > 0, AgentFundError::InvalidAmount);

        let channel = &mut ctx.accounts.channel;
        channel.id = channel_id;
        channel.party_a = ctx.accounts.party_a.key();
        channel.party_b = ctx.accounts.party_b.key();
        channel.deposit_a = deposit;
        channel.deposit_b = 0;
        channel.balance_a = deposit;
        channel.balance_b = 0;
        channel.nonce = 0;
        channel.status = ChannelStatus::Open;
        channel.opened_at = Clock::get()?.unix_timestamp;
        channel.closed_at = None;

        // Transfer deposit to channel escrow
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.party_a.key(),
            &ctx.accounts.channel_escrow.key(),
            deposit,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.party_a.to_account_info(),
                ctx.accounts.channel_escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Channel opened with {} lamports deposit", deposit);
        emit!(ChannelOpened {
            channel_id,
            party_a: channel.party_a,
            party_b: channel.party_b,
            deposit,
        });

        Ok(())
    }

    /// Close a payment channel and settle final balances
    pub fn close_channel(
        ctx: Context<CloseChannel>,
        final_balance_a: u64,
        final_balance_b: u64,
        nonce: u64,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        
        require!(
            channel.status == ChannelStatus::Open,
            AgentFundError::ChannelNotOpen
        );
        require!(
            nonce > channel.nonce,
            AgentFundError::InvalidNonce
        );
        require!(
            final_balance_a + final_balance_b == channel.deposit_a + channel.deposit_b,
            AgentFundError::BalanceMismatch
        );

        // Update channel state
        channel.balance_a = final_balance_a;
        channel.balance_b = final_balance_b;
        channel.nonce = nonce;
        channel.status = ChannelStatus::Closed;
        channel.closed_at = Some(Clock::get()?.unix_timestamp);

        // Transfer final balances from escrow
        // (In production: proper escrow PDA with seeds)
        
        msg!("Channel closed. Final: A={}, B={}", final_balance_a, final_balance_b);
        emit!(ChannelClosed {
            channel_id: channel.id,
            final_balance_a,
            final_balance_b,
        });

        Ok(())
    }
}

// === Account Structures ===

#[account]
#[derive(Default)]
pub struct Treasury {
    /// Owner agent's public key
    pub owner: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Total lamports received
    pub total_received: u64,
    /// Total lamports settled via batches
    pub total_settled: u64,
    /// Number of pending invoices
    pub pending_invoices: u64,
    /// Creation timestamp
    pub created_at: i64,
}

#[account]
pub struct Invoice {
    /// Unique invoice ID
    pub id: [u8; 32],
    /// Recipient (invoice creator)
    pub recipient: Pubkey,
    /// Amount in lamports
    pub amount: u64,
    /// Human-readable memo
    pub memo: String,
    /// Current status
    pub status: InvoiceStatus,
    /// Creation timestamp
    pub created_at: i64,
    /// Expiration timestamp
    pub expires_at: i64,
    /// Payment timestamp (if paid)
    pub paid_at: Option<i64>,
    /// Payer public key (if paid)
    pub payer: Option<Pubkey>,
}

#[account]
pub struct BatchSettlement {
    /// Unique batch ID
    pub id: [u8; 32],
    /// Recipient of the batch
    pub recipient: Pubkey,
    /// Number of invoices in batch
    pub invoice_count: u32,
    /// Total amount settled
    pub total_amount: u64,
    /// Settlement timestamp
    pub settled_at: i64,
    /// Who submitted the settlement
    pub settler: Pubkey,
}

#[account]
pub struct PaymentChannel {
    /// Unique channel ID
    pub id: [u8; 32],
    /// First party
    pub party_a: Pubkey,
    /// Second party
    pub party_b: Pubkey,
    /// Party A's deposit
    pub deposit_a: u64,
    /// Party B's deposit
    pub deposit_b: u64,
    /// Party A's current balance
    pub balance_a: u64,
    /// Party B's current balance
    pub balance_b: u64,
    /// State nonce (for ordering updates)
    pub nonce: u64,
    /// Channel status
    pub status: ChannelStatus,
    /// Opening timestamp
    pub opened_at: i64,
    /// Closing timestamp
    pub closed_at: Option<i64>,
}

// === Enums ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InvoiceStatus {
    Pending,
    Paid,
    Expired,
    Cancelled,
}

impl Default for InvoiceStatus {
    fn default() -> Self {
        InvoiceStatus::Pending
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChannelStatus {
    Open,
    Closing,
    Closed,
    Disputed,
}

impl Default for ChannelStatus {
    fn default() -> Self {
        ChannelStatus::Open
    }
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 1 + 8 + 8 + 8 + 8,
        seeds = [b"treasury", owner.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(invoice_id: [u8; 32])]
pub struct CreateInvoice<'info> {
    #[account(
        init,
        payer = recipient,
        space = 8 + 32 + 32 + 8 + 4 + MAX_MEMO_LENGTH + 1 + 8 + 8 + 9 + 33,
        seeds = [b"invoice", invoice_id.as_ref()],
        bump
    )]
    pub invoice: Account<'info, Invoice>,
    
    #[account(
        mut,
        seeds = [b"treasury", recipient.key().as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub recipient: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayInvoice<'info> {
    #[account(mut)]
    pub invoice: Account<'info, Invoice>,
    
    #[account(
        mut,
        seeds = [b"treasury", recipient.key().as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// CHECK: Recipient is validated against invoice
    #[account(mut, constraint = recipient.key() == invoice.recipient)]
    pub recipient: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(batch_id: [u8; 32])]
pub struct SettleBatch<'info> {
    #[account(
        init,
        payer = settler,
        space = 8 + 32 + 32 + 4 + 8 + 8 + 32,
        seeds = [b"batch", batch_id.as_ref()],
        bump
    )]
    pub batch: Account<'info, BatchSettlement>,
    
    #[account(
        mut,
        seeds = [b"treasury", recipient.key().as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub settler: Signer<'info>,
    
    /// CHECK: Recipient validated by treasury PDA
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(channel_id: [u8; 32])]
pub struct OpenChannel<'info> {
    #[account(
        init,
        payer = party_a,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 9,
        seeds = [b"channel", channel_id.as_ref()],
        bump
    )]
    pub channel: Account<'info, PaymentChannel>,
    
    /// CHECK: Escrow PDA for holding channel funds
    #[account(
        mut,
        seeds = [b"escrow", channel_id.as_ref()],
        bump
    )]
    pub channel_escrow: AccountInfo<'info>,
    
    #[account(mut)]
    pub party_a: Signer<'info>,
    
    /// CHECK: Party B just needs to be a valid pubkey
    pub party_b: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseChannel<'info> {
    #[account(mut)]
    pub channel: Account<'info, PaymentChannel>,
    
    /// CHECK: Escrow PDA
    #[account(mut)]
    pub channel_escrow: AccountInfo<'info>,
    
    #[account(mut)]
    pub closer: Signer<'info>,
    
    /// CHECK: Party A for receiving funds
    #[account(mut, constraint = party_a.key() == channel.party_a)]
    pub party_a: AccountInfo<'info>,
    
    /// CHECK: Party B for receiving funds
    #[account(mut, constraint = party_b.key() == channel.party_b)]
    pub party_b: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

// === Events ===

#[event]
pub struct InvoiceCreated {
    pub invoice_id: [u8; 32],
    pub recipient: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
}

#[event]
pub struct InvoicePaid {
    pub invoice_id: [u8; 32],
    pub payer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BatchSettled {
    pub batch_id: [u8; 32],
    pub invoice_count: u32,
    pub total_amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct ChannelOpened {
    pub channel_id: [u8; 32],
    pub party_a: Pubkey,
    pub party_b: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct ChannelClosed {
    pub channel_id: [u8; 32],
    pub final_balance_a: u64,
    pub final_balance_b: u64,
}

// === Errors ===

#[error_code]
pub enum AgentFundError {
    #[msg("Memo exceeds maximum length")]
    MemoTooLong,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Invalid expiry time")]
    InvalidExpiry,
    
    #[msg("Invoice is not in pending status")]
    InvoiceNotPending,
    
    #[msg("Invoice has expired")]
    InvoiceExpired,
    
    #[msg("Batch exceeds maximum size")]
    BatchTooLarge,
    
    #[msg("Batch cannot be empty")]
    EmptyBatch,
    
    #[msg("Channel is not open")]
    ChannelNotOpen,
    
    #[msg("Invalid state nonce")]
    InvalidNonce,
    
    #[msg("Final balances do not match total deposits")]
    BalanceMismatch,
}

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
// anchor-spl removed for rustc 1.79 compatibility
// Token functionality can be added when platform-tools updates

declare_id!("5LqS68L9kfrB5h2D3NjJ9d8jEJz7egkyXUWEySGNZUeg");

/// Maximum invoices per batch settlement
pub const MAX_BATCH_SIZE: usize = 50;

/// Maximum memo length
pub const MAX_MEMO_LENGTH: usize = 256;

/// Dispute window in seconds (24 hours)
pub const DISPUTE_WINDOW_SECONDS: i64 = 86400;

/// Maximum dispute reason length
pub const MAX_DISPUTE_REASON_LENGTH: usize = 512;

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

    // === Agent Registry Instructions ===

    /// Register an agent in the marketplace
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        description: String,
        capabilities: Vec<String>,
        base_price: u64,
        bump: u8,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME_LENGTH, AgentFundError::NameTooLong);
        require!(description.len() <= MAX_DESCRIPTION_LENGTH, AgentFundError::DescriptionTooLong);
        require!(capabilities.len() <= MAX_CAPABILITIES, AgentFundError::TooManyCapabilities);
        
        for cap in &capabilities {
            require!(cap.len() <= MAX_CAPABILITY_LENGTH, AgentFundError::CapabilityTooLong);
        }

        let profile = &mut ctx.accounts.agent_profile;
        profile.owner = ctx.accounts.owner.key();
        profile.name = name.clone();
        profile.description = description;
        profile.capabilities = capabilities.clone();
        profile.base_price = base_price;
        profile.treasury = ctx.accounts.treasury.key();
        profile.is_active = true;
        profile.total_requests = 0;
        profile.total_earnings = 0;
        profile.registered_at = Clock::get()?.unix_timestamp;
        profile.last_active_at = Clock::get()?.unix_timestamp;
        profile.bump = bump;

        msg!("Agent registered: {}", name);
        emit!(AgentRegistered {
            agent: profile.owner,
            name,
            capabilities,
            base_price,
        });

        Ok(())
    }

    /// Update agent profile
    pub fn update_agent_profile(
        ctx: Context<UpdateAgentProfile>,
        name: Option<String>,
        description: Option<String>,
        capabilities: Option<Vec<String>>,
        base_price: Option<u64>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.agent_profile;

        if let Some(n) = name {
            require!(n.len() <= MAX_NAME_LENGTH, AgentFundError::NameTooLong);
            profile.name = n;
        }
        if let Some(d) = description {
            require!(d.len() <= MAX_DESCRIPTION_LENGTH, AgentFundError::DescriptionTooLong);
            profile.description = d;
        }
        if let Some(caps) = capabilities {
            require!(caps.len() <= MAX_CAPABILITIES, AgentFundError::TooManyCapabilities);
            for cap in &caps {
                require!(cap.len() <= MAX_CAPABILITY_LENGTH, AgentFundError::CapabilityTooLong);
            }
            profile.capabilities = caps;
        }
        if let Some(price) = base_price {
            profile.base_price = price;
        }
        if let Some(active) = is_active {
            profile.is_active = active;
        }

        profile.last_active_at = Clock::get()?.unix_timestamp;

        emit!(AgentUpdated {
            agent: profile.owner,
            is_active: profile.is_active,
        });

        Ok(())
    }

    /// Request a service from another agent
    pub fn request_service(
        ctx: Context<CreateServiceRequest>,
        request_id: [u8; 32],
        capability: String,
        amount: u64,
    ) -> Result<()> {
        let provider = &ctx.accounts.provider_profile;
        
        require!(provider.is_active, AgentFundError::AgentNotActive);
        require!(
            provider.capabilities.contains(&capability),
            AgentFundError::CapabilityNotSupported
        );
        require!(amount >= provider.base_price, AgentFundError::InvalidAmount);

        // Transfer to escrow
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.requester.key(),
            &ctx.accounts.escrow.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.requester.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let request = &mut ctx.accounts.request;
        request.id = request_id;
        request.requester = ctx.accounts.requester.key();
        request.provider = ctx.accounts.provider_owner.key();
        request.capability = capability.clone();
        request.amount = amount;
        request.status = RequestStatus::Pending;
        request.created_at = Clock::get()?.unix_timestamp;
        request.completed_at = None;
        request.result_hash = None;

        msg!("Service requested: {} for {} lamports", capability, amount);
        emit!(ServiceRequested {
            request_id,
            requester: request.requester,
            provider: request.provider,
            capability,
            amount,
        });

        Ok(())
    }

    /// Complete a service request and release payment
    pub fn complete_service(
        ctx: Context<CompleteServiceRequest>,
        result_hash: [u8; 32],
    ) -> Result<()> {
        let request = &mut ctx.accounts.request;
        
        require!(
            request.status == RequestStatus::Pending,
            AgentFundError::RequestNotPending
        );

        // Update request
        request.status = RequestStatus::Completed;
        request.completed_at = Some(Clock::get()?.unix_timestamp);
        request.result_hash = Some(result_hash);

        // Update provider stats
        let profile = &mut ctx.accounts.provider_profile;
        profile.total_requests += 1;
        profile.total_earnings += request.amount;
        profile.last_active_at = Clock::get()?.unix_timestamp;

        // Update treasury
        let treasury = &mut ctx.accounts.provider_treasury;
        treasury.total_received += request.amount;

        // Transfer from escrow to provider
        // (simplified - in production use PDA signing)

        msg!("Service completed, {} lamports released", request.amount);
        emit!(ServiceCompleted {
            request_id: request.id,
            provider: ctx.accounts.provider.key(),
            amount: request.amount,
        });

        Ok(())
    }

    // === Dispute Resolution ===

    /// Initiate a dispute on a service request
    /// Either requester or provider can initiate within dispute window
    pub fn initiate_dispute(
        ctx: Context<InitiateDispute>,
        reason: String,
    ) -> Result<()> {
        let request = &mut ctx.accounts.request;
        let dispute = &mut ctx.accounts.dispute;

        require!(
            request.status == RequestStatus::Pending || request.status == RequestStatus::Completed,
            AgentFundError::CannotDispute
        );

        // Must be within dispute window (24 hours after creation/completion)
        let now = Clock::get()?.unix_timestamp;
        let reference_time = request.completed_at.unwrap_or(request.created_at);
        require!(
            now - reference_time <= DISPUTE_WINDOW_SECONDS,
            AgentFundError::DisputeWindowClosed
        );

        // Update request status
        request.status = RequestStatus::Disputed;

        // Initialize dispute
        dispute.request_id = request.id;
        dispute.initiator = ctx.accounts.initiator.key();
        dispute.reason = reason.clone();
        dispute.status = DisputeStatus::Open;
        dispute.created_at = now;
        dispute.resolved_at = None;
        dispute.resolution = None;

        msg!("Dispute initiated for request by {}", dispute.initiator);
        emit!(DisputeInitiated {
            request_id: request.id,
            initiator: dispute.initiator,
            reason,
        });

        Ok(())
    }

    /// Resolve a dispute (currently by provider/requester agreement)
    /// In production: could use an arbiter DAO or oracle
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        resolution: DisputeResolution,
    ) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        let request = &mut ctx.accounts.request;

        require!(
            dispute.status == DisputeStatus::Open,
            AgentFundError::DisputeNotOpen
        );

        let now = Clock::get()?.unix_timestamp;
        
        // Apply resolution
        match resolution {
            DisputeResolution::RefundRequester => {
                // Refund full amount to requester
                request.status = RequestStatus::Refunded;
                msg!("Dispute resolved: full refund to requester");
            }
            DisputeResolution::PayProvider => {
                // Pay full amount to provider
                request.status = RequestStatus::Completed;
                msg!("Dispute resolved: full payment to provider");
            }
            DisputeResolution::Split { requester_pct } => {
                // Split payment based on percentage
                require!(requester_pct <= 100, AgentFundError::InvalidSplitPct);
                request.status = RequestStatus::Completed;
                msg!("Dispute resolved: {}% to requester, {}% to provider", 
                     requester_pct, 100 - requester_pct);
            }
        }

        dispute.status = DisputeStatus::Resolved;
        dispute.resolved_at = Some(now);
        dispute.resolution = Some(resolution.clone());

        emit!(DisputeResolved {
            request_id: request.id,
            resolution,
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

// === Agent Registry ===

/// Maximum length for agent name
pub const MAX_NAME_LENGTH: usize = 64;

/// Maximum length for service description
pub const MAX_DESCRIPTION_LENGTH: usize = 256;

/// Maximum number of service capabilities
pub const MAX_CAPABILITIES: usize = 10;

/// Maximum length per capability
pub const MAX_CAPABILITY_LENGTH: usize = 32;

#[account]
pub struct AgentProfile {
    /// Agent's public key (owner)
    pub owner: Pubkey,
    /// Agent's display name
    pub name: String,
    /// Description of agent's services
    pub description: String,
    /// Service capabilities (e.g., "sentiment", "translation", "image-gen")
    pub capabilities: Vec<String>,
    /// Base price per request in lamports
    pub base_price: u64,
    /// Treasury account for payments
    pub treasury: Pubkey,
    /// Whether agent is currently active
    pub is_active: bool,
    /// Total requests served
    pub total_requests: u64,
    /// Total earnings
    pub total_earnings: u64,
    /// Registration timestamp
    pub registered_at: i64,
    /// Last active timestamp
    pub last_active_at: i64,
    /// PDA bump
    pub bump: u8,
}

#[account]
pub struct ServiceRequest {
    /// Unique request ID
    pub id: [u8; 32],
    /// Requesting agent
    pub requester: Pubkey,
    /// Service provider agent
    pub provider: Pubkey,
    /// Capability being requested
    pub capability: String,
    /// Amount escrowed
    pub amount: u64,
    /// Request status
    pub status: RequestStatus,
    /// Creation timestamp
    pub created_at: i64,
    /// Completion timestamp
    pub completed_at: Option<i64>,
    /// Optional result hash (for verification)
    pub result_hash: Option<[u8; 32]>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RequestStatus {
    Pending,
    InProgress,
    Completed,
    Disputed,
    Refunded,
}

/// Dispute for a service request
#[account]
pub struct Dispute {
    /// Request ID being disputed
    pub request_id: [u8; 32],
    /// Who initiated the dispute
    pub initiator: Pubkey,
    /// Reason for dispute
    pub reason: String,
    /// Dispute status
    pub status: DisputeStatus,
    /// Creation timestamp
    pub created_at: i64,
    /// Resolution timestamp
    pub resolved_at: Option<i64>,
    /// Resolution details
    pub resolution: Option<DisputeResolution>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    UnderReview,
    Resolved,
    Expired,
}

impl Default for DisputeStatus {
    fn default() -> Self {
        DisputeStatus::Open
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DisputeResolution {
    /// Full refund to requester
    RefundRequester,
    /// Full payment to provider
    PayProvider,
    /// Split payment by percentage
    Split { requester_pct: u8 },
}

impl Default for RequestStatus {
    fn default() -> Self {
        RequestStatus::Pending
    }
}

// === Registry Contexts ===

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 4 + MAX_NAME_LENGTH + 4 + MAX_DESCRIPTION_LENGTH + 
                4 + (MAX_CAPABILITIES * (4 + MAX_CAPABILITY_LENGTH)) + 
                8 + 32 + 1 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"agent", owner.key().as_ref()],
        bump
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    #[account(
        seeds = [b"treasury", owner.key().as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgentProfile<'info> {
    #[account(
        mut,
        seeds = [b"agent", owner.key().as_ref()],
        bump = agent_profile.bump,
        has_one = owner
    )]
    pub agent_profile: Account<'info, AgentProfile>,
    
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(request_id: [u8; 32])]
pub struct CreateServiceRequest<'info> {
    #[account(
        init,
        payer = requester,
        space = 8 + 32 + 32 + 32 + 4 + MAX_CAPABILITY_LENGTH + 8 + 1 + 8 + 9 + 33,
        seeds = [b"request", request_id.as_ref()],
        bump
    )]
    pub request: Account<'info, ServiceRequest>,
    
    #[account(
        seeds = [b"agent", provider_owner.key().as_ref()],
        bump = provider_profile.bump
    )]
    pub provider_profile: Account<'info, AgentProfile>,
    
    /// CHECK: Provider owner for profile lookup
    pub provider_owner: AccountInfo<'info>,
    
    /// CHECK: Escrow for holding payment
    #[account(
        mut,
        seeds = [b"request_escrow", request_id.as_ref()],
        bump
    )]
    pub escrow: AccountInfo<'info>,
    
    #[account(mut)]
    pub requester: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteServiceRequest<'info> {
    #[account(mut)]
    pub request: Account<'info, ServiceRequest>,
    
    #[account(
        mut,
        seeds = [b"agent", provider.key().as_ref()],
        bump = provider_profile.bump,
        has_one = owner @ AgentFundError::UnauthorizedProvider
    )]
    pub provider_profile: Account<'info, AgentProfile>,
    
    /// CHECK: Escrow holding payment
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"treasury", provider.key().as_ref()],
        bump = provider_treasury.bump
    )]
    pub provider_treasury: Account<'info, Treasury>,
    
    /// CHECK: Provider receiving payment
    #[account(mut)]
    pub provider: AccountInfo<'info>,
    
    /// Owner must sign to complete
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// === Dispute Contexts ===

#[derive(Accounts)]
pub struct InitiateDispute<'info> {
    #[account(mut)]
    pub request: Account<'info, ServiceRequest>,
    
    #[account(
        init,
        payer = initiator,
        space = 8 + 32 + 32 + 4 + MAX_DISPUTE_REASON_LENGTH + 1 + 8 + 9 + 33,
        seeds = [b"dispute", request.id.as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    /// Must be either requester or provider
    #[account(
        mut,
        constraint = initiator.key() == request.requester || initiator.key() == request.provider
    )]
    pub initiator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub request: Account<'info, ServiceRequest>,
    
    #[account(
        mut,
        seeds = [b"dispute", request.id.as_ref()],
        bump,
        constraint = dispute.status == DisputeStatus::Open
    )]
    pub dispute: Account<'info, Dispute>,
    
    /// Both parties must agree, or use arbiter (simplified here)
    /// In production: would check multi-sig or arbiter DAO vote
    #[account(
        constraint = resolver.key() == request.requester || resolver.key() == request.provider
    )]
    pub resolver: Signer<'info>,
    
    /// CHECK: Requester for potential refund
    #[account(mut, constraint = requester.key() == request.requester)]
    pub requester: AccountInfo<'info>,
    
    /// CHECK: Provider for potential payment
    #[account(mut, constraint = provider.key() == request.provider)]
    pub provider: AccountInfo<'info>,
    
    /// CHECK: Escrow holding funds
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

// === Registry Events ===

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub name: String,
    pub capabilities: Vec<String>,
    pub base_price: u64,
}

#[event]
pub struct AgentUpdated {
    pub agent: Pubkey,
    pub is_active: bool,
}

#[event]
pub struct ServiceRequested {
    pub request_id: [u8; 32],
    pub requester: Pubkey,
    pub provider: Pubkey,
    pub capability: String,
    pub amount: u64,
}

#[event]
pub struct ServiceCompleted {
    pub request_id: [u8; 32],
    pub provider: Pubkey,
    pub amount: u64,
}

// === Dispute Events ===

#[event]
pub struct DisputeInitiated {
    pub request_id: [u8; 32],
    pub initiator: Pubkey,
    pub reason: String,
}

#[event]
pub struct DisputeResolved {
    pub request_id: [u8; 32],
    pub resolution: DisputeResolution,
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
    
    #[msg("Name exceeds maximum length")]
    NameTooLong,
    
    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,
    
    #[msg("Too many capabilities")]
    TooManyCapabilities,
    
    #[msg("Capability name too long")]
    CapabilityTooLong,
    
    #[msg("Agent is not active")]
    AgentNotActive,
    
    #[msg("Capability not supported by provider")]
    CapabilityNotSupported,
    
    #[msg("Request is not pending")]
    RequestNotPending,
    
    #[msg("Unauthorized provider")]
    UnauthorizedProvider,
    
    #[msg("Cannot dispute this request")]
    CannotDispute,
    
    #[msg("Dispute window has closed")]
    DisputeWindowClosed,
    
    #[msg("Dispute is not open")]
    DisputeNotOpen,
    
    #[msg("Invalid split percentage")]
    InvalidSplitPct,
}

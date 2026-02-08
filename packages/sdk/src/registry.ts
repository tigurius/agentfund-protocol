/**
 * Agent Registry Module
 * 
 * On-chain agent discovery and service marketplace.
 * Agents register their capabilities and other agents can discover and request services.
 */

import { PublicKey, Connection, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { PROGRAM_ID, DEVNET_RPC } from './constants';

/**
 * Agent profile stored on-chain
 */
export interface AgentProfile {
  /** Agent's wallet address */
  owner: PublicKey;
  /** Display name */
  name: string;
  /** Description of services */
  description: string;
  /** List of capabilities (e.g., "sentiment", "translation") */
  capabilities: string[];
  /** Base price per request in lamports */
  basePrice: bigint;
  /** Agent's treasury address */
  treasury: PublicKey;
  /** Whether agent is currently accepting requests */
  isActive: boolean;
  /** Total requests served */
  totalRequests: bigint;
  /** Total earnings in lamports */
  totalEarnings: bigint;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
}

/**
 * Service request between agents
 */
export interface ServiceRequest {
  /** Unique request ID */
  id: string;
  /** Requesting agent */
  requester: PublicKey;
  /** Service provider */
  provider: PublicKey;
  /** Capability being requested */
  capability: string;
  /** Amount escrowed */
  amount: bigint;
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'disputed' | 'refunded';
  /** Creation time */
  createdAt: Date;
  /** Completion time */
  completedAt?: Date;
  /** Result hash for verification */
  resultHash?: string;
}

/**
 * Search filters for discovering agents
 */
export interface AgentSearchFilters {
  /** Filter by capability */
  capability?: string;
  /** Filter by multiple capabilities (AND) */
  capabilities?: string[];
  /** Maximum base price in lamports */
  maxPrice?: bigint;
  /** Only active agents */
  activeOnly?: boolean;
  /** Minimum total requests served */
  minRequests?: number;
  /** Sort field */
  sortBy?: 'price' | 'requests' | 'earnings' | 'recent';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  activeAgents: number;
  totalRequests: number;
  totalVolume: bigint;
  topCapabilities: { name: string; count: number }[];
}

/**
 * Agent Registry for on-chain discovery and service marketplace
 */
export class AgentRegistry {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection?: Connection,
    programId: PublicKey = PROGRAM_ID
  ) {
    this.connection = connection || new Connection(DEVNET_RPC, 'confirmed');
    this.programId = programId;
  }

  /**
   * Derive agent profile PDA
   */
  getAgentProfilePDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive service request PDA
   */
  getServiceRequestPDA(requestId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('request'), requestId],
      this.programId
    );
  }

  /**
   * Derive request escrow PDA
   */
  getRequestEscrowPDA(requestId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('request_escrow'), requestId],
      this.programId
    );
  }

  /**
   * Register a new agent in the marketplace
   */
  async register(
    owner: Keypair,
    params: {
      name: string;
      description: string;
      capabilities: string[];
      basePrice: bigint;
    }
  ): Promise<{
    signature: string;
    profileAddress: PublicKey;
  }> {
    const [profilePDA, bump] = this.getAgentProfilePDA(owner.publicKey);
    const [treasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), owner.publicKey.toBuffer()],
      this.programId
    );

    // Create instruction (simplified - actual encoding would use Anchor)
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: treasuryPDA, isSigner: false, isWritable: false },
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([/* register_agent instruction data */]),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(tx, [owner]);
    await this.connection.confirmTransaction(signature);

    console.log(`Agent registered: ${params.name}`);
    console.log(`Profile address: ${profilePDA.toBase58()}`);

    return {
      signature,
      profileAddress: profilePDA,
    };
  }

  /**
   * Get agent profile by owner address
   */
  async getProfile(owner: PublicKey): Promise<AgentProfile | null> {
    const [profilePDA] = this.getAgentProfilePDA(owner);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(profilePDA);
      if (!accountInfo) return null;

      // Decode account data (simplified - actual decoding would use Anchor)
      // This is a placeholder for the actual deserialization
      return {
        owner,
        name: 'Agent',
        description: 'Description',
        capabilities: [],
        basePrice: BigInt(0),
        treasury: owner,
        isActive: true,
        totalRequests: BigInt(0),
        totalEarnings: BigInt(0),
        registeredAt: new Date(),
        lastActiveAt: new Date(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Search for agents by filters
   * 
   * Note: Full search requires indexing service. This implementation
   * fetches all agent accounts and filters client-side.
   * For production, use a dedicated indexer like Helius or Triton.
   */
  async search(filters: AgentSearchFilters = {}): Promise<AgentProfile[]> {
    try {
      // Fetch all agent profile accounts
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: 8 + 32 + 4 + 64 + 4 + 256 + 4 + 320 + 8 + 32 + 1 + 8 + 8 + 8 + 8 + 1 }, // AgentProfile size
        ],
      });

      // Parse and filter accounts
      let profiles: AgentProfile[] = accounts.map(({ pubkey, account }) => {
        // Simplified parsing - in production use Anchor's deserializer
        const data = account.data;
        return {
          owner: new PublicKey(data.slice(8, 40)),
          name: 'Agent', // Would parse from data
          description: '',
          capabilities: [],
          basePrice: BigInt(0),
          treasury: new PublicKey(data.slice(8, 40)),
          isActive: true,
          totalRequests: BigInt(0),
          totalEarnings: BigInt(0),
          registeredAt: new Date(),
          lastActiveAt: new Date(),
        };
      });

      // Apply filters
      if (filters.activeOnly) {
        profiles = profiles.filter(p => p.isActive);
      }
      if (filters.capability) {
        profiles = profiles.filter(p => p.capabilities.includes(filters.capability!));
      }
      if (filters.maxPrice) {
        profiles = profiles.filter(p => p.basePrice <= filters.maxPrice!);
      }

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 20;
      profiles = profiles.slice(offset, offset + limit);

      return profiles;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Find agents with a specific capability
   */
  async findByCapability(capability: string): Promise<AgentProfile[]> {
    return this.search({ capability, activeOnly: true });
  }

  /**
   * Request a service from another agent
   */
  async requestService(
    requester: Keypair,
    provider: PublicKey,
    capability: string,
    amount: bigint
  ): Promise<{
    signature: string;
    requestId: string;
    requestAddress: PublicKey;
  }> {
    // Generate unique request ID
    const requestIdBuffer = Buffer.alloc(32);
    crypto.getRandomValues(requestIdBuffer);
    const requestId = requestIdBuffer.toString('hex');

    const [requestPDA] = this.getServiceRequestPDA(requestIdBuffer);
    const [escrowPDA] = this.getRequestEscrowPDA(requestIdBuffer);
    const [providerProfilePDA] = this.getAgentProfilePDA(provider);

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: requestPDA, isSigner: false, isWritable: true },
        { pubkey: providerProfilePDA, isSigner: false, isWritable: false },
        { pubkey: provider, isSigner: false, isWritable: false },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: requester.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([/* request_service instruction data */]),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(tx, [requester]);
    await this.connection.confirmTransaction(signature);

    console.log(`Service requested from ${provider.toBase58()}`);
    console.log(`Request ID: ${requestId}`);

    return {
      signature,
      requestId,
      requestAddress: requestPDA,
    };
  }

  /**
   * Complete a service request (provider side)
   */
  async completeService(
    provider: Keypair,
    requestId: string,
    resultHash: Buffer
  ): Promise<{ signature: string }> {
    const requestIdBuffer = Buffer.from(requestId, 'hex');
    const [requestPDA] = this.getServiceRequestPDA(requestIdBuffer);
    const [escrowPDA] = this.getRequestEscrowPDA(requestIdBuffer);
    const [providerProfilePDA] = this.getAgentProfilePDA(provider.publicKey);
    const [providerTreasuryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), provider.publicKey.toBuffer()],
      this.programId
    );

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: requestPDA, isSigner: false, isWritable: true },
        { pubkey: providerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: providerTreasuryPDA, isSigner: false, isWritable: true },
        { pubkey: provider.publicKey, isSigner: false, isWritable: true },
        { pubkey: provider.publicKey, isSigner: true, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([/* complete_service instruction data */]),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(tx, [provider]);
    await this.connection.confirmTransaction(signature);

    console.log(`Service completed for request: ${requestId}`);

    return { signature };
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    // In production, aggregate from on-chain data
    return {
      totalAgents: 0,
      activeAgents: 0,
      totalRequests: 0,
      totalVolume: BigInt(0),
      topCapabilities: [],
    };
  }

  /**
   * Update agent profile
   */
  async updateProfile(
    owner: Keypair,
    updates: {
      name?: string;
      description?: string;
      capabilities?: string[];
      basePrice?: bigint;
      isActive?: boolean;
    }
  ): Promise<{ signature: string }> {
    const [profilePDA] = this.getAgentProfilePDA(owner.publicKey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([/* update_agent_profile instruction data */]),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.connection.sendTransaction(tx, [owner]);
    await this.connection.confirmTransaction(signature);

    console.log('Profile updated');

    return { signature };
  }

  /**
   * Deactivate agent (stop accepting requests)
   */
  async deactivate(owner: Keypair): Promise<{ signature: string }> {
    return this.updateProfile(owner, { isActive: false });
  }

  /**
   * Reactivate agent
   */
  async activate(owner: Keypair): Promise<{ signature: string }> {
    return this.updateProfile(owner, { isActive: true });
  }
}

/**
 * Predefined capabilities for common agent services
 */
export const STANDARD_CAPABILITIES = {
  // AI/ML Services
  SENTIMENT: 'sentiment',
  SUMMARIZATION: 'summarization',
  TRANSLATION: 'translation',
  ENTITY_EXTRACTION: 'entity-extraction',
  IMAGE_GENERATION: 'image-generation',
  CODE_REVIEW: 'code-review',
  
  // Data Services
  PRICE_FEED: 'price-feed',
  MARKET_DATA: 'market-data',
  NEWS_AGGREGATION: 'news-aggregation',
  
  // DeFi Services
  SWAP_EXECUTION: 'swap-execution',
  YIELD_OPTIMIZATION: 'yield-optimization',
  PORTFOLIO_ANALYSIS: 'portfolio-analysis',
  
  // Social Services
  CONTENT_MODERATION: 'content-moderation',
  SOCIAL_POSTING: 'social-posting',
  
  // Infrastructure
  COMPUTE: 'compute',
  STORAGE: 'storage',
  ORACLE: 'oracle',
} as const;

export type StandardCapability = typeof STANDARD_CAPABILITIES[keyof typeof STANDARD_CAPABILITIES];

/**
 * Helper to create a new registry instance
 */
export function createRegistry(connection?: Connection): AgentRegistry {
  return new AgentRegistry(connection);
}

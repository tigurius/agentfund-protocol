import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import { AgentRegistry, STANDARD_CAPABILITIES } from '../src/registry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('PDA derivation', () => {
    it('should derive agent profile PDA', () => {
      const owner = Keypair.generate().publicKey;
      const [pda, bump] = registry.getAgentProfilePDA(owner);

      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it('should derive consistent PDAs for same owner', () => {
      const owner = Keypair.generate().publicKey;
      const [pda1] = registry.getAgentProfilePDA(owner);
      const [pda2] = registry.getAgentProfilePDA(owner);

      expect(pda1.equals(pda2)).toBe(true);
    });

    it('should derive different PDAs for different owners', () => {
      const owner1 = Keypair.generate().publicKey;
      const owner2 = Keypair.generate().publicKey;
      const [pda1] = registry.getAgentProfilePDA(owner1);
      const [pda2] = registry.getAgentProfilePDA(owner2);

      expect(pda1.equals(pda2)).toBe(false);
    });

    it('should derive service request PDA', () => {
      const requestId = Buffer.alloc(32);
      const [pda, bump] = registry.getServiceRequestPDA(requestId);

      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });

    it('should derive request escrow PDA', () => {
      const requestId = Buffer.alloc(32);
      const [pda, bump] = registry.getRequestEscrowPDA(requestId);

      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
    });
  });

  describe('STANDARD_CAPABILITIES', () => {
    it('should define AI/ML capabilities', () => {
      expect(STANDARD_CAPABILITIES.SENTIMENT).toBe('sentiment');
      expect(STANDARD_CAPABILITIES.SUMMARIZATION).toBe('summarization');
      expect(STANDARD_CAPABILITIES.TRANSLATION).toBe('translation');
      expect(STANDARD_CAPABILITIES.IMAGE_GENERATION).toBe('image-generation');
    });

    it('should define data capabilities', () => {
      expect(STANDARD_CAPABILITIES.PRICE_FEED).toBe('price-feed');
      expect(STANDARD_CAPABILITIES.MARKET_DATA).toBe('market-data');
      expect(STANDARD_CAPABILITIES.NEWS_AGGREGATION).toBe('news-aggregation');
    });

    it('should define DeFi capabilities', () => {
      expect(STANDARD_CAPABILITIES.SWAP_EXECUTION).toBe('swap-execution');
      expect(STANDARD_CAPABILITIES.YIELD_OPTIMIZATION).toBe('yield-optimization');
      expect(STANDARD_CAPABILITIES.PORTFOLIO_ANALYSIS).toBe('portfolio-analysis');
    });

    it('should define infrastructure capabilities', () => {
      expect(STANDARD_CAPABILITIES.COMPUTE).toBe('compute');
      expect(STANDARD_CAPABILITIES.STORAGE).toBe('storage');
      expect(STANDARD_CAPABILITIES.ORACLE).toBe('oracle');
    });
  });

  describe('search', () => {
    it('should accept search filters', async () => {
      const results = await registry.search({
        capability: 'sentiment',
        activeOnly: true,
        maxPrice: BigInt(100000),
        limit: 10,
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('findByCapability', () => {
    it('should search by capability', async () => {
      const results = await registry.findByCapability('sentiment');

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', async () => {
      const stats = await registry.getStats();

      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('activeAgents');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('totalVolume');
      expect(stats).toHaveProperty('topCapabilities');
    });
  });
});

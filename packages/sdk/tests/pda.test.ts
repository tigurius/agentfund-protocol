/**
 * PDA Tests
 */

import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  getTreasuryPDA,
  getInvoicePDA,
  getBatchPDA,
  getChannelPDA,
  generateId,
  stringToIdBuffer,
} from '../src/pda';

describe('PDA Derivation', () => {
  describe('getTreasuryPDA', () => {
    it('should derive consistent PDA for same owner', () => {
      const owner = Keypair.generate().publicKey;
      
      const [pda1, bump1] = getTreasuryPDA(owner);
      const [pda2, bump2] = getTreasuryPDA(owner);

      expect(pda1.equals(pda2)).toBe(true);
      expect(bump1).toBe(bump2);
    });

    it('should derive different PDAs for different owners', () => {
      const owner1 = Keypair.generate().publicKey;
      const owner2 = Keypair.generate().publicKey;

      const [pda1] = getTreasuryPDA(owner1);
      const [pda2] = getTreasuryPDA(owner2);

      expect(pda1.equals(pda2)).toBe(false);
    });

    it('should be off-curve (valid PDA)', () => {
      const owner = Keypair.generate().publicKey;
      const [pda] = getTreasuryPDA(owner);

      // PDAs should not be on the ed25519 curve
      expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
    });
  });

  describe('getInvoicePDA', () => {
    it('should derive consistent PDA for same invoice ID', () => {
      const invoiceId = generateId();

      const [pda1] = getInvoicePDA(invoiceId);
      const [pda2] = getInvoicePDA(invoiceId);

      expect(pda1.equals(pda2)).toBe(true);
    });

    it('should derive different PDAs for different invoice IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      const [pda1] = getInvoicePDA(id1);
      const [pda2] = getInvoicePDA(id2);

      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe('getChannelPDA', () => {
    it('should derive valid channel PDA', () => {
      const channelId = generateId();
      const [pda, bump] = getChannelPDA(channelId);

      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });
  });
});

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate 32-byte buffer', () => {
      const id = generateId();
      expect(id.length).toBe(32);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId().toString('hex'));
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('stringToIdBuffer', () => {
    it('should convert short string to 32-byte buffer', () => {
      const buffer = stringToIdBuffer('test');
      expect(buffer.length).toBe(32);
      expect(buffer.slice(0, 4).toString()).toBe('test');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(100);
      const buffer = stringToIdBuffer(longString);
      expect(buffer.length).toBe(32);
    });

    it('should produce consistent results', () => {
      const b1 = stringToIdBuffer('invoice-123');
      const b2 = stringToIdBuffer('invoice-123');
      expect(b1.equals(b2)).toBe(true);
    });
  });
});

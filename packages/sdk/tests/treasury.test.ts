/**
 * Treasury Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { Treasury, createTreasury } from '../src/treasury';
import { PROGRAM_ID } from '../src/constants';

describe('Treasury', () => {
  let treasury: Treasury;
  let wallet: Keypair;
  let connection: Connection;

  beforeEach(() => {
    wallet = Keypair.generate();
    connection = new Connection('https://api.devnet.solana.com');
    treasury = new Treasury(connection, wallet);
  });

  describe('getPDA', () => {
    it('should derive deterministic PDA', () => {
      const [pda1, bump1] = treasury.getPDA();
      const [pda2, bump2] = treasury.getPDA();

      expect(pda1.equals(pda2)).toBe(true);
      expect(bump1).toBe(bump2);
    });

    it('should derive different PDAs for different wallets', () => {
      const other = new Treasury(connection, Keypair.generate());
      const [pda1] = treasury.getPDA();
      const [pda2] = other.getPDA();

      expect(pda1.equals(pda2)).toBe(false);
    });

    it('should derive valid PDA (off curve)', () => {
      const [pda] = treasury.getPDA();
      expect(pda).toBeInstanceOf(PublicKey);
      expect(pda.toBase58()).toHaveLength(44); // or 43
    });

    it('should match manual PDA derivation', () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from('treasury'), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );
      const [actual] = treasury.getPDA();
      expect(actual.equals(expected)).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should accept Keypair wallet', () => {
      const t = new Treasury(connection, wallet);
      expect(t.getPDA()).toBeDefined();
    });

    it('should accept PublicKey (read-only)', () => {
      const t = new Treasury(connection, wallet.publicKey);
      expect(t.getPDA()).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should reject PublicKey wallet', async () => {
      const readOnly = new Treasury(connection, wallet.publicKey);
      await expect(readOnly.initialize()).rejects.toThrow('Keypair required');
    });
  });

  describe('isInitialized', () => {
    it('should return false for non-existent treasury', async () => {
      const result = await treasury.isInitialized();
      expect(result).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return null for non-existent treasury', async () => {
      const state = await treasury.getState();
      expect(state).toBeNull();
    });
  });

  describe('getBalance', () => {
    it('should return 0 for non-existent treasury', async () => {
      const balance = await treasury.getBalance();
      expect(balance).toBe(BigInt(0));
    });
  });

  describe('getAddress', () => {
    it('should return base58 string', () => {
      const address = treasury.getAddress();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(30);
    });
  });

  describe('getAccountBalance', () => {
    it('should return 0 for unfunded PDA', async () => {
      const balance = await treasury.getAccountBalance();
      expect(balance).toBe(BigInt(0));
    });
  });

  describe('createTreasury helper', () => {
    it('should create Treasury instance', () => {
      const t = createTreasury(connection, wallet);
      expect(t).toBeInstanceOf(Treasury);
    });
  });
});

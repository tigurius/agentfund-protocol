/**
 * Escrow Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import { EscrowManager } from '../src/escrow';

describe('EscrowManager', () => {
  let manager: EscrowManager;
  let depositor: Keypair;
  let beneficiary: Keypair;
  let arbiter: Keypair;

  beforeEach(() => {
    manager = new EscrowManager();
    depositor = Keypair.generate();
    beneficiary = Keypair.generate();
    arbiter = Keypair.generate();
  });

  describe('create', () => {
    it('should create escrow with correct params', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.5,
        description: 'Test escrow',
      });

      expect(escrow.id).toMatch(/^esc_/);
      expect(escrow.depositor.equals(depositor.publicKey)).toBe(true);
      expect(escrow.beneficiary.equals(beneficiary.publicKey)).toBe(true);
      expect(escrow.amount).toBe(1.5);
      expect(escrow.status).toBe('pending');
    });

    it('should create escrow with arbiter', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });

      expect(escrow.arbiter?.equals(arbiter.publicKey)).toBe(true);
    });

    it('should create escrow with expiry', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
        expiresIn: '24h',
      });

      expect(escrow.expiresAt).toBeDefined();
      expect(escrow.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('fund', () => {
    it('should fund a pending escrow', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
      });

      const funded = manager.fund(escrow.id);
      expect(funded.status).toBe('funded');
    });

    it('should reject funding non-pending escrow', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      expect(() => manager.fund(escrow.id)).toThrow('not pending');
    });
  });

  describe('release', () => {
    it('should allow depositor to release', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      const released = manager.release(escrow.id, depositor.publicKey);
      expect(released.status).toBe('released');
    });

    it('should allow arbiter to release', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      const released = manager.release(escrow.id, arbiter.publicKey);
      expect(released.status).toBe('released');
    });

    it('should reject unauthorized release', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      const random = Keypair.generate();
      expect(() => manager.release(escrow.id, random.publicKey)).toThrow('Unauthorized');
    });
  });

  describe('dispute', () => {
    it('should allow depositor to dispute', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      const disputed = manager.dispute(escrow.id, depositor.publicKey);
      expect(disputed.status).toBe('disputed');
    });

    it('should reject dispute without arbiter', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);

      expect(() => manager.dispute(escrow.id, depositor.publicKey)).toThrow('no arbiter');
    });
  });

  describe('resolveDispute', () => {
    it('should allow arbiter to resolve with release', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);
      manager.dispute(escrow.id, depositor.publicKey);

      const resolved = manager.resolveDispute(escrow.id, arbiter.publicKey, 'release');
      expect(resolved.status).toBe('released');
    });

    it('should allow arbiter to resolve with refund', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);
      manager.dispute(escrow.id, beneficiary.publicKey);

      const resolved = manager.resolveDispute(escrow.id, arbiter.publicKey, 'refund');
      expect(resolved.status).toBe('refunded');
    });

    it('should reject non-arbiter resolution', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        arbiter: arbiter.publicKey,
        amount: 1.0,
      });
      manager.fund(escrow.id);
      manager.dispute(escrow.id, depositor.publicKey);

      expect(() => 
        manager.resolveDispute(escrow.id, depositor.publicKey, 'release')
      ).toThrow('Only arbiter');
    });
  });

  describe('list', () => {
    it('should filter by status', () => {
      const e1 = manager.create({ depositor: depositor.publicKey, beneficiary: beneficiary.publicKey, amount: 1 });
      const e2 = manager.create({ depositor: depositor.publicKey, beneficiary: beneficiary.publicKey, amount: 2 });
      manager.fund(e2.id);

      const pending = manager.list({ status: 'pending' });
      const funded = manager.list({ status: 'funded' });

      expect(pending).toHaveLength(1);
      expect(funded).toHaveLength(1);
    });
  });

  describe('processExpired', () => {
    it('should expire old escrows', () => {
      const escrow = manager.create({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        amount: 1.0,
        expiresIn: '1m',
      });

      // Manually set expiry to past
      escrow.expiresAt = new Date(Date.now() - 1000);

      const expired = manager.processExpired();
      expect(expired).toHaveLength(1);
      expect(expired[0].status).toBe('expired');
    });
  });
});

/**
 * AgentFund SDK Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { AgentFund } from '../src/agentfund';
import { PaymentStatus } from '../src/types';

describe('AgentFund', () => {
  let agentfund: AgentFund;
  let wallet: Keypair;

  beforeEach(() => {
    wallet = Keypair.generate();
    agentfund = new AgentFund({
      rpcUrl: 'https://api.devnet.solana.com',
      wallet,
    });
  });

  describe('createInvoice', () => {
    it('should create an invoice with valid parameters', async () => {
      const invoice = await agentfund.createInvoice({
        amount: 0.001,
        memo: 'Test payment',
        expiresIn: '1h',
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.id).toMatch(/^inv_/);
      expect(invoice.amount).toBe(0.001);
      expect(invoice.memo).toBe('Test payment');
      expect(invoice.status).toBe(PaymentStatus.PENDING);
      expect(invoice.recipient.equals(wallet.publicKey)).toBe(true);
    });

    it('should set correct expiry for different durations', async () => {
      const now = Date.now();

      const invoice1h = await agentfund.createInvoice({
        amount: 0.001,
        expiresIn: '1h',
      });
      expect(invoice1h.expiresAt.getTime()).toBeGreaterThan(now + 59 * 60 * 1000);
      expect(invoice1h.expiresAt.getTime()).toBeLessThan(now + 61 * 60 * 1000);

      const invoice24h = await agentfund.createInvoice({
        amount: 0.001,
        expiresIn: '24h',
      });
      expect(invoice24h.expiresAt.getTime()).toBeGreaterThan(now + 23 * 60 * 60 * 1000);
    });

    it('should default to 1 hour expiry', async () => {
      const now = Date.now();
      const invoice = await agentfund.createInvoice({ amount: 0.001 });
      
      expect(invoice.expiresAt.getTime()).toBeGreaterThan(now + 59 * 60 * 1000);
    });
  });

  describe('verifyPayment', () => {
    it('should return false for unpaid invoice', async () => {
      const invoice = await agentfund.createInvoice({
        amount: 0.001,
        memo: 'Test',
      });

      const paid = await agentfund.verifyPayment(invoice.id);
      expect(paid).toBe(false);
    });

    it('should return true after payment is recorded', async () => {
      const invoice = await agentfund.createInvoice({
        amount: 0.001,
        memo: 'Test',
      });

      // Record payment
      await agentfund.micropayments.recordPayment(invoice.id, 0.001);

      const paid = await agentfund.verifyPayment(invoice.id);
      expect(paid).toBe(true);
    });

    it('should return false for expired invoice', async () => {
      // Create invoice that expires immediately
      const invoice = await agentfund.createInvoice({
        amount: 0.001,
        expiresIn: '1m', // 1 minute
      });

      // Manually set expiry to past
      invoice.expiresAt = new Date(Date.now() - 1000);

      const paid = await agentfund.verifyPayment(invoice.id);
      expect(paid).toBe(false);
    });
  });

  describe('getBalance', () => {
    it('should return zero for new wallet', async () => {
      const balance = await agentfund.getBalance();
      expect(balance.sol).toBe(0);
      expect(balance.tokens.size).toBe(0);
    });
  });
});

describe('Micropayments', () => {
  let agentfund: AgentFund;

  beforeEach(() => {
    agentfund = new AgentFund({
      rpcUrl: 'https://api.devnet.solana.com',
      wallet: Keypair.generate(),
    });
  });

  describe('recordPayment', () => {
    it('should accumulate multiple payments', async () => {
      const invoice = await agentfund.createInvoice({
        amount: 0.003,
        memo: 'Test',
      });

      await agentfund.micropayments.recordPayment(invoice.id, 0.001);
      expect(await agentfund.verifyPayment(invoice.id)).toBe(false);

      await agentfund.micropayments.recordPayment(invoice.id, 0.001);
      expect(await agentfund.verifyPayment(invoice.id)).toBe(false);

      await agentfund.micropayments.recordPayment(invoice.id, 0.001);
      expect(await agentfund.verifyPayment(invoice.id)).toBe(true);
    });
  });

  describe('settleBatch', () => {
    it('should throw when no pending payments', async () => {
      await expect(agentfund.settleBatch()).rejects.toThrow('No pending payments');
    });

    it('should create batch for received payments', async () => {
      const invoice1 = await agentfund.createInvoice({ amount: 0.001 });
      const invoice2 = await agentfund.createInvoice({ amount: 0.002 });

      await agentfund.micropayments.recordPayment(invoice1.id, 0.001);
      await agentfund.micropayments.recordPayment(invoice2.id, 0.002);

      const batch = await agentfund.settleBatch();

      expect(batch.id).toMatch(/^batch_/);
      expect(batch.invoices).toHaveLength(2);
      expect(batch.totalAmount).toBe(0.003);
      expect(batch.status).toBe('pending');
    });
  });
});

describe('ID Generation', () => {
  it('should generate unique invoice IDs', async () => {
    const agentfund = new AgentFund({
      rpcUrl: 'https://api.devnet.solana.com',
      wallet: Keypair.generate(),
    });

    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const invoice = await agentfund.createInvoice({ amount: 0.001 });
      ids.add(invoice.id);
    }

    expect(ids.size).toBe(100);
  });
});

/**
 * Micropayments Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { Micropayments } from '../src/micropayments';
import { Invoice, PaymentStatus } from '../src/types';

function createTestInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `inv_test_${Math.random().toString(36).slice(2)}`,
    recipient: Keypair.generate().publicKey,
    amount: 0.001,
    memo: 'test invoice',
    expiresAt: new Date(Date.now() + 3600000),
    status: PaymentStatus.PENDING,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Micropayments', () => {
  let mp: Micropayments;
  let connection: Connection;

  beforeEach(() => {
    connection = new Connection('https://api.devnet.solana.com');
    mp = new Micropayments(connection, Keypair.generate());
  });

  describe('registerInvoice', () => {
    it('should register and track an invoice', async () => {
      const invoice = createTestInvoice();
      await mp.registerInvoice(invoice);

      const invoices = mp.listInvoices();
      expect(invoices).toHaveLength(1);
      expect(invoices[0].id).toBe(invoice.id);
    });

    it('should handle multiple invoices', async () => {
      for (let i = 0; i < 5; i++) {
        await mp.registerInvoice(createTestInvoice());
      }
      expect(mp.listInvoices()).toHaveLength(5);
    });

    it('should not mutate original invoice object', async () => {
      const invoice = createTestInvoice();
      const originalStatus = invoice.status;
      await mp.registerInvoice(invoice);

      // Record payment on internal copy
      const tracked = mp.listInvoices()[0];
      tracked.status = PaymentStatus.RECEIVED;

      // Original should be unchanged
      expect(invoice.status).toBe(originalStatus);
    });
  });

  describe('checkPayment', () => {
    it('should return false for unknown invoice', async () => {
      const result = await mp.checkPayment('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false for unpaid invoice', async () => {
      const invoice = createTestInvoice();
      await mp.registerInvoice(invoice);

      const result = await mp.checkPayment(invoice.id);
      expect(result).toBe(false);
    });

    it('should detect expired invoices', async () => {
      const invoice = createTestInvoice({
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });
      await mp.registerInvoice(invoice);

      const result = await mp.checkPayment(invoice.id);
      expect(result).toBe(false);
    });

    it('should return true after recording sufficient payment', async () => {
      const invoice = createTestInvoice({ amount: 0.002 });
      await mp.registerInvoice(invoice);

      await mp.recordPayment(invoice.id, 0.002);
      const result = await mp.checkPayment(invoice.id);
      expect(result).toBe(true);
    });

    it('should handle partial payments', async () => {
      const invoice = createTestInvoice({ amount: 0.003 });
      await mp.registerInvoice(invoice);

      await mp.recordPayment(invoice.id, 0.001);
      expect(await mp.checkPayment(invoice.id)).toBe(false);

      await mp.recordPayment(invoice.id, 0.002);
      expect(await mp.checkPayment(invoice.id)).toBe(true);
    });
  });

  describe('settlePending', () => {
    it('should throw when no payments pending', async () => {
      await expect(mp.settlePending()).rejects.toThrow('No pending payments');
    });

    it('should settle received payments', async () => {
      const inv1 = createTestInvoice({ amount: 0.001 });
      const inv2 = createTestInvoice({ amount: 0.002 });
      await mp.registerInvoice(inv1);
      await mp.registerInvoice(inv2);

      await mp.recordPayment(inv1.id, 0.001);
      await mp.recordPayment(inv2.id, 0.002);
      await mp.checkPayment(inv1.id);
      await mp.checkPayment(inv2.id);

      const settlement = await mp.settlePending();
      expect(settlement.invoices).toHaveLength(2);
      expect(settlement.totalAmount).toBeCloseTo(0.003);
      expect(settlement.status).toBe('settled');
    });

    it('should not settle unpaid invoices', async () => {
      const paid = createTestInvoice({ amount: 0.001 });
      const unpaid = createTestInvoice({ amount: 0.005 });
      await mp.registerInvoice(paid);
      await mp.registerInvoice(unpaid);

      await mp.recordPayment(paid.id, 0.001);
      await mp.checkPayment(paid.id);

      const settlement = await mp.settlePending();
      expect(settlement.invoices).toHaveLength(1);
      expect(settlement.totalAmount).toBeCloseTo(0.001);
    });

    it('should record settlement in history', async () => {
      const inv = createTestInvoice({ amount: 0.001 });
      await mp.registerInvoice(inv);
      await mp.recordPayment(inv.id, 0.001);
      await mp.checkPayment(inv.id);

      await mp.settlePending();

      const history = mp.getSettlementHistory();
      expect(history).toHaveLength(1);
      expect(history[0].settledAt).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return zero stats initially', () => {
      const stats = mp.getStats();
      expect(stats.totalInvoices).toBe(0);
      expect(stats.paidInvoices).toBe(0);
      expect(stats.settledInvoices).toBe(0);
      expect(stats.batchCount).toBe(0);
    });

    it('should track invoice counts', async () => {
      await mp.registerInvoice(createTestInvoice());
      await mp.registerInvoice(createTestInvoice());

      const stats = mp.getStats();
      expect(stats.totalInvoices).toBe(2);
    });
  });

  describe('shouldAutoSettle', () => {
    it('should return false below threshold', () => {
      expect(mp.shouldAutoSettle()).toBe(false);
    });

    it('should return true at threshold', async () => {
      const mp10 = new Micropayments(connection, Keypair.generate(), {
        batchThreshold: 2,
      });

      const inv1 = createTestInvoice({ amount: 0.001 });
      const inv2 = createTestInvoice({ amount: 0.001 });
      await mp10.registerInvoice(inv1);
      await mp10.registerInvoice(inv2);
      await mp10.recordPayment(inv1.id, 0.001);
      await mp10.recordPayment(inv2.id, 0.001);
      await mp10.checkPayment(inv1.id);
      await mp10.checkPayment(inv2.id);

      expect(mp10.shouldAutoSettle()).toBe(true);
    });
  });

  describe('Phase 2 features', () => {
    it('should throw for openChannel', async () => {
      await expect(
        mp.openChannel(Keypair.generate().publicKey, 1.0)
      ).rejects.toThrow('Phase 2');
    });

    it('should throw for sendChannelPayment', async () => {
      await expect(
        mp.sendChannelPayment('chan_123', 0.001)
      ).rejects.toThrow('Phase 2');
    });

    it('should throw for closeChannel', async () => {
      await expect(mp.closeChannel('chan_123')).rejects.toThrow('Phase 2');
    });
  });
});

/**
 * Invoice API routes
 */

import { Router } from 'express';
import { AgentFund } from '@agentfund/sdk';

export const invoiceRouter = Router();

// In-memory store for demo (use DB in production)
const invoices = new Map<string, any>();

/**
 * POST /invoices
 * Create a new invoice
 */
invoiceRouter.post('/', async (req, res, next) => {
  try {
    const agentfund: AgentFund = req.app.locals.agentfund;
    const { amount, memo, expiresIn } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const invoice = await agentfund.createInvoice({
      amount,
      memo: memo || '',
      expiresIn: expiresIn || '1h',
    });

    // Store invoice
    invoices.set(invoice.id, invoice);

    res.status(201).json({
      success: true,
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        memo: invoice.memo,
        status: invoice.status,
        recipient: invoice.recipient.toString(),
        expiresAt: invoice.expiresAt.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
      },
      paymentInstructions: {
        wallet: invoice.recipient.toString(),
        amount: invoice.amount,
        memo: `Invoice: ${invoice.id}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /invoices/:id
 * Get invoice details
 */
invoiceRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = invoices.get(id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if expired
    const now = new Date();
    if (now > invoice.expiresAt && invoice.status === 'pending') {
      invoice.status = 'expired';
    }

    res.json({
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        memo: invoice.memo,
        status: invoice.status,
        recipient: invoice.recipient.toString(),
        expiresAt: invoice.expiresAt.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/verify
 * Verify payment for an invoice
 */
invoiceRouter.post('/:id/verify', async (req, res, next) => {
  try {
    const agentfund: AgentFund = req.app.locals.agentfund;
    const { id } = req.params;

    const invoice = invoices.get(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const paid = await agentfund.verifyPayment(id);

    if (paid) {
      invoice.status = 'paid';
    }

    res.json({
      invoiceId: id,
      paid,
      status: invoice.status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/simulate-payment
 * Simulate a payment (for testing)
 */
invoiceRouter.post('/:id/simulate-payment', async (req, res, next) => {
  try {
    const agentfund: AgentFund = req.app.locals.agentfund;
    const { id } = req.params;

    const invoice = invoices.get(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Record simulated payment
    await agentfund.micropayments.recordPayment(id, invoice.amount);
    invoice.status = 'received';

    res.json({
      success: true,
      message: 'Payment simulated',
      invoiceId: id,
      amount: invoice.amount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /invoices
 * List all invoices
 */
invoiceRouter.get('/', async (req, res) => {
  const { status } = req.query;

  let result = Array.from(invoices.values());

  if (status) {
    result = result.filter(inv => inv.status === status);
  }

  res.json({
    invoices: result.map(inv => ({
      id: inv.id,
      amount: inv.amount,
      memo: inv.memo,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
    })),
    count: result.length,
  });
});

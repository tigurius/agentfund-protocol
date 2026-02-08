/**
 * Subscription API routes
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { SubscriptionManager, Subscription, SubscriptionInterval } from '@agentfund/sdk';
import { AgentFund } from '@agentfund/sdk';

export const subscriptionsRouter = Router();

// Initialize subscription manager
let subscriptionManager: SubscriptionManager | null = null;

function getManager(req: any): SubscriptionManager {
  if (!subscriptionManager) {
    const agentfund: AgentFund = req.app.locals.agentfund;
    subscriptionManager = new SubscriptionManager(async (sub: Subscription) => {
      return agentfund.createInvoice({
        amount: sub.amount,
        memo: `Subscription ${sub.id} - ${sub.interval} payment`,
        expiresIn: '24h',
      });
    });
  }
  return subscriptionManager;
}

/**
 * POST /subscriptions
 * Create a new subscription
 */
subscriptionsRouter.post('/', async (req, res, next) => {
  try {
    const manager = getManager(req);
    const { subscriber, amount, interval, token, startAt, metadata } = req.body;

    if (!subscriber || !amount || !interval) {
      return res.status(400).json({
        error: 'Missing required fields: subscriber, amount, interval',
      });
    }

    const validIntervals: SubscriptionInterval[] = ['hourly', 'daily', 'weekly', 'monthly'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}`,
      });
    }

    const subscription = manager.create({
      subscriber: new PublicKey(subscriber),
      provider: new PublicKey(req.app.locals.walletAddress),
      amount,
      interval,
      token: token ? new PublicKey(token) : undefined,
      startAt: startAt ? new Date(startAt) : undefined,
      metadata,
    });

    res.status(201).json({
      success: true,
      subscription: formatSubscription(subscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /subscriptions
 * List subscriptions
 */
subscriptionsRouter.get('/', (req, res) => {
  const manager = getManager(req);
  const { subscriber, status } = req.query;

  const filter: any = {};
  if (subscriber) filter.subscriber = new PublicKey(subscriber as string);
  if (status) filter.status = status as string;

  const subscriptions = manager.list(filter);

  res.json({
    subscriptions: subscriptions.map(formatSubscription),
    count: subscriptions.length,
  });
});

/**
 * GET /subscriptions/stats
 * Get subscription statistics
 */
subscriptionsRouter.get('/stats', (req, res) => {
  const manager = getManager(req);
  const stats = manager.getStats();

  res.json({
    stats: {
      ...stats,
      mrrFormatted: `${stats.mrr.toFixed(4)} SOL`,
    },
  });
});

/**
 * GET /subscriptions/:id
 * Get subscription details
 */
subscriptionsRouter.get('/:id', (req, res) => {
  const manager = getManager(req);
  const subscription = manager.get(req.params.id);

  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  res.json({ subscription: formatSubscription(subscription) });
});

/**
 * POST /subscriptions/:id/pause
 * Pause a subscription
 */
subscriptionsRouter.post('/:id/pause', (req, res, next) => {
  try {
    const manager = getManager(req);
    const subscription = manager.pause(req.params.id);

    res.json({
      success: true,
      message: 'Subscription paused',
      subscription: formatSubscription(subscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /subscriptions/:id/resume
 * Resume a paused subscription
 */
subscriptionsRouter.post('/:id/resume', (req, res, next) => {
  try {
    const manager = getManager(req);
    const subscription = manager.resume(req.params.id);

    res.json({
      success: true,
      message: 'Subscription resumed',
      subscription: formatSubscription(subscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /subscriptions/:id/cancel
 * Cancel a subscription
 */
subscriptionsRouter.post('/:id/cancel', (req, res, next) => {
  try {
    const manager = getManager(req);
    const subscription = manager.cancel(req.params.id);

    res.json({
      success: true,
      message: 'Subscription cancelled',
      subscription: formatSubscription(subscription),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /subscriptions/process
 * Process due subscriptions (create invoices)
 */
subscriptionsRouter.post('/process', async (req, res, next) => {
  try {
    const manager = getManager(req);
    const results = await manager.processDue();

    res.json({
      success: true,
      processed: results.length,
      invoices: results.map(r => ({
        subscriptionId: r.subscription.id,
        invoiceId: r.invoice.id,
        amount: r.invoice.amount,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Helper to format subscription for API response
function formatSubscription(sub: Subscription) {
  return {
    id: sub.id,
    subscriber: sub.subscriber.toString(),
    provider: sub.provider.toString(),
    amount: sub.amount,
    interval: sub.interval,
    token: sub.token?.toString(),
    status: sub.status,
    createdAt: sub.createdAt.toISOString(),
    nextBillingAt: sub.nextBillingAt.toISOString(),
    lastPaymentAt: sub.lastPaymentAt?.toISOString(),
    paymentCount: sub.paymentCount,
    metadata: sub.metadata,
  };
}

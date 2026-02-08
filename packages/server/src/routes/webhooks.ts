/**
 * Webhook management API routes
 */

import { Router } from 'express';
import { WebhookManager, WebhookEventType, webhooks } from '@agentfund/sdk';

export const webhooksRouter = Router();

/**
 * POST /webhooks
 * Register a new webhook
 */
webhooksRouter.post('/', (req, res) => {
  const { id, url, secret, events } = req.body;

  if (!id || !url || !events || !Array.isArray(events)) {
    return res.status(400).json({
      error: 'Missing required fields: id, url, events (array)',
    });
  }

  const validEvents: WebhookEventType[] = [
    'invoice.created',
    'invoice.paid',
    'invoice.expired',
    'batch.settled',
    'channel.opened',
    'channel.payment',
    'channel.closed',
  ];

  const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEventType));
  if (invalidEvents.length > 0) {
    return res.status(400).json({
      error: `Invalid events: ${invalidEvents.join(', ')}`,
      validEvents,
    });
  }

  webhooks.register(id, {
    url,
    secret,
    events: events as WebhookEventType[],
  });

  res.status(201).json({
    success: true,
    message: 'Webhook registered',
    webhook: { id, url, events },
  });
});

/**
 * GET /webhooks
 * List registered webhooks
 */
webhooksRouter.get('/', (req, res) => {
  const registered = webhooks.list();
  const result = [];

  for (const [id, config] of registered) {
    result.push({
      id,
      url: config.url,
      events: config.events,
      hasSecret: !!config.secret,
    });
  }

  res.json({
    webhooks: result,
    count: result.length,
  });
});

/**
 * DELETE /webhooks/:id
 * Unregister a webhook
 */
webhooksRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  webhooks.unregister(id);

  res.json({
    success: true,
    message: 'Webhook unregistered',
    id,
  });
});

/**
 * POST /webhooks/test
 * Send a test event to all registered webhooks
 */
webhooksRouter.post('/test', async (req, res) => {
  const { eventType } = req.body;

  const type = (eventType || 'invoice.created') as WebhookEventType;

  await webhooks.emit(type, {
    test: true,
    message: 'This is a test webhook event',
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Test event '${type}' sent to all subscribed webhooks`,
  });
});

/**
 * GET /webhooks/events
 * List available event types
 */
webhooksRouter.get('/events', (req, res) => {
  res.json({
    events: [
      { type: 'invoice.created', description: 'New invoice created' },
      { type: 'invoice.paid', description: 'Invoice payment received' },
      { type: 'invoice.expired', description: 'Invoice expired without payment' },
      { type: 'batch.settled', description: 'Batch of micropayments settled' },
      { type: 'channel.opened', description: 'Payment channel opened' },
      { type: 'channel.payment', description: 'Payment sent through channel' },
      { type: 'channel.closed', description: 'Payment channel closed' },
    ],
  });
});

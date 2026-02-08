/**
 * Service registry and invocation routes
 */

import { Router } from 'express';
import { AgentFund } from '@agentfund/sdk';

export const servicesRouter = Router();

// Service registry
interface Service {
  id: string;
  name: string;
  description: string;
  pricePerCall: number;
  handler: (input: any) => Promise<any>;
}

const services = new Map<string, Service>();

// Register default demo services
services.set('sentiment', {
  id: 'sentiment',
  name: 'Sentiment Analysis',
  description: 'Analyze the sentiment of text (positive, negative, neutral)',
  pricePerCall: 0.0001,
  handler: async (input: { text: string }) => {
    // Simulated sentiment analysis
    const text = input.text.toLowerCase();
    let sentiment = 'neutral';
    let confidence = 0.5;

    const positiveWords = ['love', 'great', 'awesome', 'good', 'happy', 'excellent'];
    const negativeWords = ['hate', 'bad', 'terrible', 'awful', 'sad', 'horrible'];

    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = 0.7 + (positiveCount * 0.05);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = 0.7 + (negativeCount * 0.05);
    }

    return {
      sentiment,
      confidence: Math.min(confidence, 0.99),
      wordCount: text.split(' ').length,
    };
  },
});

services.set('summary', {
  id: 'summary',
  name: 'Text Summarization',
  description: 'Summarize long text into key points',
  pricePerCall: 0.0002,
  handler: async (input: { text: string }) => {
    // Simulated summarization
    const sentences = input.text.split(/[.!?]+/).filter(s => s.trim());
    const keyPoints = sentences.slice(0, 3).map(s => s.trim());

    return {
      summary: keyPoints.join('. ') + '.',
      originalLength: input.text.length,
      summaryLength: keyPoints.join('. ').length,
      reduction: Math.round((1 - keyPoints.join('. ').length / input.text.length) * 100),
    };
  },
});

services.set('entities', {
  id: 'entities',
  name: 'Entity Extraction',
  description: 'Extract named entities from text',
  pricePerCall: 0.00015,
  handler: async (input: { text: string }) => {
    // Simulated entity extraction
    const words = input.text.split(' ');
    const entities = words
      .filter(w => w.length > 2 && w[0] === w[0].toUpperCase())
      .map(w => ({
        text: w.replace(/[^a-zA-Z]/g, ''),
        type: 'UNKNOWN',
      }))
      .filter(e => e.text.length > 0);

    return {
      entities,
      count: entities.length,
    };
  },
});

/**
 * GET /services
 * List available services
 */
servicesRouter.get('/', (req, res) => {
  const serviceList = Array.from(services.values()).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    pricePerCall: s.pricePerCall,
  }));

  res.json({
    services: serviceList,
    count: serviceList.length,
    paymentMethod: 'AgentFund invoice',
  });
});

/**
 * GET /services/:id
 * Get service details
 */
servicesRouter.get('/:id', (req, res) => {
  const service = services.get(req.params.id);

  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  res.json({
    service: {
      id: service.id,
      name: service.name,
      description: service.description,
      pricePerCall: service.pricePerCall,
    },
  });
});

/**
 * POST /services/:id/invoke
 * Invoke a service (requires payment)
 */
servicesRouter.post('/:id/invoke', async (req, res, next) => {
  try {
    const agentfund: AgentFund = req.app.locals.agentfund;
    const { id } = req.params;
    const { input, invoiceId } = req.body;

    const service = services.get(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // If no invoice provided, create one
    if (!invoiceId) {
      const invoice = await agentfund.createInvoice({
        amount: service.pricePerCall,
        memo: `Service: ${service.id}`,
        expiresIn: '5m',
      });

      return res.status(402).json({
        status: 'payment_required',
        service: service.id,
        price: service.pricePerCall,
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          expiresAt: invoice.expiresAt.toISOString(),
          payTo: invoice.recipient.toString(),
        },
        instructions: 'Pay the invoice and retry with invoiceId in request body',
      });
    }

    // Verify payment
    const paid = await agentfund.verifyPayment(invoiceId);

    if (!paid) {
      return res.status(402).json({
        status: 'payment_pending',
        invoiceId,
        message: 'Payment not yet received. Please complete payment and retry.',
      });
    }

    // Execute service
    const result = await service.handler(input);

    res.json({
      status: 'success',
      service: service.id,
      invoiceId,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /services/register
 * Register a custom service (for extensibility)
 */
servicesRouter.post('/register', (req, res) => {
  const { id, name, description, pricePerCall } = req.body;

  if (!id || !name || !pricePerCall) {
    return res.status(400).json({
      error: 'Missing required fields: id, name, pricePerCall',
    });
  }

  if (services.has(id)) {
    return res.status(409).json({ error: 'Service ID already exists' });
  }

  // Register with placeholder handler
  services.set(id, {
    id,
    name,
    description: description || '',
    pricePerCall,
    handler: async () => ({ error: 'Handler not implemented' }),
  });

  res.status(201).json({
    success: true,
    message: 'Service registered',
    service: { id, name, description, pricePerCall },
  });
});

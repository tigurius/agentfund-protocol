/**
 * OpenAPI/Swagger Configuration for AgentFund API
 */

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'AgentFund Protocol API',
    version: '0.1.0',
    description: 'Self-funding infrastructure for autonomous agents on Solana',
    contact: {
      name: 'SatsAgent',
      url: 'https://github.com/tigurius/agentfund-protocol',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
    {
      url: 'https://api.agentfund.dev',
      description: 'Devnet API',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health checks' },
    { name: 'Invoices', description: 'Payment invoice management' },
    { name: 'Services', description: 'Agent services with 402 payments' },
    { name: 'Registry', description: 'Agent discovery and marketplace' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    wallet: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/invoices': {
      post: {
        tags: ['Invoices'],
        summary: 'Create a new invoice',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: {
                  amount: { type: 'number', description: 'Amount in SOL' },
                  memo: { type: 'string', description: 'Invoice memo/description' },
                  expiresIn: { type: 'string', example: '1h', description: 'Expiry duration' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Invoice created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Invoices'],
        summary: 'List all invoices',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'expired'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': {
            description: 'List of invoices',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Invoice' },
                },
              },
            },
          },
        },
      },
    },
    '/invoices/{id}': {
      get: {
        tags: ['Invoices'],
        summary: 'Get invoice by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Invoice details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
          '404': { description: 'Invoice not found' },
        },
      },
    },
    '/invoices/{id}/pay': {
      post: {
        tags: ['Invoices'],
        summary: 'Pay an invoice',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['signature'],
                properties: {
                  signature: { type: 'string', description: 'Transaction signature' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Payment confirmed' },
          '400': { description: 'Invalid payment' },
          '404': { description: 'Invoice not found' },
        },
      },
    },
    '/services/sentiment': {
      post: {
        tags: ['Services'],
        summary: 'Sentiment analysis service (requires payment)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', description: 'Text to analyze' },
                  invoiceId: { type: 'string', description: 'Paid invoice ID' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Analysis result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                    confidence: { type: 'number' },
                    text: { type: 'string' },
                  },
                },
              },
            },
          },
          '402': {
            description: 'Payment required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
        },
      },
    },
    '/registry/agents': {
      get: {
        tags: ['Registry'],
        summary: 'List registered agents',
        parameters: [
          { name: 'capability', in: 'query', schema: { type: 'string' } },
          { name: 'minRating', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          '200': {
            description: 'List of agents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AgentProfile' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Registry'],
        summary: 'Register a new agent',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AgentRegistration' },
            },
          },
        },
        responses: {
          '201': { description: 'Agent registered' },
          '400': { description: 'Invalid registration' },
        },
      },
    },
  },
  components: {
    schemas: {
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          recipient: { type: 'string', description: 'Solana address' },
          amount: { type: 'number', description: 'Amount in SOL' },
          amountLamports: { type: 'integer', description: 'Amount in lamports' },
          memo: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'paid', 'expired', 'cancelled'] },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          paidAt: { type: 'string', format: 'date-time', nullable: true },
          payer: { type: 'string', nullable: true },
          signature: { type: 'string', nullable: true },
        },
      },
      AgentProfile: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Solana address' },
          name: { type: 'string' },
          description: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          basePrice: { type: 'integer', description: 'Base price in lamports' },
          rating: { type: 'number', minimum: 0, maximum: 5 },
          completedJobs: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      AgentRegistration: {
        type: 'object',
        required: ['name', 'capabilities', 'basePrice'],
        properties: {
          name: { type: 'string', maxLength: 32 },
          description: { type: 'string', maxLength: 256 },
          capabilities: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          basePrice: { type: 'integer', minimum: 0 },
          endpoint: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

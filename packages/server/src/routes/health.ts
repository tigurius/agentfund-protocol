/**
 * Health check routes
 */

import { Router } from 'express';
import { Connection } from '@solana/web3.js';

export const healthRouter = Router();

/**
 * GET /health
 * Basic health check
 */
healthRouter.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // Check Solana connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );
    const slot = await connection.getSlot();

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      solana: {
        connected: true,
        slot,
        network: process.env.SOLANA_RPC_URL?.includes('mainnet')
          ? 'mainnet'
          : process.env.SOLANA_RPC_URL?.includes('testnet')
          ? 'testnet'
          : 'devnet',
      },
      responseTimeMs: responseTime,
      version: '0.1.0',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message,
      solana: {
        connected: false,
      },
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe (for k8s)
 */
healthRouter.get('/ready', (req, res) => {
  res.json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/live
 * Liveness probe (for k8s)
 */
healthRouter.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

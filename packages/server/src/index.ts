/**
 * AgentFund API Server
 * 
 * Exposes a REST API for agent services with integrated payments
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { AgentFund } from '@agentfund/sdk';
import { Keypair } from '@solana/web3.js';
import { invoiceRouter } from './routes/invoices';
import { servicesRouter } from './routes/services';
import { healthRouter } from './routes/health';
import registryRouter from './routes/registry';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/logger';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Initialize AgentFund
const wallet = process.env.WALLET_SECRET_KEY
  ? Keypair.fromSecretKey(Buffer.from(process.env.WALLET_SECRET_KEY, 'base64'))
  : Keypair.generate();

export const agentfund = new AgentFund({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  wallet,
});

// Store wallet address for the server
app.locals.walletAddress = wallet.publicKey.toString();
app.locals.agentfund = agentfund;

// Routes
app.use('/health', healthRouter);
app.use('/invoices', invoiceRouter);
app.use('/services', servicesRouter);
app.use('/registry', registryRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AgentFund API Server',
    version: '0.1.0',
    wallet: app.locals.walletAddress,
    endpoints: {
      health: '/health',
      invoices: '/invoices',
      services: '/services',
      registry: '/registry',
    },
    docs: 'https://github.com/tigurius/agentfund-protocol',
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           AgentFund API Server                            ║
╠═══════════════════════════════════════════════════════════╣
║  Port:    ${PORT.toString().padEnd(45)}║
║  Wallet:  ${app.locals.walletAddress.slice(0, 43)}...║
║  Network: ${(process.env.SOLANA_RPC_URL || 'devnet').slice(0, 43).padEnd(44)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;

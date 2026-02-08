/**
 * Agent Registry Routes
 * 
 * REST API for agent discovery and service marketplace.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// In-memory store (use database in production)
interface Agent {
  id: string;
  owner: string;
  name: string;
  description: string;
  capabilities: string[];
  basePrice: number;
  isActive: boolean;
  totalRequests: number;
  totalEarnings: number;
  registeredAt: string;
  lastActiveAt: string;
  endpoint?: string;
}

interface ServiceRequest {
  id: string;
  requester: string;
  provider: string;
  capability: string;
  amount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'disputed' | 'refunded';
  createdAt: string;
  completedAt?: string;
  resultHash?: string;
}

const agents: Map<string, Agent> = new Map();
const requests: Map<string, ServiceRequest> = new Map();

// Standard capabilities
const STANDARD_CAPABILITIES = [
  'sentiment',
  'summarization', 
  'translation',
  'entity-extraction',
  'image-generation',
  'code-review',
  'price-feed',
  'market-data',
  'swap-execution',
  'portfolio-analysis',
];

/**
 * GET /registry/agents
 * List all registered agents with optional filters
 */
router.get('/agents', (req: Request, res: Response) => {
  const { 
    capability, 
    active, 
    maxPrice, 
    sortBy = 'registeredAt',
    order = 'desc',
    limit = 50,
    offset = 0 
  } = req.query;

  let results = Array.from(agents.values());

  // Filter by capability
  if (capability && typeof capability === 'string') {
    results = results.filter(a => a.capabilities.includes(capability));
  }

  // Filter by active status
  if (active === 'true') {
    results = results.filter(a => a.isActive);
  }

  // Filter by max price
  if (maxPrice && !isNaN(Number(maxPrice))) {
    results = results.filter(a => a.basePrice <= Number(maxPrice));
  }

  // Sort
  const sortField = sortBy as keyof Agent;
  results.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === undefined || bVal === undefined) return 0;
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  // Paginate
  const limitNum = Math.min(Number(limit) || 50, 100);
  const offsetNum = Number(offset) || 0;
  const paginated = results.slice(offsetNum, offsetNum + limitNum);

  res.json({
    agents: paginated,
    total: results.length,
    limit: limitNum,
    offset: offsetNum,
  });
});

/**
 * GET /registry/agents/:id
 * Get agent by ID or owner address
 */
router.get('/agents/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Try by ID first
  let agent = agents.get(id);
  
  // Try by owner address
  if (!agent) {
    agent = Array.from(agents.values()).find(a => a.owner === id);
  }

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(agent);
});

/**
 * POST /registry/agents
 * Register a new agent
 */
router.post('/agents', (req: Request, res: Response) => {
  const { 
    owner, 
    name, 
    description, 
    capabilities, 
    basePrice,
    endpoint 
  } = req.body;

  // Validation
  if (!owner || !name || !capabilities) {
    return res.status(400).json({ 
      error: 'Missing required fields: owner, name, capabilities' 
    });
  }

  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return res.status(400).json({ 
      error: 'Capabilities must be a non-empty array' 
    });
  }

  // Check if already registered
  const existing = Array.from(agents.values()).find(a => a.owner === owner);
  if (existing) {
    return res.status(409).json({ 
      error: 'Agent already registered',
      agentId: existing.id 
    });
  }

  // Create agent
  const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const agent: Agent = {
    id,
    owner,
    name,
    description: description || '',
    capabilities,
    basePrice: basePrice || 0,
    isActive: true,
    totalRequests: 0,
    totalEarnings: 0,
    registeredAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    endpoint,
  };

  agents.set(id, agent);

  console.log(`Agent registered: ${name} (${id})`);
  
  res.status(201).json({
    message: 'Agent registered successfully',
    agent,
  });
});

/**
 * PATCH /registry/agents/:id
 * Update agent profile
 */
router.patch('/agents/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const agent = agents.get(id);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // Only allow owner to update (in production, verify signature)
  const { owner } = req.body;
  if (owner && owner !== agent.owner) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Update allowed fields
  const allowedFields = ['name', 'description', 'capabilities', 'basePrice', 'isActive', 'endpoint'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      (agent as any)[field] = req.body[field];
    }
  }

  agent.lastActiveAt = new Date().toISOString();
  agents.set(id, agent);

  res.json({
    message: 'Agent updated',
    agent,
  });
});

/**
 * GET /registry/capabilities
 * List all available capabilities
 */
router.get('/capabilities', (_req: Request, res: Response) => {
  // Get all unique capabilities from registered agents
  const agentCapabilities = new Set<string>();
  for (const agent of agents.values()) {
    for (const cap of agent.capabilities) {
      agentCapabilities.add(cap);
    }
  }

  res.json({
    standard: STANDARD_CAPABILITIES,
    active: Array.from(agentCapabilities),
  });
});

/**
 * GET /registry/search
 * Search agents by capability
 */
router.get('/search', (req: Request, res: Response) => {
  const { capability, q } = req.query;

  let results = Array.from(agents.values()).filter(a => a.isActive);

  if (capability && typeof capability === 'string') {
    results = results.filter(a => a.capabilities.includes(capability));
  }

  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    results = results.filter(a => 
      a.name.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query) ||
      a.capabilities.some(c => c.toLowerCase().includes(query))
    );
  }

  res.json({
    results,
    count: results.length,
  });
});

/**
 * POST /registry/requests
 * Create a service request
 */
router.post('/requests', (req: Request, res: Response) => {
  const { requester, providerId, capability, amount } = req.body;

  if (!requester || !providerId || !capability) {
    return res.status(400).json({
      error: 'Missing required fields: requester, providerId, capability'
    });
  }

  const provider = agents.get(providerId);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  if (!provider.isActive) {
    return res.status(400).json({ error: 'Provider is not active' });
  }

  if (!provider.capabilities.includes(capability)) {
    return res.status(400).json({ 
      error: 'Provider does not support this capability',
      available: provider.capabilities 
    });
  }

  const requestAmount = amount || provider.basePrice;
  if (requestAmount < provider.basePrice) {
    return res.status(400).json({
      error: 'Amount below minimum price',
      minPrice: provider.basePrice
    });
  }

  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const request: ServiceRequest = {
    id,
    requester,
    provider: provider.owner,
    capability,
    amount: requestAmount,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  requests.set(id, request);

  console.log(`Service request created: ${id} (${capability})`);

  res.status(201).json({
    message: 'Service request created',
    request,
    // In production, return payment instructions
    payment: {
      to: provider.owner,
      amount: requestAmount,
      memo: `AgentFund:${id}`,
    },
  });
});

/**
 * GET /registry/requests/:id
 * Get request status
 */
router.get('/requests/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const request = requests.get(id);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json(request);
});

/**
 * POST /registry/requests/:id/complete
 * Mark request as completed (provider side)
 */
router.post('/requests/:id/complete', (req: Request, res: Response) => {
  const { id } = req.params;
  const { resultHash, provider } = req.body;

  const request = requests.get(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.status !== 'pending' && request.status !== 'in_progress') {
    return res.status(400).json({ error: 'Request cannot be completed' });
  }

  // Verify provider (in production, verify signature)
  if (provider !== request.provider) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  request.status = 'completed';
  request.completedAt = new Date().toISOString();
  request.resultHash = resultHash;

  // Update provider stats
  const providerAgent = Array.from(agents.values()).find(a => a.owner === provider);
  if (providerAgent) {
    providerAgent.totalRequests++;
    providerAgent.totalEarnings += request.amount;
    providerAgent.lastActiveAt = new Date().toISOString();
  }

  requests.set(id, request);

  console.log(`Service request completed: ${id}`);

  res.json({
    message: 'Request completed',
    request,
  });
});

/**
 * GET /registry/stats
 * Get registry statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  const agentList = Array.from(agents.values());
  const requestList = Array.from(requests.values());

  // Count capabilities
  const capCount: Record<string, number> = {};
  for (const agent of agentList) {
    for (const cap of agent.capabilities) {
      capCount[cap] = (capCount[cap] || 0) + 1;
    }
  }

  const topCapabilities = Object.entries(capCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  res.json({
    totalAgents: agentList.length,
    activeAgents: agentList.filter(a => a.isActive).length,
    totalRequests: requestList.length,
    completedRequests: requestList.filter(r => r.status === 'completed').length,
    totalVolume: requestList.reduce((sum, r) => sum + r.amount, 0),
    topCapabilities,
  });
});

export default router;

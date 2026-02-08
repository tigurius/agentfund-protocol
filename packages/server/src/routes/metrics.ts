/**
 * Prometheus metrics endpoint
 */

import { Router } from 'express';

export const metricsRouter = Router();

// Simple metrics store
const metrics = {
  requests: {
    total: 0,
    byPath: new Map<string, number>(),
    byStatus: new Map<number, number>(),
  },
  invoices: {
    created: 0,
    paid: 0,
    expired: 0,
    totalAmount: 0,
  },
  services: {
    invocations: 0,
    byService: new Map<string, number>(),
  },
  subscriptions: {
    created: 0,
    cancelled: 0,
    processed: 0,
  },
  startTime: Date.now(),
};

/**
 * Record a request
 */
export function recordRequest(path: string, status: number) {
  metrics.requests.total++;
  metrics.requests.byPath.set(path, (metrics.requests.byPath.get(path) || 0) + 1);
  metrics.requests.byStatus.set(status, (metrics.requests.byStatus.get(status) || 0) + 1);
}

/**
 * Record invoice creation
 */
export function recordInvoiceCreated(amount: number) {
  metrics.invoices.created++;
  metrics.invoices.totalAmount += amount;
}

/**
 * Record invoice payment
 */
export function recordInvoicePaid() {
  metrics.invoices.paid++;
}

/**
 * Record service invocation
 */
export function recordServiceInvocation(serviceId: string) {
  metrics.services.invocations++;
  metrics.services.byService.set(
    serviceId,
    (metrics.services.byService.get(serviceId) || 0) + 1
  );
}

/**
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 */
metricsRouter.get('/', (req, res) => {
  const lines: string[] = [];

  // Uptime
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  lines.push(`# HELP agentfund_uptime_seconds Server uptime in seconds`);
  lines.push(`# TYPE agentfund_uptime_seconds gauge`);
  lines.push(`agentfund_uptime_seconds ${uptimeSeconds}`);
  lines.push('');

  // Total requests
  lines.push(`# HELP agentfund_requests_total Total number of HTTP requests`);
  lines.push(`# TYPE agentfund_requests_total counter`);
  lines.push(`agentfund_requests_total ${metrics.requests.total}`);
  lines.push('');

  // Requests by status
  lines.push(`# HELP agentfund_requests_by_status HTTP requests by status code`);
  lines.push(`# TYPE agentfund_requests_by_status counter`);
  for (const [status, count] of metrics.requests.byStatus) {
    lines.push(`agentfund_requests_by_status{status="${status}"} ${count}`);
  }
  lines.push('');

  // Invoices
  lines.push(`# HELP agentfund_invoices_created_total Total invoices created`);
  lines.push(`# TYPE agentfund_invoices_created_total counter`);
  lines.push(`agentfund_invoices_created_total ${metrics.invoices.created}`);
  lines.push('');

  lines.push(`# HELP agentfund_invoices_paid_total Total invoices paid`);
  lines.push(`# TYPE agentfund_invoices_paid_total counter`);
  lines.push(`agentfund_invoices_paid_total ${metrics.invoices.paid}`);
  lines.push('');

  lines.push(`# HELP agentfund_invoices_amount_total Total invoice amount in SOL`);
  lines.push(`# TYPE agentfund_invoices_amount_total counter`);
  lines.push(`agentfund_invoices_amount_total ${metrics.invoices.totalAmount}`);
  lines.push('');

  // Service invocations
  lines.push(`# HELP agentfund_service_invocations_total Total service invocations`);
  lines.push(`# TYPE agentfund_service_invocations_total counter`);
  lines.push(`agentfund_service_invocations_total ${metrics.services.invocations}`);
  lines.push('');

  lines.push(`# HELP agentfund_service_invocations_by_service Service invocations by service ID`);
  lines.push(`# TYPE agentfund_service_invocations_by_service counter`);
  for (const [service, count] of metrics.services.byService) {
    lines.push(`agentfund_service_invocations_by_service{service="${service}"} ${count}`);
  }
  lines.push('');

  // Subscriptions
  lines.push(`# HELP agentfund_subscriptions_created_total Total subscriptions created`);
  lines.push(`# TYPE agentfund_subscriptions_created_total counter`);
  lines.push(`agentfund_subscriptions_created_total ${metrics.subscriptions.created}`);
  lines.push('');

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n'));
});

/**
 * GET /metrics/json
 * JSON format metrics
 */
metricsRouter.get('/json', (req, res) => {
  res.json({
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    requests: {
      total: metrics.requests.total,
      byPath: Object.fromEntries(metrics.requests.byPath),
      byStatus: Object.fromEntries(metrics.requests.byStatus),
    },
    invoices: metrics.invoices,
    services: {
      invocations: metrics.services.invocations,
      byService: Object.fromEntries(metrics.services.byService),
    },
    subscriptions: metrics.subscriptions,
  });
});

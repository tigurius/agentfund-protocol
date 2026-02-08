/**
 * Webhook system for payment notifications
 */

import { Invoice, PaymentStatus } from './types';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: Date;
  data: any;
}

export type WebhookEventType =
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.expired'
  | 'batch.settled'
  | 'channel.opened'
  | 'channel.payment'
  | 'channel.closed';

export interface WebhookConfig {
  url: string;
  secret?: string;
  events: WebhookEventType[];
  retries?: number;
  timeoutMs?: number;
}

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private processing = false;

  /**
   * Register a webhook endpoint
   */
  register(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, {
      retries: 3,
      timeoutMs: 5000,
      ...config,
    });
  }

  /**
   * Unregister a webhook
   */
  unregister(id: string): void {
    this.webhooks.delete(id);
  }

  /**
   * List registered webhooks
   */
  list(): Map<string, WebhookConfig> {
    return new Map(this.webhooks);
  }

  /**
   * Emit an event to all relevant webhooks
   */
  async emit(type: WebhookEventType, data: any): Promise<void> {
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      data,
    };

    this.eventQueue.push(event);
    await this.processQueue();
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.deliverEvent(event);
    }

    this.processing = false;
  }

  /**
   * Deliver event to all subscribed webhooks
   */
  private async deliverEvent(event: WebhookEvent): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    for (const [id, config] of this.webhooks) {
      if (config.events.includes(event.type)) {
        deliveryPromises.push(this.sendWebhook(id, config, event));
      }
    }

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Send webhook with retries
   */
  private async sendWebhook(
    id: string,
    config: WebhookConfig,
    event: WebhookEvent
  ): Promise<void> {
    const payload = JSON.stringify({
      event: event.type,
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      data: event.data,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-ID': id,
      'X-Event-ID': event.id,
    };

    if (config.secret) {
      // Create HMAC signature
      const signature = await this.createSignature(payload, config.secret);
      headers['X-Signature'] = signature;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (config.retries || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          config.timeoutMs || 5000
        );

        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          return; // Success
        }

        lastError = new Error(`Webhook returned ${response.status}`);
      } catch (err: any) {
        lastError = err;
      }

      // Wait before retry (exponential backoff)
      if (attempt < (config.retries || 3) - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    console.error(`Webhook ${id} failed after retries:`, lastError);
  }

  /**
   * Create HMAC-SHA256 signature
   */
  private async createSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    return Buffer.from(signature).toString('hex');
  }
}

// Singleton instance
export const webhooks = new WebhookManager();

/**
 * Helper to create webhook-enabled invoice handler
 */
export function withWebhooks<T extends (...args: any[]) => Promise<Invoice>>(
  fn: T,
  manager: WebhookManager = webhooks
): T {
  return (async (...args: any[]) => {
    const invoice = await fn(...args);
    await manager.emit('invoice.created', {
      invoiceId: invoice.id,
      amount: invoice.amount,
      recipient: invoice.recipient.toString(),
    });
    return invoice;
  }) as T;
}

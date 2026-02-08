/**
 * @fileoverview HTTP client for AgentFund API servers.
 * 
 * Provides a type-safe client for interacting with AgentFund REST APIs,
 * including service discovery, invoice management, and the 402 Payment Required flow.
 * 
 * @module client
 * @author SatsAgent
 * @license MIT
 * 
 * @example
 * ```typescript
 * const client = new AgentFundClient('http://agent.example.com:3000');
 * 
 * // Invoke service with automatic payment
 * const result = await client.invokeWithPayment('sentiment', {
 *   text: 'I love this protocol!'
 * });
 * ```
 */

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  pricePerCall: number;
}

export interface InvoiceResponse {
  id: string;
  amount: number;
  memo: string;
  status: string;
  recipient: string;
  expiresAt: string;
  createdAt: string;
}

export interface ServiceInvokeResult<T = any> {
  status: 'success' | 'payment_required' | 'payment_pending';
  service: string;
  invoiceId?: string;
  result?: T;
  invoice?: {
    id: string;
    amount: number;
    expiresAt: string;
    payTo: string;
  };
}

export class AgentFundClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, options?: { apiKey?: string }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    
    if (options?.apiKey) {
      this.headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
  }

  /**
   * Check server health
   */
  async health(): Promise<{
    status: string;
    solana: { connected: boolean; slot?: number };
  }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * List available services
   */
  async listServices(): Promise<ServiceInfo[]> {
    const response = await fetch(`${this.baseUrl}/services`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.services;
  }

  /**
   * Get service details
   */
  async getService(serviceId: string): Promise<ServiceInfo> {
    const response = await fetch(`${this.baseUrl}/services/${serviceId}`, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.service;
  }

  /**
   * Invoke a service
   * Returns invoice if payment required
   */
  async invokeService<T = any>(
    serviceId: string,
    input: any,
    invoiceId?: string
  ): Promise<ServiceInvokeResult<T>> {
    const response = await fetch(`${this.baseUrl}/services/${serviceId}/invoke`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ input, invoiceId }),
    });

    return response.json();
  }

  /**
   * Create an invoice
   */
  async createInvoice(params: {
    amount: number;
    memo?: string;
    expiresIn?: string;
  }): Promise<InvoiceResponse> {
    const response = await fetch(`${this.baseUrl}/invoices`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(params),
    });
    const data = await response.json();
    return data.invoice;
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string): Promise<InvoiceResponse> {
    const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}`, {
      headers: this.headers,
    });
    const data = await response.json();
    return data.invoice;
  }

  /**
   * Verify invoice payment
   */
  async verifyInvoice(invoiceId: string): Promise<{ paid: boolean; status: string }> {
    const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}/verify`, {
      method: 'POST',
      headers: this.headers,
    });
    return response.json();
  }

  /**
   * Simulate payment (for testing)
   */
  async simulatePayment(invoiceId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${this.baseUrl}/invoices/${invoiceId}/simulate-payment`,
      {
        method: 'POST',
        headers: this.headers,
      }
    );
    return response.json();
  }

  /**
   * Full service invocation with automatic payment
   * 
   * 1. Invoke service -> get invoice
   * 2. Simulate payment (or real payment via callback)
   * 3. Invoke again with invoice ID
   */
  async invokeWithPayment<T = any>(
    serviceId: string,
    input: any,
    paymentCallback?: (invoice: { id: string; amount: number; payTo: string }) => Promise<void>
  ): Promise<T> {
    // First invocation to get invoice
    const firstResult = await this.invokeService<T>(serviceId, input);

    if (firstResult.status === 'success') {
      return firstResult.result!;
    }

    if (firstResult.status !== 'payment_required' || !firstResult.invoice) {
      throw new Error('Unexpected response status');
    }

    // Handle payment
    if (paymentCallback) {
      await paymentCallback(firstResult.invoice);
    } else {
      // Use simulated payment for testing
      await this.simulatePayment(firstResult.invoice.id);
    }

    // Retry with invoice ID
    const secondResult = await this.invokeService<T>(
      serviceId,
      input,
      firstResult.invoice.id
    );

    if (secondResult.status === 'success') {
      return secondResult.result!;
    }

    throw new Error(`Service invocation failed: ${secondResult.status}`);
  }
}

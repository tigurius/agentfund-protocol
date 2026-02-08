/**
 * Persistence Layer
 * 
 * Provides durable storage for invoices, subscriptions, and other data.
 * Default implementation uses JSON files, but can be swapped for SQLite, Redis, etc.
 */

import { Invoice, PaymentStatus, BatchSettlement } from './types';
import { Subscription } from './subscriptions';
import * as fs from 'fs';
import * as path from 'path';

export interface PersistenceConfig {
  /** Storage directory */
  dataDir: string;
  /** Auto-save interval in ms (0 = manual only) */
  autoSaveInterval?: number;
}

export interface StorageAdapter {
  load<T>(key: string): Promise<T | null>;
  save<T>(key: string, data: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/**
 * File-based storage adapter (JSON files)
 */
export class FileStorageAdapter implements StorageAdapter {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private getPath(key: string): string {
    // Sanitize key for filename
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safeKey}.json`);
  }

  async load<T>(key: string): Promise<T | null> {
    const filePath = this.getPath(key);
    try {
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data, this.reviver) as T;
    } catch (err) {
      console.error(`Failed to load ${key}:`, err);
      return null;
    }
  }

  async save<T>(key: string, data: T): Promise<void> {
    const filePath = this.getPath(key);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, this.replacer, 2));
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getPath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete ${key}:`, err);
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.dataDir);
      return files
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  // JSON serialization helpers for BigInt and Date
  private replacer(_key: string, value: any): any {
    if (typeof value === 'bigint') {
      return { __type: 'bigint', value: value.toString() };
    }
    if (value instanceof Date) {
      return { __type: 'date', value: value.toISOString() };
    }
    return value;
  }

  private reviver(_key: string, value: any): any {
    if (value && typeof value === 'object') {
      if (value.__type === 'bigint') {
        return BigInt(value.value);
      }
      if (value.__type === 'date') {
        return new Date(value.value);
      }
    }
    return value;
  }
}

/**
 * In-memory storage adapter (for testing)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private data: Map<string, any> = new Map();

  async load<T>(key: string): Promise<T | null> {
    return this.data.get(key) ?? null;
  }

  async save<T>(key: string, data: T): Promise<void> {
    this.data.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.data.keys()).filter(k => k.startsWith(prefix));
  }
}

/**
 * Invoice Store with persistence
 */
export class InvoiceStore {
  private adapter: StorageAdapter;
  private cache: Map<string, Invoice> = new Map();
  private loaded = false;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const keys = await this.adapter.list('invoice_');
    for (const key of keys) {
      const invoice = await this.adapter.load<Invoice>(key);
      if (invoice) {
        this.cache.set(invoice.id, invoice);
      }
    }
    this.loaded = true;
  }

  async create(invoice: Invoice): Promise<void> {
    await this.ensureLoaded();
    this.cache.set(invoice.id, invoice);
    await this.adapter.save(`invoice_${invoice.id}`, invoice);
  }

  async get(id: string): Promise<Invoice | null> {
    await this.ensureLoaded();
    return this.cache.get(id) ?? null;
  }

  async update(id: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    await this.ensureLoaded();
    const invoice = this.cache.get(id);
    if (!invoice) return null;
    
    Object.assign(invoice, updates);
    await this.adapter.save(`invoice_${id}`, invoice);
    return invoice;
  }

  async list(filter?: {
    status?: PaymentStatus;
    recipientAddress?: string;
  }): Promise<Invoice[]> {
    await this.ensureLoaded();
    let invoices = Array.from(this.cache.values());
    
    if (filter?.status) {
      invoices = invoices.filter(i => i.status === filter.status);
    }
    if (filter?.recipientAddress) {
      invoices = invoices.filter(i => i.recipient.toString() === filter.recipientAddress);
    }
    
    return invoices;
  }

  async getPending(): Promise<Invoice[]> {
    return this.list({ status: PaymentStatus.PENDING });
  }

  async getReceived(): Promise<Invoice[]> {
    return this.list({ status: PaymentStatus.RECEIVED });
  }
}

/**
 * Subscription Store with persistence
 */
export class SubscriptionStore {
  private adapter: StorageAdapter;
  private cache: Map<string, Subscription> = new Map();
  private loaded = false;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const keys = await this.adapter.list('subscription_');
    for (const key of keys) {
      const sub = await this.adapter.load<Subscription>(key);
      if (sub) {
        this.cache.set(sub.id, sub);
      }
    }
    this.loaded = true;
  }

  async create(subscription: Subscription): Promise<void> {
    await this.ensureLoaded();
    this.cache.set(subscription.id, subscription);
    await this.adapter.save(`subscription_${subscription.id}`, subscription);
  }

  async get(id: string): Promise<Subscription | null> {
    await this.ensureLoaded();
    return this.cache.get(id) ?? null;
  }

  async update(id: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    await this.ensureLoaded();
    const sub = this.cache.get(id);
    if (!sub) return null;
    
    Object.assign(sub, updates);
    await this.adapter.save(`subscription_${id}`, sub);
    return sub;
  }

  async list(): Promise<Subscription[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  async getActive(): Promise<Subscription[]> {
    const all = await this.list();
    return all.filter(s => s.status === 'active');
  }

  async getDue(): Promise<Subscription[]> {
    const now = new Date();
    const active = await this.getActive();
    return active.filter(s => s.nextBillingAt <= now);
  }
}

/**
 * Settlement History Store
 */
export class SettlementStore {
  private adapter: StorageAdapter;
  private cache: BatchSettlement[] = [];
  private loaded = false;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const data = await this.adapter.load<BatchSettlement[]>('settlements');
    if (data) {
      this.cache = data;
    }
    this.loaded = true;
  }

  async add(settlement: BatchSettlement): Promise<void> {
    await this.ensureLoaded();
    this.cache.push(settlement);
    await this.adapter.save('settlements', this.cache);
  }

  async list(limit?: number): Promise<BatchSettlement[]> {
    await this.ensureLoaded();
    const sorted = [...this.cache].sort((a, b) => 
      (b.settledAt?.getTime() ?? 0) - (a.settledAt?.getTime() ?? 0)
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getTotal(): Promise<{ count: number; amount: number }> {
    await this.ensureLoaded();
    return {
      count: this.cache.length,
      amount: this.cache.reduce((sum, s) => sum + s.totalAmount, 0),
    };
  }
}

/**
 * Create persistence stores with file storage
 */
export function createPersistence(dataDir: string = './.agentfund-data'): {
  invoices: InvoiceStore;
  subscriptions: SubscriptionStore;
  settlements: SettlementStore;
} {
  const adapter = new FileStorageAdapter(dataDir);
  return {
    invoices: new InvoiceStore(adapter),
    subscriptions: new SubscriptionStore(adapter),
    settlements: new SettlementStore(adapter),
  };
}

/**
 * Create in-memory persistence (for testing)
 */
export function createMemoryPersistence(): {
  invoices: InvoiceStore;
  subscriptions: SubscriptionStore;
  settlements: SettlementStore;
} {
  const adapter = new MemoryStorageAdapter();
  return {
    invoices: new InvoiceStore(adapter),
    subscriptions: new SubscriptionStore(adapter),
    settlements: new SettlementStore(adapter),
  };
}

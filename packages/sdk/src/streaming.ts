/**
 * Streaming Payments Module
 * 
 * Real-time payment streams for continuous agent services.
 * Useful for long-running tasks, API subscriptions, or compute time.
 */

import { PublicKey, Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID, DEVNET_RPC } from './constants';

/**
 * Stream status
 */
export type StreamStatus = 'active' | 'paused' | 'cancelled' | 'completed' | 'drained';

/**
 * Payment stream configuration
 */
export interface StreamConfig {
  /** Recipient of the stream */
  recipient: PublicKey;
  /** Total amount to stream in lamports */
  totalAmount: bigint;
  /** Duration in seconds */
  durationSeconds: number;
  /** Optional start delay in seconds */
  startDelay?: number;
  /** Whether stream can be paused */
  pausable?: boolean;
  /** Whether stream can be cancelled with refund */
  cancellable?: boolean;
  /** Minimum withdrawal amount in lamports */
  minWithdrawal?: bigint;
}

/**
 * Active payment stream
 */
export interface PaymentStream {
  /** Unique stream ID */
  id: string;
  /** Stream PDA */
  address: PublicKey;
  /** Sender (funder) */
  sender: PublicKey;
  /** Recipient */
  recipient: PublicKey;
  /** Total deposited amount */
  totalAmount: bigint;
  /** Amount already withdrawn */
  withdrawnAmount: bigint;
  /** Stream start timestamp */
  startTime: Date;
  /** Stream end timestamp */
  endTime: Date;
  /** Current status */
  status: StreamStatus;
  /** Rate in lamports per second */
  ratePerSecond: bigint;
  /** Last withdrawal timestamp */
  lastWithdrawalTime?: Date;
  /** Whether paused */
  isPaused: boolean;
  /** Pause timestamp if paused */
  pausedAt?: Date;
}

/**
 * Stream event types
 */
export type StreamEventType = 
  | 'created'
  | 'funded'
  | 'withdrawn'
  | 'paused'
  | 'resumed'
  | 'cancelled'
  | 'completed';

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  streamId: string;
  timestamp: Date;
  amount?: bigint;
  data?: Record<string, unknown>;
}

/**
 * Streaming Payments Manager
 */
export class StreamingPayments {
  private connection: Connection;
  private programId: PublicKey;
  private streams: Map<string, PaymentStream> = new Map();
  private eventListeners: Map<string, ((event: StreamEvent) => void)[]> = new Map();

  constructor(
    connection?: Connection,
    programId: PublicKey = PROGRAM_ID
  ) {
    this.connection = connection || new Connection(DEVNET_RPC, 'confirmed');
    this.programId = programId;
  }

  /**
   * Derive stream PDA
   */
  getStreamPDA(streamId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('stream'), streamId],
      this.programId
    );
  }

  /**
   * Create a new payment stream
   */
  async createStream(
    sender: Keypair,
    config: StreamConfig
  ): Promise<PaymentStream> {
    // Generate stream ID
    const streamIdBuffer = Buffer.alloc(32);
    crypto.getRandomValues(streamIdBuffer);
    const streamId = streamIdBuffer.toString('hex');

    const [streamPDA] = this.getStreamPDA(streamIdBuffer);

    const startTime = new Date(Date.now() + (config.startDelay || 0) * 1000);
    const endTime = new Date(startTime.getTime() + config.durationSeconds * 1000);
    const ratePerSecond = config.totalAmount / BigInt(config.durationSeconds);

    const stream: PaymentStream = {
      id: streamId,
      address: streamPDA,
      sender: sender.publicKey,
      recipient: config.recipient,
      totalAmount: config.totalAmount,
      withdrawnAmount: BigInt(0),
      startTime,
      endTime,
      status: 'active',
      ratePerSecond,
      isPaused: false,
    };

    this.streams.set(streamId, stream);
    this.emitEvent(streamId, { type: 'created', streamId, timestamp: new Date() });

    console.log(`Stream created: ${streamId}`);
    console.log(`  Rate: ${ratePerSecond} lamports/second`);
    console.log(`  Duration: ${config.durationSeconds} seconds`);

    return stream;
  }

  /**
   * Get available balance for withdrawal
   */
  getAvailableBalance(streamId: string): bigint {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');

    if (stream.status !== 'active') return BigInt(0);
    if (stream.isPaused) return BigInt(0);

    const now = new Date();
    if (now < stream.startTime) return BigInt(0);

    // Calculate elapsed time
    const elapsedMs = Math.min(
      now.getTime() - stream.startTime.getTime(),
      stream.endTime.getTime() - stream.startTime.getTime()
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Calculate streamed amount
    const streamedAmount = stream.ratePerSecond * BigInt(elapsedSeconds);
    
    // Available = streamed - already withdrawn
    return streamedAmount - stream.withdrawnAmount;
  }

  /**
   * Withdraw available funds (recipient)
   */
  async withdraw(
    recipient: Keypair,
    streamId: string,
    amount?: bigint
  ): Promise<{ signature: string; amount: bigint }> {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');

    if (recipient.publicKey.toString() !== stream.recipient.toString()) {
      throw new Error('Unauthorized: only recipient can withdraw');
    }

    const available = this.getAvailableBalance(streamId);
    const withdrawAmount = amount ? (amount > available ? available : amount) : available;

    if (withdrawAmount <= 0) {
      throw new Error('No funds available for withdrawal');
    }

    // Update stream
    stream.withdrawnAmount += withdrawAmount;
    stream.lastWithdrawalTime = new Date();

    // Check if stream is complete
    if (stream.withdrawnAmount >= stream.totalAmount) {
      stream.status = 'completed';
    }

    this.emitEvent(streamId, {
      type: 'withdrawn',
      streamId,
      timestamp: new Date(),
      amount: withdrawAmount,
    });

    console.log(`Withdrawn ${withdrawAmount} lamports from stream ${streamId}`);

    return {
      signature: 'simulated_tx_' + Date.now(),
      amount: withdrawAmount,
    };
  }

  /**
   * Pause a stream (sender only)
   */
  async pauseStream(sender: Keypair, streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');

    if (sender.publicKey.toString() !== stream.sender.toString()) {
      throw new Error('Unauthorized: only sender can pause');
    }

    if (stream.isPaused) throw new Error('Stream already paused');

    stream.isPaused = true;
    stream.pausedAt = new Date();
    stream.status = 'paused';

    this.emitEvent(streamId, { type: 'paused', streamId, timestamp: new Date() });
    console.log(`Stream ${streamId} paused`);
  }

  /**
   * Resume a paused stream
   */
  async resumeStream(sender: Keypair, streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');

    if (sender.publicKey.toString() !== stream.sender.toString()) {
      throw new Error('Unauthorized: only sender can resume');
    }

    if (!stream.isPaused) throw new Error('Stream is not paused');

    // Adjust end time by pause duration
    const pauseDuration = Date.now() - (stream.pausedAt?.getTime() || Date.now());
    stream.endTime = new Date(stream.endTime.getTime() + pauseDuration);

    stream.isPaused = false;
    stream.pausedAt = undefined;
    stream.status = 'active';

    this.emitEvent(streamId, { type: 'resumed', streamId, timestamp: new Date() });
    console.log(`Stream ${streamId} resumed`);
  }

  /**
   * Cancel a stream and refund remaining funds
   */
  async cancelStream(
    sender: Keypair,
    streamId: string
  ): Promise<{ refundAmount: bigint }> {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');

    if (sender.publicKey.toString() !== stream.sender.toString()) {
      throw new Error('Unauthorized: only sender can cancel');
    }

    if (stream.status === 'cancelled' || stream.status === 'completed') {
      throw new Error('Stream already terminated');
    }

    // Calculate refund
    const available = this.getAvailableBalance(streamId);
    const refundAmount = stream.totalAmount - stream.withdrawnAmount - available;

    stream.status = 'cancelled';

    this.emitEvent(streamId, {
      type: 'cancelled',
      streamId,
      timestamp: new Date(),
      data: { refundAmount },
    });

    console.log(`Stream ${streamId} cancelled, refund: ${refundAmount} lamports`);

    return { refundAmount };
  }

  /**
   * Get stream by ID
   */
  getStream(streamId: string): PaymentStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Get all streams for an address
   */
  getStreamsFor(address: PublicKey): PaymentStream[] {
    return Array.from(this.streams.values()).filter(
      s => s.sender.equals(address) || s.recipient.equals(address)
    );
  }

  /**
   * Subscribe to stream events
   */
  onEvent(streamId: string, callback: (event: StreamEvent) => void): void {
    const listeners = this.eventListeners.get(streamId) || [];
    listeners.push(callback);
    this.eventListeners.set(streamId, listeners);
  }

  /**
   * Emit stream event
   */
  private emitEvent(streamId: string, event: StreamEvent): void {
    const listeners = this.eventListeners.get(streamId) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Estimate total cost for a stream
   */
  estimateCost(config: Omit<StreamConfig, 'recipient'>): {
    totalAmount: bigint;
    ratePerSecond: bigint;
    ratePerMinute: bigint;
    ratePerHour: bigint;
    ratePerDay: bigint;
  } {
    const ratePerSecond = config.totalAmount / BigInt(config.durationSeconds);
    return {
      totalAmount: config.totalAmount,
      ratePerSecond,
      ratePerMinute: ratePerSecond * BigInt(60),
      ratePerHour: ratePerSecond * BigInt(3600),
      ratePerDay: ratePerSecond * BigInt(86400),
    };
  }
}

/**
 * Create a streaming payments manager
 */
export function createStreamingPayments(connection?: Connection): StreamingPayments {
  return new StreamingPayments(connection);
}

/**
 * Predefined stream durations
 */
export const STREAM_DURATIONS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000, // 30 days
} as const;

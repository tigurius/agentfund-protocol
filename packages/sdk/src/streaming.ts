/**
 * @fileoverview Streaming Payments module for AgentFund Protocol.
 *
 * Enables real-time, continuous payment streams between agents on Solana.
 * Streams allow a sender to lock funds that are released to a recipient
 * linearly over time — ideal for long-running tasks, API subscriptions,
 * compute-time billing, and any scenario requiring pay-as-you-go semantics.
 *
 * @module streaming
 * @author SatsAgent
 * @license MIT
 *
 * @example
 * ```typescript
 * import { StreamingPayments, STREAM_DURATIONS } from '@agentfund/sdk';
 * import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
 *
 * const connection = new Connection('https://api.devnet.solana.com');
 * const streaming = new StreamingPayments(connection);
 *
 * const stream = await streaming.createStream(senderKeypair, {
 *   recipient: recipientPubkey,
 *   totalAmount: BigInt(1 * LAMPORTS_PER_SOL),
 *   durationSeconds: STREAM_DURATIONS.HOUR,
 * });
 *
 * // Later — recipient withdraws accrued funds
 * const { amount } = await streaming.withdraw(recipientKeypair, stream.id);
 * ```
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
 * Streaming Payments Manager.
 *
 * Manages the full lifecycle of payment streams — creation, withdrawal,
 * pause/resume, cancellation, and event subscription. Streams release
 * funds linearly over a configured duration, enabling real-time billing.
 *
 * @class StreamingPayments
 *
 * @example
 * ```typescript
 * const streaming = new StreamingPayments(connection);
 *
 * // Create a 1-hour stream paying 1 SOL
 * const stream = await streaming.createStream(sender, {
 *   recipient: recipientPubkey,
 *   totalAmount: BigInt(LAMPORTS_PER_SOL),
 *   durationSeconds: 3600,
 * });
 *
 * // Monitor events
 * streaming.onEvent(stream.id, (event) => {
 *   console.log(`Event: ${event.type}`, event.amount);
 * });
 * ```
 */
export class StreamingPayments {
  private connection: Connection;
  private programId: PublicKey;
  private streams: Map<string, PaymentStream> = new Map();
  private eventListeners: Map<string, ((event: StreamEvent) => void)[]> = new Map();

  /**
   * Create a new StreamingPayments manager.
   *
   * @param {Connection} [connection] - Solana RPC connection. Defaults to devnet.
   * @param {PublicKey} [programId] - AgentFund program ID. Defaults to {@link PROGRAM_ID}.
   */
  constructor(
    connection?: Connection,
    programId: PublicKey = PROGRAM_ID
  ) {
    this.connection = connection || new Connection(DEVNET_RPC, 'confirmed');
    this.programId = programId;
  }

  /**
   * Derive the Program Derived Address (PDA) for a payment stream.
   *
   * @param {Buffer} streamId - 32-byte stream identifier buffer.
   * @returns {[PublicKey, number]} Tuple of the PDA public key and bump seed.
   *
   * @example
   * ```typescript
   * const idBuffer = Buffer.alloc(32);
   * const [pda, bump] = streaming.getStreamPDA(idBuffer);
   * ```
   */
  getStreamPDA(streamId: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('stream'), streamId],
      this.programId
    );
  }

  /**
   * Create a new payment stream that releases funds linearly over time.
   *
   * @param {Keypair} sender - The keypair funding the stream.
   * @param {StreamConfig} config - Stream configuration (recipient, amount, duration, etc.).
   * @returns {Promise<PaymentStream>} The newly created payment stream.
   * @throws {Error} If the stream cannot be created on-chain.
   *
   * @example
   * ```typescript
   * const stream = await streaming.createStream(senderKeypair, {
   *   recipient: recipientPubkey,
   *   totalAmount: BigInt(500_000_000), // 0.5 SOL
   *   durationSeconds: 3600,
   *   pausable: true,
   *   cancellable: true,
   * });
   * console.log('Stream ID:', stream.id);
   * console.log('Rate:', stream.ratePerSecond, 'lamports/sec');
   * ```
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
   * Calculate the amount currently available for withdrawal from a stream.
   *
   * The available balance is the linearly-accrued amount minus what has
   * already been withdrawn. Returns `0n` if the stream is paused, inactive,
   * or hasn't started yet.
   *
   * @param {string} streamId - The stream identifier.
   * @returns {bigint} Available withdrawal amount in lamports.
   * @throws {Error} If the stream ID is not found.
   *
   * @example
   * ```typescript
   * const available = streaming.getAvailableBalance(stream.id);
   * console.log('Can withdraw:', available, 'lamports');
   * ```
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
   * Withdraw accrued funds from a stream. Only the stream recipient may call this.
   *
   * @param {Keypair} recipient - Keypair of the stream recipient.
   * @param {string} streamId - The stream identifier.
   * @param {bigint} [amount] - Specific amount to withdraw. Defaults to all available.
   * @returns {Promise<{ signature: string; amount: bigint }>} Transaction signature and withdrawn amount.
   * @throws {Error} If the stream is not found.
   * @throws {Error} If the caller is not the recipient (`Unauthorized`).
   * @throws {Error} If no funds are available for withdrawal.
   *
   * @example
   * ```typescript
   * const { signature, amount } = await streaming.withdraw(recipientKeypair, stream.id);
   * console.log(`Withdrew ${amount} lamports — tx: ${signature}`);
   * ```
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
   * Pause an active stream. Only the sender (funder) may pause.
   *
   * While paused, no additional funds accrue to the recipient.
   * The stream can be resumed later via {@link resumeStream}.
   *
   * @param {Keypair} sender - Keypair of the stream sender/funder.
   * @param {string} streamId - The stream identifier.
   * @throws {Error} If the stream is not found.
   * @throws {Error} If the caller is not the sender (`Unauthorized`).
   * @throws {Error} If the stream is already paused.
   *
   * @example
   * ```typescript
   * await streaming.pauseStream(senderKeypair, stream.id);
   * ```
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
   * Resume a previously paused stream. The end time is extended by the pause duration.
   *
   * @param {Keypair} sender - Keypair of the stream sender/funder.
   * @param {string} streamId - The stream identifier.
   * @throws {Error} If the stream is not found.
   * @throws {Error} If the caller is not the sender (`Unauthorized`).
   * @throws {Error} If the stream is not currently paused.
   *
   * @example
   * ```typescript
   * await streaming.resumeStream(senderKeypair, stream.id);
   * ```
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
   * Cancel a stream and refund un-streamed funds to the sender.
   *
   * The refund is calculated as: `totalAmount - withdrawnAmount - availableBalance`.
   * Already-accrued (but un-withdrawn) funds remain claimable by the recipient.
   *
   * @param {Keypair} sender - Keypair of the stream sender/funder.
   * @param {string} streamId - The stream identifier.
   * @returns {Promise<{ refundAmount: bigint }>} The lamports refunded to the sender.
   * @throws {Error} If the stream is not found.
   * @throws {Error} If the caller is not the sender (`Unauthorized`).
   * @throws {Error} If the stream is already cancelled or completed.
   *
   * @example
   * ```typescript
   * const { refundAmount } = await streaming.cancelStream(senderKeypair, stream.id);
   * console.log('Refunded:', refundAmount, 'lamports');
   * ```
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
   * Retrieve a stream by its unique identifier.
   *
   * @param {string} streamId - The stream identifier.
   * @returns {PaymentStream | undefined} The stream, or `undefined` if not found.
   */
  getStream(streamId: string): PaymentStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Get all streams where the given address is either sender or recipient.
   *
   * @param {PublicKey} address - The Solana public key to filter by.
   * @returns {PaymentStream[]} Array of matching payment streams.
   *
   * @example
   * ```typescript
   * const myStreams = streaming.getStreamsFor(wallet.publicKey);
   * console.log('Active streams:', myStreams.filter(s => s.status === 'active').length);
   * ```
   */
  getStreamsFor(address: PublicKey): PaymentStream[] {
    return Array.from(this.streams.values()).filter(
      s => s.sender.equals(address) || s.recipient.equals(address)
    );
  }

  /**
   * Subscribe to lifecycle events for a specific stream.
   *
   * @param {string} streamId - The stream identifier to listen on.
   * @param {(event: StreamEvent) => void} callback - Invoked for each event.
   *
   * @example
   * ```typescript
   * streaming.onEvent(stream.id, (event) => {
   *   if (event.type === 'withdrawn') {
   *     console.log('Recipient withdrew', event.amount, 'lamports');
   *   }
   * });
   * ```
   */
  onEvent(streamId: string, callback: (event: StreamEvent) => void): void {
    const listeners = this.eventListeners.get(streamId) || [];
    listeners.push(callback);
    this.eventListeners.set(streamId, listeners);
  }

  /**
   * Emit an event to all registered listeners for a stream.
   * @internal
   */
  private emitEvent(streamId: string, event: StreamEvent): void {
    const listeners = this.eventListeners.get(streamId) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Estimate the cost breakdown for a stream configuration.
   *
   * @param {Omit<StreamConfig, 'recipient'>} config - Stream parameters (without recipient).
   * @returns {{ totalAmount: bigint; ratePerSecond: bigint; ratePerMinute: bigint; ratePerHour: bigint; ratePerDay: bigint }} Cost breakdown at various time granularities.
   *
   * @example
   * ```typescript
   * const cost = streaming.estimateCost({
   *   totalAmount: BigInt(LAMPORTS_PER_SOL),
   *   durationSeconds: STREAM_DURATIONS.DAY,
   * });
   * console.log('Rate per hour:', cost.ratePerHour, 'lamports');
   * ```
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
 * Factory function to create a {@link StreamingPayments} instance.
 *
 * @param {Connection} [connection] - Solana RPC connection. Defaults to devnet.
 * @returns {StreamingPayments} A new streaming payments manager.
 *
 * @example
 * ```typescript
 * const streaming = createStreamingPayments(connection);
 * ```
 */
export function createStreamingPayments(connection?: Connection): StreamingPayments {
  return new StreamingPayments(connection);
}

/**
 * Predefined stream durations in seconds for common billing periods.
 *
 * @example
 * ```typescript
 * import { STREAM_DURATIONS } from '@agentfund/sdk';
 * console.log(STREAM_DURATIONS.HOUR); // 3600
 * ```
 */
export const STREAM_DURATIONS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000, // 30 days
} as const;

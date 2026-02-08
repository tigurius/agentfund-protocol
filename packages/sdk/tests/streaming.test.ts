import { describe, it, expect, beforeEach } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { StreamingPayments, STREAM_DURATIONS } from '../src/streaming';

describe('StreamingPayments', () => {
  let streaming: StreamingPayments;
  let sender: Keypair;
  let recipient: Keypair;

  beforeEach(() => {
    streaming = new StreamingPayments();
    sender = Keypair.generate();
    recipient = Keypair.generate();
  });

  describe('createStream', () => {
    it('should create a stream with correct parameters', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      expect(stream).toBeDefined();
      expect(stream.id).toBeDefined();
      expect(stream.totalAmount).toBe(BigInt(LAMPORTS_PER_SOL));
      expect(stream.status).toBe('active');
      expect(stream.isPaused).toBe(false);
    });

    it('should calculate correct rate per second', async () => {
      const totalAmount = BigInt(LAMPORTS_PER_SOL);
      const durationSeconds = 1000;

      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount,
        durationSeconds,
      });

      expect(stream.ratePerSecond).toBe(totalAmount / BigInt(durationSeconds));
    });
  });

  describe('estimateCost', () => {
    it('should calculate rates correctly', () => {
      const estimate = streaming.estimateCost({
        totalAmount: BigInt(3600 * 1000), // 3,600,000 lamports
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      expect(estimate.ratePerSecond).toBe(BigInt(1000));
      expect(estimate.ratePerMinute).toBe(BigInt(60000));
      expect(estimate.ratePerHour).toBe(BigInt(3600000));
    });
  });

  describe('getAvailableBalance', () => {
    it('should return 0 for new stream', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      // Immediately after creation, available should be 0 or very small
      const available = streaming.getAvailableBalance(stream.id);
      expect(available).toBeGreaterThanOrEqual(BigInt(0));
    });

    it('should throw for non-existent stream', () => {
      expect(() => streaming.getAvailableBalance('nonexistent')).toThrow('Stream not found');
    });
  });

  describe('pauseStream', () => {
    it('should pause an active stream', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      await streaming.pauseStream(sender, stream.id);
      const pausedStream = streaming.getStream(stream.id);

      expect(pausedStream?.isPaused).toBe(true);
      expect(pausedStream?.status).toBe('paused');
    });

    it('should prevent unauthorized pause', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      const unauthorized = Keypair.generate();
      await expect(streaming.pauseStream(unauthorized, stream.id)).rejects.toThrow('Unauthorized');
    });
  });

  describe('resumeStream', () => {
    it('should resume a paused stream', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      await streaming.pauseStream(sender, stream.id);
      await streaming.resumeStream(sender, stream.id);
      const resumedStream = streaming.getStream(stream.id);

      expect(resumedStream?.isPaused).toBe(false);
      expect(resumedStream?.status).toBe('active');
    });
  });

  describe('cancelStream', () => {
    it('should cancel and calculate refund', async () => {
      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      const result = await streaming.cancelStream(sender, stream.id);
      const cancelledStream = streaming.getStream(stream.id);

      expect(cancelledStream?.status).toBe('cancelled');
      expect(result.refundAmount).toBeGreaterThanOrEqual(BigInt(0));
    });
  });

  describe('getStreamsFor', () => {
    it('should return streams for sender', async () => {
      await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      const senderStreams = streaming.getStreamsFor(sender.publicKey);
      expect(senderStreams.length).toBe(1);
    });

    it('should return streams for recipient', async () => {
      await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      const recipientStreams = streaming.getStreamsFor(recipient.publicKey);
      expect(recipientStreams.length).toBe(1);
    });
  });

  describe('onEvent', () => {
    it('should emit events on stream actions', async () => {
      const events: string[] = [];

      const stream = await streaming.createStream(sender, {
        recipient: recipient.publicKey,
        totalAmount: BigInt(LAMPORTS_PER_SOL),
        durationSeconds: STREAM_DURATIONS.HOUR,
      });

      streaming.onEvent(stream.id, (event) => {
        events.push(event.type);
      });

      await streaming.pauseStream(sender, stream.id);
      await streaming.resumeStream(sender, stream.id);

      expect(events).toContain('paused');
      expect(events).toContain('resumed');
    });
  });
});

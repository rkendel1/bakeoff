import type { RuntimeEvent } from '../../models/event.js'
import type { ExecutionStatus } from '../store/execution-record.js'
import { RetryPolicy } from '../retry/retry-policy.js'
import { DeadLetterQueue } from './dead-letter-queue.js'
import { randomUUID } from 'node:crypto'

/**
 * QueuedEvent - Represents an event in the durable queue with metadata
 * 
 * This is the core abstraction that upgrades simple events into
 * durable, trackable, retryable execution units.
 */
export type QueuedEvent = {
  id: string
  event: RuntimeEvent
  status: ExecutionStatus
  attempts: number
  lastError?: string
  createdAt: Date
  updatedAt: Date
  scheduledFor?: Date // For retry backoff
}

/**
 * DurableExecutionQueue - Durable, acknowledged, retryable execution queue
 * 
 * This queue provides execution guarantees through:
 * - Explicit lifecycle tracking (queued → processing → completed/failed)
 * - Acknowledged processing (ack/fail)
 * - Automatic retry with exponential backoff
 * - Dead letter queue for permanent failures
 * - In-memory but stateful (crash safety within process lifetime)
 * 
 * Architecture:
 * - Events are NOT removed on dequeue (only marked as processing)
 * - Events are only removed on ack() (successful completion)
 * - Failed events are retried up to maxAttempts
 * - Final failures go to Dead Letter Queue
 * 
 * This is the foundation for:
 * - Reliable execution semantics
 * - Crash safety (events persist in queue until acknowledged)
 * - Future migration to persistent queue (Redis/SQS)
 */
export class DurableExecutionQueue {
  private readonly queue: Map<string, QueuedEvent> = new Map()
  private readonly dlq: DeadLetterQueue = new DeadLetterQueue()

  /**
   * Enqueue an event for processing
   * Event starts in "queued" state
   */
  enqueue(event: RuntimeEvent): string {
    const id = randomUUID()
    const queuedEvent: QueuedEvent = {
      id,
      event,
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.queue.set(id, queuedEvent)
    return id
  }

  /**
   * Dequeue the next available event for processing
   * Returns events that are:
   * - In "queued" or "retrying" state
   * - Past their scheduled time (for retries with backoff)
   * 
   * Does NOT remove the event from queue (that happens on ack)
   */
  dequeue(): QueuedEvent | null {
    const now = new Date()

    for (const queuedEvent of this.queue.values()) {
      // Only process events that are queued or retrying
      if (queuedEvent.status !== 'queued' && queuedEvent.status !== 'retrying') {
        continue
      }

      // Check if event is scheduled for future retry
      if (queuedEvent.scheduledFor && queuedEvent.scheduledFor > now) {
        continue
      }

      return queuedEvent
    }

    return null
  }

  /**
   * Mark an event as processing
   * This happens right after dequeue, before execution
   */
  markProcessing(id: string): void {
    const queuedEvent = this.queue.get(id)
    if (!queuedEvent) {
      throw new Error(`Event not found: ${id}`)
    }

    queuedEvent.status = 'processing'
    queuedEvent.attempts += 1
    queuedEvent.updatedAt = new Date()
  }

  /**
   * Acknowledge successful execution
   * Removes the event from the queue (terminal state)
   */
  ack(id: string): void {
    const queuedEvent = this.queue.get(id)
    if (!queuedEvent) {
      console.warn('[queue] Attempted to ack non-existent event', { id })
      return
    }

    // Mark as completed and remove from queue
    queuedEvent.status = 'completed'
    queuedEvent.updatedAt = new Date()
    this.queue.delete(id)
  }

  /**
   * Mark execution as failed
   * Does NOT remove from queue yet - retry() or final failure will handle that
   */
  fail(id: string, error: Error | string): void {
    const queuedEvent = this.queue.get(id)
    if (!queuedEvent) {
      console.warn('[queue] Attempted to fail non-existent event', { id })
      return
    }

    queuedEvent.status = 'failed'
    queuedEvent.lastError = error instanceof Error ? error.message : error
    queuedEvent.updatedAt = new Date()
  }

  /**
   * Schedule a failed event for retry
   * If max attempts exceeded, sends to DLQ instead
   */
  retry(id: string): void {
    const queuedEvent = this.queue.get(id)
    if (!queuedEvent) {
      console.warn('[queue] Attempted to retry non-existent event', { id })
      return
    }

    // Check if max attempts exceeded
    if (queuedEvent.attempts >= RetryPolicy.maxAttempts) {
      // Send to DLQ and remove from queue
      this.dlq.add(
        queuedEvent.event,
        queuedEvent.lastError || 'Unknown error',
        queuedEvent.attempts
      )
      this.queue.delete(id)
      return
    }

    // Schedule for retry with backoff
    const backoffMs = RetryPolicy.backoffMs(queuedEvent.attempts)
    const scheduledFor = new Date(Date.now() + backoffMs)

    queuedEvent.status = 'retrying'
    queuedEvent.scheduledFor = scheduledFor
    queuedEvent.updatedAt = new Date()

    console.log('[queue] Event scheduled for retry', {
      id,
      attempt: queuedEvent.attempts,
      backoffMs,
      scheduledFor
    })
  }

  /**
   * Get the current queue size (all non-completed events)
   */
  size(): number {
    return this.queue.size
  }

  /**
   * Check if queue has pending events ready for processing
   */
  hasPending(): boolean {
    const now = new Date()
    
    for (const queuedEvent of this.queue.values()) {
      if (queuedEvent.status === 'queued' || queuedEvent.status === 'retrying') {
        // Check if not scheduled for future retry
        if (!queuedEvent.scheduledFor || queuedEvent.scheduledFor <= now) {
          return true
        }
      }
    }
    
    return false
  }

  /**
   * Get event by ID (useful for testing/debugging)
   */
  get(id: string): QueuedEvent | undefined {
    return this.queue.get(id)
  }

  /**
   * Get all events (useful for testing/debugging)
   */
  getAll(): QueuedEvent[] {
    return Array.from(this.queue.values())
  }

  /**
   * Get the dead letter queue
   */
  getDeadLetterQueue(): DeadLetterQueue {
    return this.dlq
  }
}

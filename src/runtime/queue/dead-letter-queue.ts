import type { RuntimeEvent } from '../../models/event.js'

/**
 * DeadLetterEvent - Represents a permanently failed execution
 * 
 * Contains:
 * - The original event that failed
 * - Error information
 * - Number of attempts made
 * - Timestamp of final failure
 */
export type DeadLetterEvent = {
  event: RuntimeEvent
  error: string
  attempts: number
  failedAt: Date
}

/**
 * DeadLetterQueue - Storage for permanently failed executions
 * 
 * Purpose:
 * - Store events that have exhausted all retry attempts
 * - Enable forensic analysis of failures
 * - Provide manual retry capability
 * - Track failure patterns
 * 
 * This is the terminal state for failed executions.
 * Events in the DLQ require manual intervention.
 */
export class DeadLetterQueue {
  private readonly queue: DeadLetterEvent[] = []

  /**
   * Add a permanently failed event to the DLQ
   */
  add(event: RuntimeEvent, error: string, attempts: number): void {
    this.queue.push({
      event,
      error,
      attempts,
      failedAt: new Date()
    })
    
    console.error('[dlq] Event sent to dead letter queue', {
      tenantId: event.tenantId,
      entityId: event.entityId,
      eventType: event.type,
      error,
      attempts
    })
  }

  /**
   * Get all events in the DLQ
   */
  getAll(): DeadLetterEvent[] {
    return [...this.queue]
  }

  /**
   * Get DLQ size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Clear the DLQ (useful for testing)
   */
  clear(): void {
    this.queue.length = 0
  }
}

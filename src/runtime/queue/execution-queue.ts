import type { RuntimeEvent } from '../../models/event.js'

/**
 * ExecutionQueue - Core abstraction for decoupling ingestion from execution
 * 
 * This queue sits between the Control Plane (API layer) and the Execution Plane (workers).
 * 
 * Previously:
 *   POST /events → engine.ingest() (synchronous)
 * 
 * Now:
 *   POST /events → queue.enqueue(event)
 *                     ↓
 *               worker.dequeue()
 *                     ↓
 *          RuntimeEngine.ingest()
 * 
 * This enables:
 * - Asynchronous processing
 * - Worker separation
 * - Execution isolation
 * - Backpressure handling
 * - Future durability layer (persistent queue)
 */
export class ExecutionQueue {
  private queue: RuntimeEvent[] = []

  /**
   * Enqueue an event for processing
   */
  enqueue(event: RuntimeEvent): void {
    this.queue.push(event)
  }

  /**
   * Dequeue the next event for processing
   * Returns undefined if queue is empty
   */
  dequeue(): RuntimeEvent | undefined {
    return this.queue.shift()
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Check if queue has pending events
   */
  hasPending(): boolean {
    return this.queue.length > 0
  }
}

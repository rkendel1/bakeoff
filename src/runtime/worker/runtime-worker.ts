import type { RuntimeEngine } from '../engine.js'
import type { DurableExecutionQueue } from '../queue/durable-execution-queue.js'

/**
 * RuntimeWorker - Execution Plane Component
 * 
 * This is the data plane executor that continuously polls the DurableExecutionQueue
 * and processes events through the RuntimeEngine with acknowledged execution semantics.
 * 
 * Responsibilities:
 * - Poll queue for new events
 * - Execute events through RuntimeEngine with ack/fail semantics
 * - Handle execution errors with retry logic
 * - Manage worker lifecycle
 * - Ensure execution guarantees (ack on success, retry on failure)
 * 
 * This separation enables:
 * - Independent scaling of control plane (API) and execution plane (workers)
 * - Worker pool management
 * - Execution isolation
 * - Resource management per worker
 * - Crash safety (events remain in queue until acknowledged)
 */
export class RuntimeWorker {
  private running = false
  private pollingInterval: NodeJS.Timeout | null = null
  private processing = false // Prevent concurrent batch processing

  constructor(
    private readonly queue: DurableExecutionQueue,
    private readonly engines: Map<string, RuntimeEngine>,
    private readonly pollIntervalMs: number = 100
  ) {}

  /**
   * Start the worker polling loop
   */
  start(): void {
    if (this.running) {
      console.warn('[worker] Already running')
      return
    }

    this.running = true
    console.log('[worker] Starting execution worker')

    // Start polling loop
    this.pollingInterval = setInterval(() => {
      this.processBatch()
    }, this.pollIntervalMs)
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.running) {
      return
    }

    this.running = false
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    console.log('[worker] Stopped execution worker')
  }

  /**
   * Process a batch of events from the queue
   * Implements acknowledged execution with retry semantics
   */
  private async processBatch(): Promise<void> {
    // Skip if already processing to prevent concurrent execution
    if (this.processing) {
      return
    }

    this.processing = true
    
    try {
      while (this.queue.hasPending() && this.running) {
        const job = this.queue.dequeue()
        
        if (!job) {
          break
        }

        try {
          // Mark as processing (increments attempts)
          this.queue.markProcessing(job.id)

          // Get the engine for this tenant
          const engine = this.engines.get(job.event.tenantId)
          
          if (!engine) {
            const error = `No engine found for tenant: ${job.event.tenantId}`
            console.error('[worker]', error)
            this.queue.fail(job.id, error)
            // Don't retry configuration errors - send directly to DLQ
            // This requires manual intervention to fix
            const dlq = this.queue.getDeadLetterQueue()
            dlq.add(job.event, error, job.attempts)
            this.queue.ack(job.id) // Remove from queue since it's in DLQ
            continue
          }

          // Execute the event through the runtime engine
          await engine.ingest(job.event)

          // Acknowledge successful execution
          this.queue.ack(job.id)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          console.error('[worker] Event execution failed', {
            jobId: job.id,
            event: job.event,
            attempt: job.attempts + 1,
            error: errorMessage
          })

          // Mark as failed
          this.queue.fail(job.id, errorMessage)

          // Retry if under max attempts
          this.queue.retry(job.id)
        }
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { running: boolean; queueSize: number; processing: boolean } {
    return {
      running: this.running,
      queueSize: this.queue.size(),
      processing: this.processing
    }
  }
}

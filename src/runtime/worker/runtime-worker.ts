import type { RuntimeEngine } from '../engine.js'
import type { ExecutionQueue } from '../queue/execution-queue.js'

/**
 * RuntimeWorker - Execution Plane Component
 * 
 * This is the data plane executor that continuously polls the ExecutionQueue
 * and processes events through the RuntimeEngine.
 * 
 * Responsibilities:
 * - Poll queue for new events
 * - Execute events through RuntimeEngine
 * - Handle execution errors
 * - Manage worker lifecycle
 * 
 * This separation enables:
 * - Independent scaling of control plane (API) and execution plane (workers)
 * - Worker pool management
 * - Execution isolation
 * - Resource management per worker
 */
export class RuntimeWorker {
  private running = false
  private pollingInterval: NodeJS.Timeout | null = null
  private processing = false // Prevent concurrent batch processing

  constructor(
    private readonly queue: ExecutionQueue,
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
   * Prevents concurrent execution to avoid overlapping batches
   */
  private async processBatch(): Promise<void> {
    // Skip if already processing to prevent concurrent execution
    if (this.processing) {
      return
    }

    this.processing = true
    
    try {
      while (this.queue.hasPending() && this.running) {
        const event = this.queue.dequeue()
        
        if (!event) {
          break
        }

        try {
          // Get the engine for this tenant
          const engine = this.engines.get(event.tenantId)
          
          if (!engine) {
            console.error('[worker] No engine found for tenant', { tenantId: event.tenantId })
            continue
          }

          // Execute the event through the runtime engine
          await engine.ingest(event)
        } catch (error) {
          console.error('[worker] Event execution failed', {
            event,
            error: error instanceof Error ? error.message : String(error)
          })
          // Event execution failures are already tracked in ExecutionStore
          // Worker continues processing other events
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

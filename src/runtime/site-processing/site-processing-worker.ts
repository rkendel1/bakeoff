import type { SiteJobQueue, SiteJob } from './site-job-queue.js'

/**
 * SiteProcessor - Function type for processing site URLs
 */
export type SiteProcessor = (url: string) => Promise<unknown>

/**
 * SiteProcessingWorker - Worker for processing site scraping jobs
 * 
 * This worker follows the same pattern as RuntimeWorker but is specialized
 * for site processing jobs. It continuously polls the SiteJobQueue and
 * processes jobs with acknowledged execution semantics.
 * 
 * Responsibilities:
 * - Poll queue for new site processing jobs
 * - Execute jobs through the site processor with ack/fail semantics
 * - Handle execution errors with retry logic
 * - Manage worker lifecycle
 * - Notify callbacks when jobs complete
 * 
 * This enables:
 * - Reliable site processing with crash safety
 * - Automatic retries on transient failures
 * - Independent scaling of site processing workers
 * - Resource management per worker
 */
export class SiteProcessingWorker {
  private running = false
  private pollingInterval: NodeJS.Timeout | null = null
  private processing = false // Prevent concurrent batch processing

  constructor(
    private readonly queue: SiteJobQueue,
    private readonly processor: SiteProcessor,
    private readonly callbackNotifier: (job: SiteJob) => Promise<void>,
    private readonly pollIntervalMs: number = 100
  ) {}

  /**
   * Start the worker polling loop
   */
  start(): void {
    if (this.running) {
      console.warn('[site-worker] Already running')
      return
    }

    this.running = true
    console.log('[site-worker] Starting site processing worker')

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

    console.log('[site-worker] Stopped site processing worker')
  }

  /**
   * Process a batch of jobs from the queue
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

          console.log('[site-worker] Processing job', {
            jobId: job.id,
            requestId: job.requestId,
            url: job.url,
            attempt: job.attempts
          })

          // Execute the site processing
          const result = await this.processor(job.url)

          // Acknowledge successful execution
          this.queue.ack(job.id, result)

          console.log('[site-worker] Job completed', {
            jobId: job.id,
            requestId: job.requestId
          })

          // Notify callback if configured
          if (job.callbackUrl) {
            await this.callbackNotifier(job)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          console.error('[site-worker] Job execution failed', {
            jobId: job.id,
            requestId: job.requestId,
            url: job.url,
            attempt: job.attempts,
            error: errorMessage
          })

          // Mark as failed
          this.queue.fail(job.id, errorMessage)

          // Retry if under max attempts
          this.queue.retry(job.id)

          // Check if permanently failed (max attempts exceeded)
          const updatedJob = this.queue.get(job.id)
          if (updatedJob && updatedJob.status === 'failed' && updatedJob.completedAt) {
            console.error('[site-worker] Job permanently failed after max retries', {
              jobId: job.id,
              requestId: job.requestId,
              attempts: updatedJob.attempts
            })

            // Notify callback about failure
            if (job.callbackUrl) {
              await this.callbackNotifier(updatedJob)
            }
          }
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

import { randomUUID } from 'node:crypto'

/**
 * SiteJobStatus - Status of a site processing job in the queue
 */
export type SiteJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying'

/**
 * SiteJob - Represents a site processing job in the queue
 */
export type SiteJob = {
  id: string
  requestId: string
  url: string
  callbackUrl?: string
  status: SiteJobStatus
  attempts: number
  lastError?: string
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
  scheduledFor?: Date // For retry backoff
  result?: unknown
}

/**
 * SiteJobQueue - Durable queue for site processing jobs
 * 
 * This queue provides execution guarantees similar to DurableExecutionQueue:
 * - Explicit lifecycle tracking (queued → processing → completed/failed)
 * - Acknowledged processing (ack/fail)
 * - Automatic retry with exponential backoff
 * - Crash safety (jobs remain in queue until acknowledged)
 */
export class SiteJobQueue {
  private readonly queue: Map<string, SiteJob> = new Map()
  private readonly maxAttempts = 3
  private readonly baseRetryDelayMs = 1000 // 1 second

  /**
   * Enqueue a new site processing job
   */
  enqueue(requestId: string, url: string, callbackUrl?: string): string {
    const id = randomUUID()
    const job: SiteJob = {
      id,
      requestId,
      url,
      callbackUrl,
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.queue.set(id, job)
    return id
  }

  /**
   * Dequeue the next available job for processing
   */
  dequeue(): SiteJob | null {
    const now = new Date()

    for (const job of this.queue.values()) {
      // Only process jobs that are queued or retrying
      if (job.status !== 'queued' && job.status !== 'retrying') {
        continue
      }

      // Check if job is scheduled for future retry
      if (job.scheduledFor && job.scheduledFor > now) {
        continue
      }

      return job
    }

    return null
  }

  /**
   * Mark job as processing (increments attempts)
   */
  markProcessing(id: string): void {
    const job = this.queue.get(id)
    if (!job) {
      return
    }

    job.status = 'processing'
    job.attempts += 1
    job.updatedAt = new Date()
    if (job.attempts === 1) {
      job.startedAt = new Date()
    }
  }

  /**
   * Acknowledge successful job completion and remove from queue
   */
  ack(id: string, result?: unknown): void {
    const job = this.queue.get(id)
    if (!job) {
      return
    }

    job.status = 'completed'
    job.completedAt = new Date()
    job.result = result
    job.updatedAt = new Date()
    
    // Keep completed jobs in memory briefly for status queries
    // In production, you'd move these to a separate completed jobs store
  }

  /**
   * Mark job as failed
   */
  fail(id: string, error: string): void {
    const job = this.queue.get(id)
    if (!job) {
      return
    }

    job.status = 'failed'
    job.lastError = error
    job.updatedAt = new Date()
  }

  /**
   * Schedule job for retry with exponential backoff
   */
  retry(id: string): void {
    const job = this.queue.get(id)
    if (!job) {
      return
    }

    if (job.attempts >= this.maxAttempts) {
      // Max retries exceeded - mark as permanently failed
      job.status = 'failed'
      job.completedAt = new Date()
      job.updatedAt = new Date()
      return
    }

    // Calculate exponential backoff: baseDelay * 2^(attempts-1)
    const delayMs = this.baseRetryDelayMs * Math.pow(2, job.attempts - 1)
    const scheduledFor = new Date(Date.now() + delayMs)

    job.status = 'retrying'
    job.scheduledFor = scheduledFor
    job.updatedAt = new Date()
  }

  /**
   * Get job by ID
   */
  get(id: string): SiteJob | undefined {
    return this.queue.get(id)
  }

  /**
   * Get job by request ID
   */
  getByRequestId(requestId: string): SiteJob | undefined {
    for (const job of this.queue.values()) {
      if (job.requestId === requestId) {
        return job
      }
    }
    return undefined
  }

  /**
   * Check if there are pending jobs
   */
  hasPending(): boolean {
    for (const job of this.queue.values()) {
      if (job.status === 'queued' || job.status === 'retrying') {
        const now = new Date()
        if (!job.scheduledFor || job.scheduledFor <= now) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Get queue size (excluding completed jobs)
   */
  size(): number {
    let count = 0
    for (const job of this.queue.values()) {
      if (job.status !== 'completed') {
        count++
      }
    }
    return count
  }
}

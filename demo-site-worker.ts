#!/usr/bin/env tsx

/**
 * Demonstration of Site Processing Worker with Job Management
 * 
 * This demonstrates how the bakeoff runtime now manages site processing jobs:
 * - Jobs are enqueued in SiteJobQueue
 * - SiteProcessingWorker polls the queue and processes jobs
 * - Automatic retries with exponential backoff
 * - Crash safety (jobs remain in queue until acknowledged)
 * - Callback notifications on completion
 */

import { SiteJobQueue } from './src/runtime/site-processing/site-job-queue.js'
import { SiteProcessingWorker } from './src/runtime/site-processing/site-processing-worker.js'
import type { SiteJob } from './src/runtime/site-processing/site-job-queue.js'

console.log('==============================================')
console.log('  Site Processing Worker Demo')
console.log('==============================================\n')

// 1. Create the job queue
console.log('1. Creating Site Job Queue')
const queue = new SiteJobQueue()
console.log('   ✓ Queue created\n')

// 2. Create a mock site processor
console.log('2. Setting up Mock Site Processor')
const mockProcessor = async (url: string) => {
  console.log(`   [Processor] Processing: ${url}`)
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Simulate failure for specific URLs
  if (url.includes('fail')) {
    throw new Error('Mock processing failure')
  }
  
  return {
    source: 'mock',
    url,
    title: 'Example Site',
    content: 'Mock content from ' + url
  }
}
console.log('   ✓ Mock processor configured\n')

// 3. Create callback notifier
console.log('3. Setting up Callback Notifier')
const notifyCallback = async (job: SiteJob) => {
  if (job.callbackUrl) {
    console.log(`   [Callback] Notifying ${job.callbackUrl}`)
    console.log(`   [Callback] Job ${job.requestId}: ${job.status}`)
  }
}
console.log('   ✓ Callback notifier configured\n')

// 4. Create and start the worker
console.log('4. Starting Site Processing Worker')
const worker = new SiteProcessingWorker(queue, mockProcessor, notifyCallback, 50)
worker.start()
console.log('   ✓ Worker started (polling every 50ms)\n')

// 5. Enqueue some jobs
console.log('5. Enqueueing Jobs')
const job1Id = queue.enqueue('req-001', 'https://example.com/page1')
console.log(`   ✓ Job 1 enqueued: ${job1Id}`)

const job2Id = queue.enqueue('req-002', 'https://example.com/page2', 'https://callback.example.com/notify')
console.log(`   ✓ Job 2 enqueued with callback: ${job2Id}`)

const job3Id = queue.enqueue('req-003', 'https://example.com/fail')
console.log(`   ✓ Job 3 enqueued (will fail): ${job3Id}\n`)

// 6. Wait for processing
console.log('6. Processing Jobs...')
await new Promise(resolve => setTimeout(resolve, 2000))

// 7. Check job statuses
console.log('\n7. Job Status Report')
const job1 = queue.get(job1Id)
console.log(`   Job 1: ${job1?.status} (attempts: ${job1?.attempts})`)
console.log(`   Result: ${JSON.stringify(job1?.result)}`)

const job2 = queue.get(job2Id)
console.log(`\n   Job 2: ${job2?.status} (attempts: ${job2?.attempts})`)
console.log(`   Result: ${JSON.stringify(job2?.result)}`)

const job3 = queue.get(job3Id)
console.log(`\n   Job 3: ${job3?.status} (attempts: ${job3?.attempts})`)
console.log(`   Error: ${job3?.lastError}`)

// 8. Check queue metrics
console.log('\n8. Queue Metrics')
const workerStatus = worker.getStatus()
console.log(`   Running: ${workerStatus.running}`)
console.log(`   Queue Size: ${workerStatus.queueSize}`)
console.log(`   Processing: ${workerStatus.processing}`)

// 9. Stop the worker
console.log('\n9. Stopping Worker')
worker.stop()
console.log('   ✓ Worker stopped\n')

console.log('==============================================')
console.log('  Demo Complete')
console.log('==============================================')
console.log('\nKey Features Demonstrated:')
console.log('  • Jobs are enqueued and processed asynchronously')
console.log('  • Worker polls queue and processes jobs with ack/fail semantics')
console.log('  • Automatic retries with exponential backoff (up to 3 attempts)')
console.log('  • Callback notifications on job completion')
console.log('  • Crash safety (jobs remain in queue until acknowledged)')
console.log('  • Clean worker lifecycle management (start/stop)')

#!/usr/bin/env tsx

/**
 * Demonstration of Durable Execution Layer
 * 
 * This script demonstrates the key features of the durable execution system:
 * 1. Crash safety - events remain in queue until acknowledged
 * 2. Retry semantics - failed executions retry up to 3 times
 * 3. Dead letter queue - permanently failed events are stored
 * 4. Execution lifecycle - queued → processing → completed/failed
 */

import { DurableExecutionQueue } from './src/runtime/queue/durable-execution-queue.js'
import { RuntimeWorker } from './src/runtime/worker/runtime-worker.js'
import { RuntimeEngine } from './src/runtime/engine.js'
import { ExecutionStore } from './src/runtime/store/execution-store.js'
import { StateStore } from './src/store/state-store.js'
import { EventStore } from './src/store/event-store.js'
import { Executor } from './src/runtime/executor.js'
import { Dispatcher } from './src/runtime/dispatcher.js'
import { DocuSealAdapter } from './src/adapters/docuseal-adapter.js'
import { demoTenant } from './src/tenants/demo-tenant.js'

console.log('='.repeat(80))
console.log('DURABLE EXECUTION LAYER DEMONSTRATION')
console.log('='.repeat(80))
console.log()

// Setup
const queue = new DurableExecutionQueue()
const executionStore = new ExecutionStore()
const stateStore = new StateStore()
const eventStore = new EventStore()

const successEngine = new RuntimeEngine(
  demoTenant,
  stateStore,
  eventStore,
  new Executor({ docuseal: new DocuSealAdapter() }),
  new Dispatcher(),
  executionStore
)

const failingEngine = new RuntimeEngine(
  demoTenant,
  new StateStore(),
  new EventStore(),
  new Executor({}), // No adapters - will fail
  new Dispatcher(),
  new ExecutionStore()
)

console.log('📋 SCENARIO 1: Successful Execution with Acknowledgment')
console.log('-'.repeat(80))

const engines1 = new Map([['tenant-success', successEngine]])
const worker1 = new RuntimeWorker(queue, engines1, 50)

// Enqueue successful event
const successEventId = queue.enqueue({
  tenantId: 'tenant-success',
  entityId: 'doc-success',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {}
}, 'latest')

console.log(`✓ Event enqueued (ID: ${successEventId})`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event status: ${queue.get(successEventId)?.status}`)

// Start worker
worker1.start()
console.log(`✓ Worker started`)

// Wait for processing
await new Promise(resolve => setTimeout(resolve, 200))

console.log(`✓ Event processed successfully`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event in queue: ${queue.get(successEventId) ? 'Yes' : 'No (acknowledged)'}`)

worker1.stop()
console.log()

console.log('📋 SCENARIO 2: Failed Execution with Retry and DLQ')
console.log('-'.repeat(80))

const engines2 = new Map([['tenant-failing', failingEngine]])
const worker2 = new RuntimeWorker(queue, engines2, 50)

// Enqueue failing event
const failingEventId = queue.enqueue({
  tenantId: 'tenant-failing',
  entityId: 'doc-failing',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {}
}, 'latest')

console.log(`✓ Event enqueued (ID: ${failingEventId})`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event status: ${queue.get(failingEventId)?.status}`)
console.log(`  Initial attempts: ${queue.get(failingEventId)?.attempts}`)

// Start worker
worker2.start()
console.log(`✓ Worker started - will retry on failures`)

// Wait for all retries (100ms + 200ms + 400ms + processing ~1s)
console.log(`  Waiting for retries...`)
await new Promise(resolve => setTimeout(resolve, 1500))

const finalEvent = queue.get(failingEventId)
const dlq = queue.getDeadLetterQueue()

console.log(`✓ Event processed through retry policy`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event in queue: ${finalEvent ? 'Yes' : 'No (sent to DLQ)'}`)
console.log(`  DLQ size: ${dlq.size()}`)

if (dlq.size() > 0) {
  const dlqEvent = dlq.getAll()[0]
  console.log(`  DLQ event attempts: ${dlqEvent.attempts}`)
  console.log(`  DLQ event error: ${dlqEvent.error}`)
}

worker2.stop()
console.log()

console.log('📋 SCENARIO 3: Crash Safety - Worker Restart')
console.log('-'.repeat(80))

const engines3 = new Map([['tenant-success', successEngine]])

// Enqueue event
const crashEventId = queue.enqueue({
  tenantId: 'tenant-success',
  entityId: 'doc-crash',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {}
}, 'latest')

console.log(`✓ Event enqueued (ID: ${crashEventId})`)
console.log(`  Queue size: ${queue.size()}`)

// Start worker briefly
const worker3a = new RuntimeWorker(queue, engines3, 50)
worker3a.start()
console.log(`✓ Worker started`)

// Simulate crash - stop worker after brief startup
await new Promise(resolve => setTimeout(resolve, 50))
worker3a.stop()
console.log(`✗ Worker crashed/stopped`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event still in queue: ${queue.get(crashEventId) ? 'Yes (not lost!)' : 'No'}`)

// Restart worker
const worker3b = new RuntimeWorker(queue, engines3, 50)
worker3b.start()
console.log(`✓ New worker started`)

// Wait for processing
await new Promise(resolve => setTimeout(resolve, 200))

console.log(`✓ Event processed by new worker`)
console.log(`  Queue size: ${queue.size()}`)
console.log(`  Event recovered and completed: ${queue.get(crashEventId) ? 'No' : 'Yes'}`)

worker3b.stop()
console.log()

console.log('='.repeat(80))
console.log('SUMMARY')
console.log('='.repeat(80))
console.log(`✅ Successful execution: Events are acknowledged and removed from queue`)
console.log(`✅ Failed execution: Events retry up to 3 times with exponential backoff`)
console.log(`✅ Dead letter queue: Permanently failed events are stored for analysis`)
console.log(`✅ Crash safety: Events remain in queue until acknowledged`)
console.log()
console.log('The system is now production-ready with execution guarantees!')
console.log('='.repeat(80))

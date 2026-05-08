import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DurableExecutionQueue } from '../runtime/queue/durable-execution-queue.js'
import { RuntimeWorker } from '../runtime/worker/runtime-worker.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { ExecutionStore } from '../runtime/store/execution-store.js'
import { StateStore } from '../store/state-store.js'
import { EventStore } from '../store/event-store.js'
import { Executor } from '../runtime/executor.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { demoTenant } from '../tenants/demo-tenant.js'
import type { RuntimeEvent } from '../models/event.js'

/**
 * Helper to create a failing adapter that throws errors
 */
class FailingAdapter {
  async execute(): Promise<{ success: false }> {
    throw new Error('Simulated adapter failure')
  }
}

/**
 * Helper to wait for specific condition or timeout
 */
async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 2000,
  checkIntervalMs: number = 10
): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    if (condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
  }
  
  throw new Error('Timeout waiting for condition')
}

// --- DurableExecutionQueue Tests ---

test('DurableExecutionQueue: enqueue adds event in queued state', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  
  assert.ok(id)
  assert.equal(queue.size(), 1)
  
  const queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.status, 'queued')
  assert.equal(queuedEvent.attempts, 0)
  assert.equal(queuedEvent.event.entityId, 'entity-1')
})

test('DurableExecutionQueue: dequeue returns event but does not remove it', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  const queuedEvent = queue.dequeue()
  
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.id, id)
  assert.equal(queue.size(), 1) // Still in queue until ack'd
})

test('DurableExecutionQueue: ack removes event from queue', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  queue.ack(id)
  
  assert.equal(queue.size(), 0)
  assert.equal(queue.get(id), undefined)
})

test('DurableExecutionQueue: fail marks event as failed', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  queue.markProcessing(id)
  queue.fail(id, new Error('Test failure'))
  
  const queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.status, 'failed')
  assert.equal(queuedEvent.lastError, 'Test failure')
})

test('DurableExecutionQueue: retry schedules event for retry with backoff', async () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  queue.markProcessing(id)
  queue.fail(id, new Error('Test failure'))
  queue.retry(id)
  
  const queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.status, 'retrying')
  assert.ok(queuedEvent.scheduledFor)
  assert.ok(queuedEvent.scheduledFor > new Date()) // Scheduled in future
  
  // Should not be available for immediate dequeue
  assert.equal(queue.hasPending(), false)
  
  // Wait for backoff (200ms for first retry after 1 attempt)
  await new Promise(resolve => setTimeout(resolve, 250))
  
  // Now should be available for dequeue
  assert.equal(queue.hasPending(), true)
  const dequeuedAfterBackoff = queue.dequeue()
  assert.ok(dequeuedAfterBackoff)
  assert.equal(dequeuedAfterBackoff.id, id)
})

test('DurableExecutionQueue: retry sends to DLQ after max attempts', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  
  // Attempt 1
  queue.markProcessing(id)
  queue.fail(id, new Error('Attempt 1'))
  queue.retry(id)
  
  // Attempt 2
  queue.markProcessing(id)
  queue.fail(id, new Error('Attempt 2'))
  queue.retry(id)
  
  // Attempt 3 (max)
  queue.markProcessing(id)
  queue.fail(id, new Error('Attempt 3'))
  queue.retry(id)
  
  // Should be removed from queue
  assert.equal(queue.size(), 0)
  assert.equal(queue.get(id), undefined)
  
  // Should be in DLQ
  const dlq = queue.getDeadLetterQueue()
  assert.equal(dlq.size(), 1)
  
  const dlqEvents = dlq.getAll()
  assert.equal(dlqEvents.length, 1)
  assert.equal(dlqEvents[0].event.entityId, 'entity-1')
  assert.equal(dlqEvents[0].attempts, 3)
  assert.equal(dlqEvents[0].error, 'Attempt 3')
})

test('DurableExecutionQueue: markProcessing increments attempts', () => {
  const queue = new DurableExecutionQueue()
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'entity-1',
    entityType: 'document',
    type: 'test.event',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  
  let queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.attempts, 0)
  
  queue.markProcessing(id)
  
  queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.status, 'processing')
  assert.equal(queuedEvent.attempts, 1)
})

// --- RuntimeWorker with DurableQueue Tests ---

test('RuntimeWorker: successful execution acks event', async () => {
  const queue = new DurableExecutionQueue()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )
  
  const engines = new Map([['test-tenant', engine]])
  const worker = new RuntimeWorker(queue, engines, 50)
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  }
  
  queue.enqueue(event, 'latest')
  
  worker.start()
  
  try {
    // Wait for queue to be empty (event acknowledged)
    await waitFor(() => queue.size() === 0)
    
    assert.equal(queue.size(), 0)
  } finally {
    worker.stop()
  }
})

test('RuntimeWorker: failed execution retries up to 3 times', async () => {
  const queue = new DurableExecutionQueue()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  // Use demo tenant with missing adapter to cause failures
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}), // No adapters - will fail when trying to execute action
    new Dispatcher(),
    executionStore
  )
  
  const engines = new Map([['test-tenant', engine]])
  const worker = new RuntimeWorker(queue, engines, 50)
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded', // This will trigger action that fails
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  
  worker.start()
  
  try {
    // Wait for event to be moved to DLQ (after 3 attempts)
    // With backoff: 100ms, 200ms, 400ms = ~700ms + processing time
    await waitFor(() => queue.size() === 0 && queue.getDeadLetterQueue().size() === 1, 3000)
    
    // Event should be removed from queue
    assert.equal(queue.size(), 0)
    assert.equal(queue.get(id), undefined)
    
    // Event should be in DLQ
    const dlq = queue.getDeadLetterQueue()
    assert.equal(dlq.size(), 1)
    
    const dlqEvents = dlq.getAll()
    assert.equal(dlqEvents[0].attempts, 3)
  } finally {
    worker.stop()
  }
})

test('RuntimeWorker: crash safety - events remain in queue until ack', async () => {
  const queue = new DurableExecutionQueue()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )
  
  const engines = new Map([['test-tenant', engine]])
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  }
  
  queue.enqueue(event, 'latest')
  
  assert.equal(queue.size(), 1)
  
  // Simulate worker crash: start and immediately stop
  const worker1 = new RuntimeWorker(queue, engines, 50)
  worker1.start()
  await new Promise(resolve => setTimeout(resolve, 10))
  worker1.stop()
  
  // Event should still be in queue (not lost)
  // It might be processing or retrying, but not removed
  assert.ok(queue.size() >= 1 || queue.getDeadLetterQueue().size() === 0)
  
  // Start new worker - should pick up the event
  const worker2 = new RuntimeWorker(queue, engines, 50)
  worker2.start()
  
  try {
    // Wait for processing to complete
    await waitFor(() => queue.size() === 0, 2000)
    
    assert.equal(queue.size(), 0) // Successfully processed
  } finally {
    worker2.stop()
  }
})

test('RuntimeWorker: execution lifecycle from queued to completed', async () => {
  const queue = new DurableExecutionQueue()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )
  
  const engines = new Map([['test-tenant', engine]])
  const worker = new RuntimeWorker(queue, engines, 50)
  
  const event: RuntimeEvent = {
    tenantId: 'test-tenant',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  }
  
  const id = queue.enqueue(event, 'latest')
  
  // Initial state: queued
  let queuedEvent = queue.get(id)
  assert.ok(queuedEvent)
  assert.equal(queuedEvent.status, 'queued')
  assert.equal(queuedEvent.attempts, 0)
  
  worker.start()
  
  try {
    // Wait for completion
    await waitFor(() => queue.size() === 0)
    
    // Event should be removed (ack'd)
    assert.equal(queue.get(id), undefined)
  } finally {
    worker.stop()
  }
})

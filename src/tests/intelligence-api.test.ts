import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TenantRuntimeRegistry } from '../runtime/registry/tenant-registry.js'
import { ControlPlaneServer } from '../runtime/api/server.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { ExecutionStore } from '../runtime/store/execution-store.js'
import { ExecutionQuery } from '../runtime/control-plane/execution-query.js'
import { RuntimeInspector } from '../runtime/control-plane/inspector.js'
import { StateStore } from '../store/state-store.js'
import { EventStore } from '../store/event-store.js'
import { Executor } from '../runtime/executor.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { DurableExecutionQueue } from '../runtime/queue/durable-execution-queue.js'
import { RuntimeWorker } from '../runtime/worker/runtime-worker.js'
import { demoTenant } from '../tenants/demo-tenant.js'

async function waitForQueueEmpty(
  worker: RuntimeWorker,
  timeoutMs: number = 1000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const status = worker.getStatus()
    if (status.queueSize === 0 && !status.processing) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('Timeout waiting for queue to be empty')
}

test('Intelligence API: GET /intelligence/canonical returns topology snapshot', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()

  // Register demo tenant
  registry.register('demo', demoTenant)

  // Create engine
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )

  const engines = new Map([['demo', engine]])
  const queue = new DurableExecutionQueue()
  const worker = new RuntimeWorker(queue, engines, 50)
  const executionQuery = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()

  const server = new ControlPlaneServer(
    registry,
    engines,
    executionQuery,
    inspector,
    queue,
    executionStore
  )

  await server.start(3010)
  worker.start()

  try {
    // Ingest some events to create execution history
    for (let i = 0; i < 3; i++) {
      await fetch('http://localhost:3010/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'demo',
          entityId: `doc-${i}`,
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        })
      })
    }

    // Wait for processing
    await waitForQueueEmpty(worker, 2000)

    // Query canonical intelligence
    const response = await fetch('http://localhost:3010/intelligence/canonical?tenantId=demo')
    assert.equal(response.status, 200)

    const data = await response.json()
    assert.equal(data.tenantId, 'demo')
    assert.ok(data.canonicalStates)
    assert.ok(data.canonicalTransitions)
    assert.ok(data.dominantProviders)
    assert.ok(data.stablePaths)
    assert.ok(typeof data.entropyScore === 'number')
    assert.ok(typeof data.operationalComplexity === 'number')
    assert.ok(typeof data.canonicalConfidence === 'number')
  } finally {
    worker.stop()
    await server.stop()
  }
})

test('Intelligence API: GET /intelligence/drift returns drift analysis', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()

  // Register demo tenant
  registry.register('demo', demoTenant)

  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )

  const engines = new Map([['demo', engine]])
  const queue = new DurableExecutionQueue()
  const worker = new RuntimeWorker(queue, engines, 50)
  const executionQuery = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()

  const server = new ControlPlaneServer(
    registry,
    engines,
    executionQuery,
    inspector,
    queue,
    executionStore
  )

  await server.start(3011)
  worker.start()

  try {
    // Ingest events
    await fetch('http://localhost:3011/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'demo',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      })
    })

    await waitForQueueEmpty(worker, 2000)

    // Query drift analysis
    const response = await fetch('http://localhost:3011/intelligence/drift?tenantId=demo')
    assert.equal(response.status, 200)

    const data = await response.json()
    assert.equal(data.tenantId, 'demo')
    assert.ok(typeof data.driftDetected === 'boolean')
    assert.ok(Array.isArray(data.unusedTransitions))
    assert.ok(Array.isArray(data.shadowTransitions))
    assert.ok(typeof data.entropyScore === 'number')
    assert.ok(Array.isArray(data.recommendations))
  } finally {
    worker.stop()
    await server.stop()
  }
})

test('Intelligence API: GET /intelligence/topology returns topology evolution', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()

  registry.register('demo', demoTenant)

  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({}),
    new Dispatcher(),
    executionStore
  )

  const engines = new Map([['demo', engine]])
  const queue = new DurableExecutionQueue()
  const worker = new RuntimeWorker(queue, engines, 50)
  const executionQuery = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()

  const server = new ControlPlaneServer(
    registry,
    engines,
    executionQuery,
    inspector,
    queue,
    executionStore
  )

  await server.start(3012)
  worker.start()

  try {
    // First, get canonical to create a snapshot
    await fetch('http://localhost:3012/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'demo',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      })
    })

    await waitForQueueEmpty(worker, 2000)

    // Get canonical to store snapshot
    await fetch('http://localhost:3012/intelligence/canonical?tenantId=demo')

    // Query topology
    const response = await fetch('http://localhost:3012/intelligence/topology?tenantId=demo')
    assert.equal(response.status, 200)

    const data = await response.json()
    assert.equal(data.tenantId, 'demo')
    assert.ok(data.currentTopology)
    assert.ok(Array.isArray(data.snapshotHistory))
  } finally {
    worker.stop()
    await server.stop()
  }
})

test('Intelligence API: handles missing tenantId parameter', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const engines = new Map()
  const queue = new DurableExecutionQueue()
  const executionQuery = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()

  const server = new ControlPlaneServer(
    registry,
    engines,
    executionQuery,
    inspector,
    queue,
    executionStore
  )

  await server.start(3013)

  try {
    const response = await fetch('http://localhost:3013/intelligence/canonical')
    assert.equal(response.status, 400)

    const data = await response.json()
    assert.ok(data.error)
    assert.ok(data.error.includes('tenantId'))
  } finally {
    await server.stop()
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
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
import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { demoTenant } from '../tenants/demo-tenant.js'
import { DurableExecutionQueue } from '../runtime/queue/durable-execution-queue.js'
import { RuntimeWorker } from '../runtime/worker/runtime-worker.js'
import { SiteJobQueue } from '../runtime/site-processing/site-job-queue.js'
import { SiteProcessingWorker } from '../runtime/site-processing/site-processing-worker.js'

const SITE_REQUEST_TIMEOUT_MS = 2000

/**
 * Helper function to wait for the worker queue to be empty
 * Polls the worker status until queue is empty or timeout is reached
 */
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
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  
  throw new Error('Timeout waiting for queue to be empty')
}

async function waitForSiteRequestCompletion(
  baseUrl: string,
  requestId: string,
  timeoutMs: number = SITE_REQUEST_TIMEOUT_MS
): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${baseUrl}/site-requests/${requestId}`)
    const body = await response.json()

    if (body.status === 'completed' || body.status === 'failed') {
      return body
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error('Timed out waiting for site request completion')
}

// --- TenantRuntimeRegistry Tests ---

test('TenantRuntimeRegistry: register and retrieve tenant model', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.register('tenant-1', demoTenant)
  
  const model = registry.getModel('tenant-1')
  assert.ok(model)
  assert.equal(model.entities.length, 1)
  assert.equal(model.entities[0], 'document')
})

test('TenantRuntimeRegistry: hasTenant checks tenant existence', () => {
  const registry = new TenantRuntimeRegistry()
  
  assert.equal(registry.hasTenant('tenant-1'), false)
  
  registry.register('tenant-1', demoTenant)
  
  assert.equal(registry.hasTenant('tenant-1'), true)
})

test('TenantRuntimeRegistry: getModelVersion returns specific version', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.register('tenant-1', demoTenant)
  
  const latestModel = registry.getModelVersion('tenant-1', 'latest')
  assert.ok(latestModel)
  assert.equal(latestModel.entities[0], 'document')
})

test('TenantRuntimeRegistry: registerVersion stores versioned model', () => {
  const registry = new TenantRuntimeRegistry()
  
  const v1Model = { ...demoTenant }
  const v2Model = { ...demoTenant, states: ['draft', 'pending', 'signed', 'archived'] }
  
  registry.registerVersion('tenant-1', 'v1', v1Model)
  registry.registerVersion('tenant-1', 'v2', v2Model)
  
  const retrievedV1 = registry.getModelVersion('tenant-1', 'v1')
  const retrievedV2 = registry.getModelVersion('tenant-1', 'v2')
  
  assert.ok(retrievedV1)
  assert.equal(retrievedV1.states.length, 3)
  
  assert.ok(retrievedV2)
  assert.equal(retrievedV2.states.length, 4)
})

test('TenantRuntimeRegistry: listVersions returns all versions', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.register('tenant-1', demoTenant)
  registry.registerVersion('tenant-1', 'v1', demoTenant)
  
  const versions = registry.listVersions('tenant-1')
  assert.equal(versions.length, 2)
  assert.ok(versions.some((v) => v.version === 'latest'))
  assert.ok(versions.some((v) => v.version === 'v1'))
})

// --- ControlPlaneServer Tests ---

test('ControlPlaneServer: POST /events ingests event', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  const engines = new Map([['tenant-1', engine]])
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  
  // Create execution queue and worker
  const executionQueue = new DurableExecutionQueue()
  const worker = new RuntimeWorker(executionQueue, engines)
  const siteJobQueue = new SiteJobQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore, siteJobQueue)
  await server.start(3001)
  
  // Start worker
  worker.start()
  
  try {
    // Ingest event via API
    const response = await fetch('http://localhost:3001/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-1',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      })
    })
    
    assert.equal(response.status, 202)
    const result = await response.json()
    assert.equal(result.status, 'accepted')
    
    // Wait for async processing to complete
    // Poll worker status until queue is empty and processing is done
    await waitForQueueEmpty(worker)
    
    // Verify execution was recorded
    const executions = await executionStore.all()
    assert.ok(executions.length > 0)
    
    // Verify modelVersion is tracked
    const execution = executions[0]
    assert.ok(execution.modelVersion)
    assert.equal(execution.modelVersion, 'latest')
  } finally {
    worker.stop()
    await server.stop()
  }
})

test('ControlPlaneServer: GET /executions queries executions', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  // Ingest some events first
  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })
  
  const engines = new Map([['tenant-1', engine]])
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  
  // Create execution queue (not needed for this test, but required by server)
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore, siteJobQueue)
  await server.start(3002)
  
  try {
    // Query executions via API
    const response = await fetch(
      'http://localhost:3002/executions?tenantId=tenant-1&entityId=doc-1'
    )
    
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(result.executions)
    assert.ok(result.executions.length > 0)
    assert.equal(result.executions[0].entityId, 'doc-1')
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: GET /executions/:id inspects execution', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  // Ingest event first
  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })
  
  const executions = await executionStore.all()
  const executionId = executions[0].id
  
  const engines = new Map([['tenant-1', engine]])
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  
  // Create execution queue (not needed for this test, but required by server)
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore, siteJobQueue)
  await server.start(3003)
  
  try {
    // Inspect execution via API
    const response = await fetch(`http://localhost:3003/executions/${executionId}`)
    
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(result.inspection)
    assert.equal(result.inspection.executionId, executionId)
    assert.ok(result.inspection.summary)
    assert.ok(result.inspection.timeline)
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: POST /simulate simulates execution', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const engines = new Map()
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  
  // Create execution queue (not needed for this test, but required by server)
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore, siteJobQueue)
  await server.start(3004)
  
  try {
    // Simulate event via API
    const response = await fetch('http://localhost:3004/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-1',
        event: {
          tenantId: 'tenant-1',
          entityId: 'doc-999',
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        },
        modelVersion: 'latest',
        currentState: 'draft'
      })
    })
    
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(result.simulation)
    assert.equal(result.simulation.predictedState, 'pending_signature')
    assert.ok(result.simulation.predictedActions.includes('send_for_signature'))
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: runtime API key blocks unauthenticated requests', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  const engines = new Map([['tenant-1', engine]])
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  const server = new ControlPlaneServer(
    registry,
    engines,
    query,
    inspector,
    executionQueue,
    executionStore,
    siteJobQueue,
    'test-runtime-api-key'
  )
  await server.start(3005)
  
  try {
    const response = await fetch(
      'http://localhost:3005/executions?tenantId=tenant-1&entityId=doc-1'
    )
    
    assert.equal(response.status, 401)
    const result = await response.json()
    assert.equal(result.error, 'Unauthorized')
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: runtime API key allows authenticated requests', async () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  // Seed execution data
  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })
  
  const engines = new Map([['tenant-1', engine]])
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  const server = new ControlPlaneServer(
    registry,
    engines,
    query,
    inspector,
    executionQueue,
    executionStore,
    siteJobQueue,
    'test-runtime-api-key'
  )
  await server.start(3006)
  
  try {
    const response = await fetch(
      'http://localhost:3006/executions?tenantId=tenant-1&entityId=doc-1',
      {
        headers: {
          Authorization: 'Bearer test-runtime-api-key'
        }
      }
    )
    
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(result.executions)
    assert.ok(result.executions.length > 0)
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: POST /site-requests returns request ID and completed status', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  const server = new ControlPlaneServer(
    registry,
    new Map(),
    query,
    inspector,
    executionQueue,
    executionStore,
    siteJobQueue
  )
  
  // Create site processing worker with mock processor
  const mockProcessor = async (url: string) => ({
    source: 'mock',
    url,
    title: 'Mock Site'
  })
  const noopNotifier = async () => {}
  const siteWorker = new SiteProcessingWorker(siteJobQueue, mockProcessor, noopNotifier)
  siteWorker.start()
  
  await server.start(3007)

  try {
    const submitResponse = await fetch('http://localhost:3007/site-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com'
      })
    })

    assert.equal(submitResponse.status, 202)
    const submitted = await submitResponse.json()
    assert.ok(submitted.requestId)
    assert.ok(['queued', 'processing', 'completed'].includes(submitted.status))

    const statusBody = await waitForSiteRequestCompletion(
      'http://localhost:3007',
      submitted.requestId
    )

    assert.equal(statusBody.requestId, submitted.requestId)
    assert.equal(statusBody.status, 'completed')
    assert.equal(statusBody.result.source, 'mock')
    assert.equal(statusBody.result.url, 'https://example.com/')
  } finally {
    siteWorker.stop()
    await server.stop()
  }
})

test('ControlPlaneServer: POST /site-requests rejects invalid url', async () => {
  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  const server = new ControlPlaneServer(
    registry,
    new Map(),
    query,
    inspector,
    executionQueue,
    executionStore,
    siteJobQueue
  )
  await server.start(3008)

  try {
    const response = await fetch('http://localhost:3008/site-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'file:///etc/passwd' })
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Invalid url. Only http/https URLs are supported')
  } finally {
    await server.stop()
  }
})

test('ControlPlaneServer: site request callback is notified on completion', async () => {
  const callbackPayloadPromise = new Promise<any>((resolve) => {
    const callbackServer = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/callback') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          res.writeHead(204)
          res.end()
          resolve(JSON.parse(body))
          callbackServer.close()
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    callbackServer.listen(3010)
  })

  const registry = new TenantRuntimeRegistry()
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  const inspector = new RuntimeInspector()
  const executionQueue = new DurableExecutionQueue()
  const siteJobQueue = new SiteJobQueue()
  const server = new ControlPlaneServer(
    registry,
    new Map(),
    query,
    inspector,
    executionQueue,
    executionStore,
    siteJobQueue
  )
  
  // Create site processing worker with mock processor and real callback notifier
  const mockProcessor = async (url: string) => ({ url, source: 'callback-mock' })
  const callbackNotifier = async (job: any) => {
    if (!job.callbackUrl) return
    try {
      await fetch(job.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: job.requestId,
          url: job.url,
          status: job.status,
          submittedAt: job.createdAt.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          result: job.result,
          error: job.lastError
        })
      })
    } catch (error) {
      console.warn('Callback notification failed', error)
    }
  }
  const siteWorker = new SiteProcessingWorker(siteJobQueue, mockProcessor, callbackNotifier)
  siteWorker.start()
  
  await server.start(3009)

  try {
    const submitResponse = await fetch('http://localhost:3009/site-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        callbackUrl: 'http://localhost:3010/callback'
      })
    })

    assert.equal(submitResponse.status, 202)
    const submitted = await submitResponse.json()
    const callbackPayload = await Promise.race([
      callbackPayloadPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('callback timeout')), SITE_REQUEST_TIMEOUT_MS))
    ])

    assert.equal(callbackPayload.requestId, submitted.requestId)
    assert.equal(callbackPayload.status, 'completed')
    assert.equal(callbackPayload.result.source, 'callback-mock')
  } finally {
    siteWorker.stop()
    await server.stop()
  }
})

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
import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { demoTenant } from '../tenants/demo-tenant.js'
import { ExecutionQueue } from '../runtime/queue/execution-queue.js'
import { RuntimeWorker } from '../runtime/worker/runtime-worker.js'

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
  const executionQueue = new ExecutionQueue()
  const worker = new RuntimeWorker(executionQueue, engines)
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue)
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
    
    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 100))
    
    // Verify execution was recorded
    const executions = await executionStore.all()
    assert.ok(executions.length > 0)
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
  const executionQueue = new ExecutionQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue)
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
  const executionQueue = new ExecutionQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue)
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
  const executionQueue = new ExecutionQueue()
  
  const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue)
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

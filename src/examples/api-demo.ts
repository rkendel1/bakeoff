/**
 * Control Plane API Demo
 * 
 * This demonstrates the new Runtime Control Plane API Layer:
 * - TenantRuntimeRegistry: Centralized tenant model management
 * - ControlPlaneServer: HTTP API for event ingestion, execution querying, and simulation
 * - DurableExecutionQueue: Decouples control plane from execution plane with durability guarantees
 * - RuntimeWorker: Execution plane that processes events from queue with ack semantics
 * 
 * This is the bridge between engine internals → platform
 * 
 * Architecture:
 * POST /events → DurableExecutionQueue.enqueue() → RuntimeWorker.dequeue() → RuntimeEngine.ingest() → Queue.ack()
 */

import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { Executor } from '../runtime/executor.js'
import { EventStore } from '../store/event-store.js'
import { StateStore } from '../store/state-store.js'
import { demoTenant } from '../tenants/demo-tenant.js'
import { ExecutionStore } from '../runtime/store/execution-store.js'
import { ExecutionQuery } from '../runtime/control-plane/execution-query.js'
import { RuntimeInspector } from '../runtime/control-plane/inspector.js'
import { TenantRuntimeRegistry } from '../runtime/registry/tenant-registry.js'
import { ControlPlaneServer } from '../runtime/api/server.js'
import { DurableExecutionQueue } from '../runtime/queue/durable-execution-queue.js'
import { RuntimeWorker } from '../runtime/worker/runtime-worker.js'
import { SiteJobQueue } from '../runtime/site-processing/site-job-queue.js'

console.log('=== Control Plane API Demo ===\n')

// 1. Setup: Create Registry and Register Tenant
console.log('1. Setting up Tenant Registry')
const registry = new TenantRuntimeRegistry()
registry.register('demo', demoTenant)
console.log('   ✓ Registered tenant: demo')
console.log('   ✓ Model version: latest\n')

// 2. Setup: Create Runtime Engine for Tenant
console.log('2. Setting up Runtime Engine')
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

const engines = new Map([['demo', engine]])
console.log('   ✓ Runtime engine initialized for tenant: demo\n')

// 3. Setup: Create Execution Queue and Worker
console.log('3. Setting up Execution Queue and Worker')
const executionQueue = new DurableExecutionQueue()
const worker = new RuntimeWorker(executionQueue, engines)
worker.start()
console.log('   ✓ Durable execution queue created')
console.log('   ✓ Runtime worker started\n')

// 4. Setup: Create Control Plane Server
console.log('4. Starting Control Plane API Server')
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()
const siteJobQueue = new SiteJobQueue()
const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore, siteJobQueue)

const PORT = 3000
await server.start(PORT)
console.log(`   ✓ API Server listening on http://localhost:${PORT}\n`)

// 5. Demo: Ingest Event via API
console.log('5. Ingesting Event via API')
console.log('   POST /events')
console.log('   → Event enqueued by Control Plane')
console.log('   → Worker picks up and processes event')
const ingestResponse = await fetch(`http://localhost:${PORT}/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'demo',
    entityId: 'doc-123',
    entityType: 'document',
    type: 'document.uploaded',
    payload: { fileName: 'contract.pdf' }
  })
})

const ingestResult = await ingestResponse.json()
console.log(`   ✓ Status: ${ingestResponse.status}`)
console.log(`   ✓ Result: ${ingestResult.status}\n`)

// Wait for async processing to complete
// The worker polls every 100ms, so we wait 200ms to ensure:
// - Initial event is processed
// - Follow-up events (signature.completed) are also processed
await new Promise((resolve) => setTimeout(resolve, 200))

// 6. Demo: Query Executions via API
console.log('6. Querying Executions via API')
console.log('   GET /executions?tenantId=demo&entityId=doc-123')
const queryResponse = await fetch(
  `http://localhost:${PORT}/executions?tenantId=demo&entityId=doc-123`
)

const queryResult = await queryResponse.json()
console.log(`   ✓ Status: ${queryResponse.status}`)
console.log(`   ✓ Executions found: ${queryResult.executions.length}`)
if (queryResult.executions.length > 0) {
  console.log(`   ✓ First execution ID: ${queryResult.executions[0].id}`)
  console.log(`   ✓ Status: ${queryResult.executions[0].status}\n`)
}

// 7. Demo: Inspect Execution via API
if (queryResult.executions.length > 0) {
  const executionId = queryResult.executions[0].id
  
  console.log('7. Inspecting Execution via API')
  console.log(`   GET /executions/${executionId}`)
  const inspectResponse = await fetch(`http://localhost:${PORT}/executions/${executionId}`)
  
  const inspectResult = await inspectResponse.json()
  console.log(`   ✓ Status: ${inspectResponse.status}`)
  console.log('   ✓ Inspection Summary:')
  console.log(`     - Start State: ${inspectResult.inspection.summary.startState}`)
  console.log(`     - End State: ${inspectResult.inspection.summary.endState}`)
  console.log(`     - Event Chain: ${inspectResult.inspection.summary.eventChain.join(' → ')}`)
  console.log(`     - Actions Executed: ${inspectResult.inspection.summary.actionsExecuted.join(', ')}`)
  console.log(`     - Providers Touched: ${inspectResult.inspection.summary.providersTouched.join(', ')}\n`)
}

// 8. Demo: Simulate Event via API
console.log('8. Simulating Event via API')
console.log('   POST /simulate')
const simulateResponse = await fetch(`http://localhost:${PORT}/simulate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'demo',
    event: {
      tenantId: 'demo',
      entityId: 'doc-999',
      entityType: 'document',
      type: 'document.uploaded',
      payload: {}
    },
    modelVersion: 'latest',
    currentState: 'draft'
  })
})

const simulateResult = await simulateResponse.json()
console.log(`   ✓ Status: ${simulateResponse.status}`)
console.log('   ✓ Simulation Results:')
console.log(`     - Predicted State: ${simulateResult.simulation.predictedState}`)
console.log(`     - Predicted Actions: ${simulateResult.simulation.predictedActions.join(', ')}`)
console.log(`     - Emitted Events: ${simulateResult.simulation.sideEffects.emittedEvents.map((e: any) => e.type).join(', ')}\n`)

// Cleanup
console.log('9. Shutting down')
worker.stop()
console.log('   ✓ Worker stopped')
await server.stop()
console.log('   ✓ Server stopped\n')

console.log('=== Control Plane API Demo Complete ===')
console.log('\n🎯 Key Takeaways:')
console.log('   ✓ TenantRuntimeRegistry: Centralized tenant model management with versioning')
console.log('   ✓ ExecutionQueue: Decouples control plane from execution plane')
console.log('   ✓ RuntimeWorker: Execution plane that processes events asynchronously')
console.log('   ✓ POST /events: External event ingestion endpoint (enqueues for async processing)')
console.log('   ✓ GET /executions: Query executions with filters (tenant, entity, status)')
console.log('   ✓ GET /executions/:id: Inspect execution details with RuntimeInspector')
console.log('   ✓ POST /simulate: Simulate model changes before applying them')
console.log('\n🚀 The runtime is now a true control plane/execution plane architecture!')
console.log('   - Control Plane: API layer for ingestion and querying')
console.log('   - Execution Plane: Worker processes events from queue')
console.log('   - Ready for scaling, worker pools, and OperNext integration!')

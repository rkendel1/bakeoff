/**
 * Control Plane API Demo
 * 
 * This demonstrates the new Runtime Control Plane API Layer:
 * - TenantRuntimeRegistry: Centralized tenant model management
 * - ControlPlaneServer: HTTP API for event ingestion, execution querying, and simulation
 * 
 * This is the bridge between engine internals → platform
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

// 3. Setup: Create Control Plane Server
console.log('3. Starting Control Plane API Server')
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()
const server = new ControlPlaneServer(registry, engines, query, inspector)

const PORT = 3000
await server.start(PORT)
console.log(`   ✓ API Server listening on http://localhost:${PORT}\n`)

// 4. Demo: Ingest Event via API
console.log('4. Ingesting Event via API')
console.log('   POST /events')
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

// Wait for processing
await new Promise((resolve) => setTimeout(resolve, 100))

// 5. Demo: Query Executions via API
console.log('5. Querying Executions via API')
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

// 6. Demo: Inspect Execution via API
if (queryResult.executions.length > 0) {
  const executionId = queryResult.executions[0].id
  
  console.log('6. Inspecting Execution via API')
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

// 7. Demo: Simulate Event via API
console.log('7. Simulating Event via API')
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
console.log('8. Shutting down server')
await server.stop()
console.log('   ✓ Server stopped\n')

console.log('=== Control Plane API Demo Complete ===')
console.log('\n🎯 Key Takeaways:')
console.log('   ✓ TenantRuntimeRegistry: Centralized tenant model management with versioning')
console.log('   ✓ POST /events: External event ingestion endpoint')
console.log('   ✓ GET /executions: Query executions with filters (tenant, entity, status)')
console.log('   ✓ GET /executions/:id: Inspect execution details with RuntimeInspector')
console.log('   ✓ POST /simulate: Simulate model changes before applying them')
console.log('\n🚀 The runtime is now a platform service - ready for OperNext integration!')

/**
 * Control Plane Demo
 * 
 * This demonstrates the new Execution Control Plane + Inspection Layer:
 * - ExecutionQuery: Query and retrieve executions
 * - RuntimeInspector: Inspect execution results
 * - ReplayEngine: Replay executions safely
 * - SimulationEngine: Simulate model changes
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
import { replayExecution } from '../runtime/replay/replay-engine.js'
import { simulate } from '../runtime/simulate/simulation-engine.js'

console.log('=== Control Plane Demo ===\n')

// Setup runtime
const stateStore = new StateStore()
const eventStore = new EventStore()
const executionStore = new ExecutionStore()

const engine = new RuntimeEngine(
  demoTenant,
  stateStore,
  eventStore,
  new Executor({
    docuseal: new DocuSealAdapter()
  }),
  new Dispatcher(),
  executionStore
)

// Execute some events
console.log('1. Executing events...')
await engine.ingest({
  tenantId: 'demo',
  entityId: 'doc-123',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {
    fileName: 'contract.pdf'
  }
})

console.log('   ✓ Events executed\n')

// Query executions
console.log('2. Query API Demo')
const query = new ExecutionQuery(executionStore)

const allExecutions = await executionStore.all()
console.log(`   Found ${allExecutions.length} executions`)

const byEntity = await query.getByEntity('demo', 'doc-123')
console.log(`   Executions for doc-123: ${byEntity.length}`)

const timeline = await query.getTimeline(allExecutions[0].id)
console.log(`   Timeline stages: ${timeline.map((t) => t.stage).join(' → ')}\n`)

// Inspect executions
console.log('3. Inspector Demo')
const inspector = new RuntimeInspector()

const inspection = inspector.inspect(allExecutions[0])
console.log('   Inspection Summary:')
console.log(`   - Start State: ${inspection.summary.startState}`)
console.log(`   - End State: ${inspection.summary.endState}`)
console.log(`   - Event Chain: ${inspection.summary.eventChain.join(' → ')}`)
console.log(`   - Actions Executed: ${inspection.summary.actionsExecuted.join(', ')}`)
console.log(`   - Providers Touched: ${inspection.summary.providersTouched.join(', ')}`)
console.log(`   - State Changes: ${inspection.stateChanges.length}`)
console.log(`   - Timeline Entries: ${inspection.timeline.length}\n`)

// Replay execution
console.log('4. Replay Demo')
console.log('   Replaying execution (no external providers hit)...')
const replayed = await replayExecution(allExecutions[0])
console.log(`   ✓ Replayed with ${replayed.trace.length} stages`)
console.log(`   ✓ Replay mode confirmed: ${replayed.trace.some((t) => t.metadata?.mode === 'replay')}\n`)

// Simulate model changes
console.log('5. Simulation Demo')
console.log('   Simulating document.uploaded event...')
const simulation = await simulate(
  {
    tenantId: 'demo',
    entityId: 'doc-999',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  },
  demoTenant,
  'draft'
)

console.log('   Simulation Results:')
console.log(`   - Predicted State: ${simulation.predictedState}`)
console.log(`   - Predicted Actions: ${simulation.predictedActions.join(', ')}`)
console.log(`   - Emitted Events: ${simulation.sideEffects.emittedEvents.map((e) => e.type).join(', ')}`)
console.log(`   - Simulation mode confirmed: ${simulation.executionTrace.some((t) => t.metadata?.mode === 'simulation')}\n`)

console.log('=== Control Plane Demo Complete ===')
console.log('\n🎯 Key Takeaways:')
console.log('   ✓ ExecutionQuery: Query and retrieve executions by ID, entity, state, or status')
console.log('   ✓ RuntimeInspector: Transform raw executions into readable insights')
console.log('   ✓ ReplayEngine: Safely replay executions without external side effects')
console.log('   ✓ SimulationEngine: Predict outcomes of model changes before applying them')
console.log('\nYour runtime is now observable, queryable, and simulatable! 🚀')

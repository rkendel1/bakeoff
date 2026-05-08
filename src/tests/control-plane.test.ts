import assert from 'node:assert/strict'
import test from 'node:test'
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
import { replayExecution, canReplay } from '../runtime/replay/replay-engine.js'
import { simulate, simulateMany } from '../runtime/simulate/simulation-engine.js'

test('ExecutionQuery: getById returns execution by ID', async () => {
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  assert.ok(executions.length > 0)
  
  const firstExecution = executions[0]
  const retrieved = await query.getById(firstExecution.id)
  
  assert.equal(retrieved?.id, firstExecution.id)
  assert.equal(retrieved?.tenantId, 'tenant-1')
})

test('ExecutionQuery: getByEntity returns executions for entity', async () => {
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await query.getByEntity('tenant-1', 'doc-1')
  assert.ok(executions.length > 0)
  assert.equal(executions[0].entityId, 'doc-1')
})

test('ExecutionQuery: getFailed returns only failed executions', async () => {
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  class FailingAdapter extends DocuSealAdapter {
    override async execute() {
      throw new Error('Adapter failed')
    }
  }
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new FailingAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await assert.rejects(async () => {
    await engine.ingest({
      tenantId: 'tenant-1',
      entityId: 'doc-1',
      entityType: 'document',
      type: 'document.uploaded',
      payload: {}
    })
  })

  const failedExecutions = await query.getFailed('tenant-1')
  assert.ok(failedExecutions.length > 0)
  assert.equal(failedExecutions[0].status, 'failed')
})

test('ExecutionQuery: getByState returns executions by state', async () => {
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const signedExecutions = await query.getByState('tenant-1', 'signed')
  assert.ok(signedExecutions.length > 0)
})

test('ExecutionQuery: getTimeline returns execution trace', async () => {
  const executionStore = new ExecutionStore()
  const query = new ExecutionQuery(executionStore)
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  const timeline = await query.getTimeline(executions[0].id)
  
  assert.ok(timeline.length > 0)
  assert.ok(timeline.some((t) => t.stage === 'ingest'))
  assert.ok(timeline.some((t) => t.stage === 'evaluate'))
})

test('RuntimeInspector: inspect returns structured execution insight', async () => {
  const executionStore = new ExecutionStore()
  const inspector = new RuntimeInspector()
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  const inspection = inspector.inspect(executions[0])
  
  assert.ok(inspection.executionId)
  assert.ok(inspection.summary)
  assert.ok(inspection.summary.eventChain.length > 0)
  assert.ok(inspection.summary.actionsExecuted.length > 0)
  assert.ok(inspection.timeline.length > 0)
  assert.equal(inspection.errors, undefined)
})

test('RuntimeInspector: inspectMany returns multiple inspections', async () => {
  const executionStore = new ExecutionStore()
  const inspector = new RuntimeInspector()
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  const inspections = inspector.inspectMany(executions)
  
  assert.ok(inspections.length > 0)
  assert.ok(inspections.every((i) => i.executionId))
})

test('replayExecution: replays execution without hitting providers', async () => {
  const executionStore = new ExecutionStore()
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  const execution = executions[0]
  
  const replayed = await replayExecution(execution)
  
  assert.ok(replayed)
  assert.ok(replayed.trace.length > 0)
  assert.ok(replayed.trace.some((t) => t.stage === 'execute' && t.metadata?.mode === 'replay'))
})

test('canReplay: returns true for completed executions', async () => {
  const executionStore = new ExecutionStore()
  
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  const executions = await executionStore.all()
  const execution = executions[0]
  
  assert.equal(canReplay(execution), true)
})

test('simulate: predicts execution outcome without side effects', async () => {
  const result = await simulate(
    {
      tenantId: 'tenant-1',
      entityId: 'doc-1',
      entityType: 'document',
      type: 'document.uploaded',
      payload: {}
    },
    demoTenant,
    'draft'
  )

  assert.ok(result.predictedState)
  assert.ok(result.predictedActions.length > 0)
  assert.ok(result.executionTrace.length > 0)
  assert.ok(result.executionTrace.some((t) => t.stage === 'execute' && t.metadata?.mode === 'simulation'))
})

test('simulateMany: predicts multiple events in sequence', async () => {
  const results = await simulateMany(
    [
      {
        tenantId: 'tenant-1',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      },
      {
        tenantId: 'tenant-1',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'signature.completed',
        payload: {}
      }
    ],
    demoTenant,
    'draft'
  )

  assert.equal(results.length, 2)
  assert.ok(results[0].predictedState)
  assert.ok(results[1].predictedState)
})

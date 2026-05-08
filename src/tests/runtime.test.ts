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

class TrackingDocuSealAdapter extends DocuSealAdapter {
  executed = 0

  override async execute(action: {
    name: string
    event: {
      tenantId: string
      entityId: string
      entityType: string
    }
  }) {
    this.executed += 1
    return super.execute(action)
  }
}

test('document.uploaded reaches signed and executes adapter', async () => {
  const trackingAdapter = new TrackingDocuSealAdapter()

  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executionStore = new ExecutionStore()

  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({
      docuseal: trackingAdapter
    }),
    new Dispatcher(),
    executionStore
  )

  await engine.ingest({
    tenantId: 'demo',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  assert.equal(stateStore.get('doc-1'), 'signed')
  assert.equal(trackingAdapter.executed, 1)
  assert.deepEqual(eventStore.history().map((event) => event.type), ['document.uploaded', 'signature.completed'])
  
  // Verify execution records
  const executions = await executionStore.all()
  assert.equal(executions.length, 2) // Two events processed
  assert.equal(executions.filter((e) => e.status === 'completed').length, 2)
})

test('execution store tracks execution records', async () => {
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

  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })

  // Verify executions by tenant
  const tenantExecutions = await executionStore.listByTenant('tenant-1')
  assert.equal(tenantExecutions.length, 2)
  
  // Verify executions by entity
  const entityExecutions = await executionStore.listByEntity('tenant-1', 'doc-1')
  assert.equal(entityExecutions.length, 2)
  
  // Verify all executions completed successfully
  const completedExecutions = await executionStore.listByStatus('completed')
  assert.equal(completedExecutions.length, 2)
  
  // Verify execution records have correct structure
  const firstExecution = tenantExecutions[0]
  assert.ok(firstExecution.id)
  assert.equal(firstExecution.tenantId, 'tenant-1')
  assert.equal(firstExecution.entityId, 'doc-1')
  assert.equal(firstExecution.status, 'completed')
  assert.ok(firstExecution.createdAt instanceof Date)
  assert.ok(firstExecution.completedAt instanceof Date)
  assert.ok(firstExecution.contextSnapshot)
})

test('execution store tracks failed executions', async () => {
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executionStore = new ExecutionStore()

  // Create an adapter that throws an error
  class FailingAdapter extends DocuSealAdapter {
    override async execute(action: {
      name: string
      event: {
        tenantId: string
        entityId: string
        entityType: string
      }
    }): Promise<never> {
      throw new Error('Execution failed')
    }
  }

  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({
      docuseal: new FailingAdapter()
    }),
    new Dispatcher(),
    executionStore
  )

  await assert.rejects(
    async () => {
      await engine.ingest({
        tenantId: 'tenant-1',
        entityId: 'doc-1',
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      })
    },
    { message: 'Execution failed' }
  )

  // Verify execution was marked as failed
  const failedExecutions = await executionStore.listByStatus('failed')
  assert.equal(failedExecutions.length, 1)
  assert.equal(failedExecutions[0].status, 'failed')
  assert.ok(failedExecutions[0].completedAt instanceof Date)
})

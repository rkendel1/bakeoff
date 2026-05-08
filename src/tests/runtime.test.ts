import assert from 'node:assert/strict'
import test from 'node:test'
import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { Executor } from '../runtime/executor.js'
import { EventStore } from '../store/event-store.js'
import { StateStore } from '../store/state-store.js'
import { demoTenant } from '../tenants/demo-tenant.js'

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

  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    new Executor({
      docuseal: trackingAdapter
    }),
    new Dispatcher()
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
})

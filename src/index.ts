import { DocuSealAdapter } from './adapters/docuseal-adapter.js'
import { MockAdapter } from './adapters/mock-adapter.js'
import { Dispatcher } from './runtime/dispatcher.js'
import { RuntimeEngine } from './runtime/engine.js'
import { Executor } from './runtime/executor.js'
import { EventStore } from './store/event-store.js'
import { StateStore } from './store/state-store.js'
import { demoTenant } from './tenants/demo-tenant.js'

const stateStore = new StateStore()
const eventStore = new EventStore()

const engine = new RuntimeEngine(
  demoTenant,
  stateStore,
  eventStore,
  new Executor({
    docuseal: new DocuSealAdapter(),
    mock: new MockAdapter()
  }),
  new Dispatcher()
)

await engine.ingest({
  tenantId: 'demo',
  entityId: 'doc-123',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {
    fileName: 'contract.pdf'
  }
})

console.log('[runtime] transitions', stateStore.history())
console.log('[runtime] final state', stateStore.get('doc-123'))

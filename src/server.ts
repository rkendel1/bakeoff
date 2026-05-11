/**
 * Runtime-Core Production Server
 * 
 * This is the production HTTP server for bakeoff runtime-core deployed on Fly.io.
 * 
 * Provides:
 * - POST /runtime/v1/intent - Intent ingestion endpoint
 * - POST /runtime/v1/execution/{executionId}/observe - Observation endpoint
 * - GET /runtime/v1/intelligence/* - Intelligence exposure endpoints
 * - GET /health - Health check endpoint
 * - And all other runtime-core contract v1 endpoints
 */

import { DocuSealAdapter } from "./adapters/docuseal-adapter.js"
import { MockAdapter } from "./adapters/mock-adapter.js"
import { Dispatcher } from "./runtime/dispatcher.js"
import { RuntimeEngine } from "./runtime/engine.js"
import { Executor } from "./runtime/executor.js"
import { EventStore } from "./store/event-store.js"
import { StateStore } from "./store/state-store.js"
import { demoTenant } from "./tenants/demo-tenant.js"
import { ExecutionStore } from "./runtime/store/execution-store.js"
import { ExecutionQuery } from "./runtime/control-plane/execution-query.js"
import { RuntimeInspector } from "./runtime/control-plane/inspector.js"
import { TenantRuntimeRegistry } from "./runtime/registry/tenant-registry.js"
import { ControlPlaneServer } from "./runtime/api/server.js"
import { DurableExecutionQueue } from "./runtime/queue/durable-execution-queue.js"
import { RuntimeWorker } from "./runtime/worker/runtime-worker.js"
import { SiteJobQueue } from "./runtime/site-processing/site-job-queue.js"
import { SiteProcessingWorker } from "./runtime/site-processing/site-processing-worker.js"
import { defaultSiteProcessor } from "./runtime/site-processing/site-processor.js"
import type { SiteJob } from "./runtime/site-processing/site-job-queue.js"

console.log('[bakeoff-runtime-core] initializing...')

// Initialize runtime infrastructure
const registry = new TenantRuntimeRegistry()
registry.register('demo', demoTenant)

const executionStore = new ExecutionStore()
const stateStore = new StateStore()
const eventStore = new EventStore()
const executor = new Executor({
  docuseal: new DocuSealAdapter(),
  mock: new MockAdapter()
})
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

const executionQueue = new DurableExecutionQueue()
const worker = new RuntimeWorker(executionQueue, engines)
worker.start()

console.log('[bakeoff-runtime-core] worker started')

// Site processing infrastructure
const siteJobQueue = new SiteJobQueue()

// Callback notifier for site processing jobs
const notifySiteJobCallback = async (job: SiteJob): Promise<void> => {
  if (!job.callbackUrl) {
    return
  }

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
    console.warn('[site-worker] Failed to notify callback', {
      requestId: job.requestId,
      callbackUrl: job.callbackUrl,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

const siteWorker = new SiteProcessingWorker(
  siteJobQueue,
  defaultSiteProcessor,
  notifySiteJobCallback
)
siteWorker.start()

console.log('[bakeoff-runtime-core] site processing worker started')

const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()
const server = new ControlPlaneServer(
  registry,
  engines,
  query,
  inspector,
  executionQueue,
  executionStore,
  siteJobQueue
)

const port = parseInt(process.env.PORT || '8080', 10)

// Start the server
await server.start(port)

console.log(`[bakeoff-runtime-core] listening on port ${port}`)
console.log('[bakeoff-runtime-core] endpoints:')
console.log('  - GET /health')
console.log('  - POST /runtime/v1/intent')
console.log('  - POST /runtime/v1/execution/{executionId}/observe')
console.log('  - GET /runtime/v1/intelligence/*')
console.log('  - And all other runtime-core contract v1 endpoints')

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[bakeoff-runtime-core] ${signal} received, shutting down gracefully`)
  
  // Stop workers first to prevent new work from being processed
  worker.stop()
  console.log('[bakeoff-runtime-core] worker stopped')
  
  siteWorker.stop()
  console.log('[bakeoff-runtime-core] site processing worker stopped')
  
  // Then stop the server
  await server.stop()
  console.log('[bakeoff-runtime-core] server closed')
  
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

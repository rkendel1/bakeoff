# tenant-runtime-poc

A deterministic staged pipeline runtime engine for tenant-specific state machines, with true control plane/execution plane separation for production scalability.

## Architecture

This project implements a **tenant-driven execution platform** with four layers:

### 1. Execution Kernel
Pipeline-based execution model:
```
INGEST → EVALUATE → PLAN → EXECUTE → APPLY → EMIT
```

### 2. Intelligence Layer
- **ExecutionQuery**: Query and retrieve executions
- **RuntimeInspector**: Execution observability
- **ReplayEngine**: Safe execution replay
- **SimulationEngine**: Model change simulation

### 3. Control Plane / Execution Plane Separation (NEW)

True separation between ingestion and execution:

```
┌─────────────────────────────────────────────────────┐
│                 Control Plane                       │
│                                                     │
│  ControlPlaneServer → ExecutionQueue.enqueue()     │
│  (POST /events)              ↓                      │
└────────────────────────────────────────────────────┘
                               │
┌────────────────────────────────────────────────────┐
│                 Execution Plane                     │
│                               ↓                     │
│  RuntimeWorker.dequeue() → RuntimeEngine.ingest()  │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Components:**
- **ExecutionQueue**: Decouples control plane from execution plane
- **RuntimeWorker**: Execution plane that processes events from queue
- **ControlPlaneServer**: API layer that enqueues events

### 4. Control Plane API Layer
- **TenantRuntimeRegistry**: Multi-tenant model management
- **ControlPlaneServer**: HTTP API for external systems
  - `POST /events` - Ingest events (enqueues for async processing)
  - `GET /executions` - Query executions
  - `GET /executions/:id` - Inspect execution
  - `POST /simulate` - Simulate execution

See [src/runtime/README.md](src/runtime/README.md) for kernel architecture and [src/runtime/api/README.md](src/runtime/api/README.md) for API documentation.

## Key Features

- **Control/Execution Plane Separation**: True architectural split for production scalability
- **ExecutionQueue**: Async event processing with worker isolation
- **RuntimeWorker**: Independent execution plane with worker pool support
- **ExecutionContext**: Core abstraction carrying runtime state through pipeline stages
- **Pipeline Stages**: Six isolated stages for event processing
- **State Machine**: Tenant-specific state transitions with action execution
- **Event-Driven**: Follow-up events automatically enqueued and processed
- **Control Plane API**: HTTP API for external event ingestion and execution querying
- **Multi-Tenancy**: Registry-based tenant model management with versioning
- **Observability**: Query, inspect, replay, and simulate executions

## Install

```bash
npm install
```

## Run demo lifecycle

```bash
npm run start
```

## Run tests

```bash
npm test
```

## Build

```bash
npm run build
```

## Example

### Direct Runtime Usage

```typescript
const engine = new RuntimeEngine(
  tenantModel,
  stateStore,
  eventStore,
  executor,
  dispatcher,
  executionStore
)

await engine.ingest({
  tenantId: 'demo',
  entityId: 'doc-123',
  entityType: 'document',
  type: 'document.uploaded',
  payload: { fileName: 'contract.pdf' }
})
```

The runtime will process the event through the pipeline, execute any actions, update state, and emit follow-up events.

### Control Plane API Usage

```typescript
// Setup registry, queue, and worker
const registry = new TenantRuntimeRegistry()
registry.register('demo', demoTenant)

const executionQueue = new ExecutionQueue()
const worker = new RuntimeWorker(executionQueue, engines)
worker.start()

const server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue)
await server.start(3000)

// Ingest events via API (enqueued for async processing)
await fetch('http://localhost:3000/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'demo',
    entityId: 'doc-123',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })
})

// Query executions
const response = await fetch(
  'http://localhost:3000/executions?tenantId=demo&entityId=doc-123'
)
const { executions } = await response.json()
```

See `src/examples/api-demo.ts` for a complete working example.

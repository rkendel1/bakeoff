# tenant-runtime-poc

A deterministic staged pipeline runtime engine for tenant-specific state machines, exposed as a control plane API for platform integration.

## Architecture

This project implements a **tenant-driven execution platform** with three layers:

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

### 3. Control Plane API Layer (NEW)
- **TenantRuntimeRegistry**: Multi-tenant model management
- **ControlPlaneServer**: HTTP API for external systems
  - `POST /events` - Ingest events
  - `GET /executions` - Query executions
  - `GET /executions/:id` - Inspect execution
  - `POST /simulate` - Simulate execution

See [src/runtime/README.md](src/runtime/README.md) for kernel architecture and [src/runtime/api/README.md](src/runtime/api/README.md) for API documentation.

## Key Features

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
// Setup registry and server
const registry = new TenantRuntimeRegistry()
registry.register('demo', demoTenant)

const server = new ControlPlaneServer(registry, engines, query, inspector)
await server.start(3000)

// Ingest events via API
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

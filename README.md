# tenant-runtime-poc

A deterministic staged pipeline runtime engine for tenant-specific state machines.

## Architecture

This project implements a **v1 Runtime Kernel** with a pipeline-based execution model:

```
INGEST → EVALUATE → PLAN → EXECUTE → APPLY → EMIT
```

Each stage is isolated, testable, and replaceable. See [src/runtime/README.md](src/runtime/README.md) for detailed architecture documentation.

## Key Features

- **ExecutionContext**: Core abstraction carrying runtime state through pipeline stages
- **Pipeline Stages**: Six isolated stages for event processing
- **State Machine**: Tenant-specific state transitions with action execution
- **Event-Driven**: Follow-up events automatically enqueued and processed

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

```typescript
const engine = new RuntimeEngine(
  tenantModel,
  stateStore,
  eventStore,
  executor,
  dispatcher
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

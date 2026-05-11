# Runtime Control Plane API Layer

## Overview

The Control Plane API Layer exposes the deterministic runtime kernel as a clean HTTP API, enabling external systems to interact with tenant-defined operational models.

This layer transforms the runtime from a self-contained execution engine into a **tenant-driven execution platform** that can be integrated into larger systems like OperNext or StackLive.

## Architecture

```
┌─────────────────────────────────────────┐
│     External Systems / Platform         │
│   (OperNext, StackLive, UI Clients)    │
└──────────────┬──────────────────────────┘
               │ HTTP API
               │
┌──────────────▼──────────────────────────┐
│    Control Plane API Layer (NEW)        │
│  ┌──────────────────────────────────┐  │
│  │  ControlPlaneServer              │  │
│  │  - POST /events                  │  │
│  │  - GET /executions               │  │
│  │  - GET /executions/:id           │  │
│  │  - POST /simulate                │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  TenantRuntimeRegistry           │  │
│  │  - Tenant model lookup           │  │
│  │  - Model versioning              │  │
│  └──────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Intelligence Layer (EXISTING)         │
│   - ExecutionQuery                      │
│   - RuntimeInspector                    │
│   - ReplayEngine                        │
│   - SimulationEngine                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   Execution Kernel (EXISTING)           │
│   - RuntimeEngine                       │
│   - Pipeline stages                     │
│   - State machine                       │
└─────────────────────────────────────────┘
```

## Components

### 1. TenantRuntimeRegistry

**Location**: `src/runtime/registry/tenant-registry.ts`

Centralized registry for tenant models and versions. Critical for scaling into a multi-tenant product.

**API:**

```typescript
import { TenantRuntimeRegistry } from './runtime/registry/tenant-registry.js'

const registry = new TenantRuntimeRegistry()

// Register a tenant model
registry.register('tenant-1', tenantModel)

// Register a specific version
registry.registerVersion('tenant-1', 'v1.0', tenantModel)

// Get current model
const model = registry.getModel('tenant-1')

// Get specific version
const modelV1 = registry.getModelVersion('tenant-1', 'v1.0')

// List all versions
const versions = registry.listVersions('tenant-1')

// Check if tenant exists
const exists = registry.hasTenant('tenant-1')
```

**Model Versioning:**

```typescript
type ModelVersion = {
  version: string
  model: TenantModel
  createdAt: Date
}
```

This is a stub for future model versioning support, enabling:
- A/B testing of model changes
- Rollback capabilities
- Model change tracking

### 2. ControlPlaneServer

**Location**: `src/runtime/api/server.ts`

HTTP API server that exposes the runtime as a platform service.

**Setup:**

```typescript
import { ControlPlaneServer } from './runtime/api/server.js'
import { TenantRuntimeRegistry } from './runtime/registry/tenant-registry.js'
import { ExecutionQuery } from './runtime/control-plane/execution-query.js'
import { RuntimeInspector } from './runtime/control-plane/inspector.js'

// Setup registry
const registry = new TenantRuntimeRegistry()
registry.register('tenant-1', tenantModel)

// Setup engines (one per tenant)
const engines = new Map([
  ['tenant-1', runtimeEngine]
])

// Setup control plane components
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()

// Create and start server
const server = new ControlPlaneServer(registry, engines, query, inspector)
await server.start(3000)
```

## API Endpoints

### 1. POST /events - Ingest Event

Externally ingest events into the runtime.

**Request:**

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-1",
    "entityId": "doc-123",
    "entityType": "document",
    "type": "document.uploaded",
    "payload": { "fileName": "contract.pdf" }
  }'
```

**Response:**

```json
{
  "status": "accepted",
  "event": {
    "tenantId": "tenant-1",
    "entityId": "doc-123",
    "entityType": "document",
    "type": "document.uploaded",
    "payload": { "fileName": "contract.pdf" }
  }
}
```

**Status Codes:**
- `202 Accepted` - Event accepted for processing
- `404 Not Found` - Tenant not registered
- `500 Internal Server Error` - Runtime engine error

### 2. GET /executions - Query Executions

Query executions with filters.

**Request:**

```bash
# Query by tenant and entity
curl "http://localhost:3000/executions?tenantId=tenant-1&entityId=doc-123"

# Query failed executions
curl "http://localhost:3000/executions?tenantId=tenant-1&status=failed"
```

**Response:**

```json
{
  "executions": [
    {
      "id": "execution-id",
      "tenantId": "tenant-1",
      "entityId": "doc-123",
      "status": "completed",
      "event": { ... },
      "contextSnapshot": { ... },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:00:01.000Z"
    }
  ]
}
```

**Query Parameters:**
- `tenantId` (required) - Tenant ID
- `entityId` (optional) - Entity ID
- `status` (optional) - Filter by status: `failed`

**Status Codes:**
- `200 OK` - Query successful
- `400 Bad Request` - Missing required parameters

### 3. GET /executions/:id - Inspect Execution

Get detailed inspection of a specific execution using RuntimeInspector.

**Request:**

```bash
curl http://localhost:3000/executions/execution-id
```

**Response:**

```json
{
  "inspection": {
    "executionId": "execution-id",
    "summary": {
      "startState": "draft",
      "endState": "pending_signature",
      "eventChain": ["document.uploaded", "signature.completed"],
      "actionsExecuted": ["send_for_signature"],
      "providersTouched": ["docuseal"]
    },
    "timeline": [ ... ],
    "stateChanges": [ ... ],
    "errors": null
  }
}
```

**Status Codes:**
- `200 OK` - Inspection successful
- `400 Bad Request` - Invalid execution ID
- `404 Not Found` - Execution not found

### 4. POST /simulate - Simulate Execution

Simulate an event against a model version without side effects.

**Request:**

```bash
curl -X POST http://localhost:3000/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-1",
    "event": {
      "tenantId": "tenant-1",
      "entityId": "doc-999",
      "entityType": "document",
      "type": "document.uploaded",
      "payload": {}
    },
    "modelVersion": "latest",
    "currentState": "draft"
  }'
```

**Response:**

```json
{
  "simulation": {
    "predictedState": "pending_signature",
    "predictedActions": ["send_for_signature"],
    "executionTrace": [ ... ],
    "sideEffects": {
      "emittedEvents": [ ... ],
      "stateChanges": [ ... ]
    }
  }
}
```

**Status Codes:**
- `200 OK` - Simulation successful
- `404 Not Found` - Model version not found

### 5. POST /site-requests and GET /site-requests/:requestId - Async Site Processing

Submit a URL for asynchronous site processing and track completion by request ID.

**Submit Request:**

```bash
curl -X POST http://localhost:3000/site-requests \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "callbackUrl": "https://requestor.example.com/webhooks/site-processing"
  }'
```

**Submit Response (`202 Accepted`):**

```json
{
  "requestId": "9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa",
  "status": "queued",
  "submittedAt": "2026-01-01T00:00:00.000Z",
  "statusEndpoint": "/site-requests/9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa"
}
```

**Check Status:**

```bash
curl http://localhost:3000/site-requests/9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa
```

**Status Response (`200 OK`):**

```json
{
  "requestId": "9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa",
  "url": "https://example.com/",
  "status": "completed",
  "submittedAt": "2026-01-01T00:00:00.000Z",
  "startedAt": "2026-01-01T00:00:00.200Z",
  "completedAt": "2026-01-01T00:00:01.450Z",
  "result": {
    "source": "basic-fetch",
    "title": "Example Domain"
  }
}
```

If `callbackUrl` is provided, the runtime sends a POST notification to that URL when processing completes (success or failure), including `requestId`, `status`, and result/error payload.

> Note: request tracking is currently in-memory, so request state does not persist across service restarts.

## Usage Example

See `src/examples/api-demo.ts` for a complete working example.

```typescript
// 1. Setup registry and register tenant
const registry = new TenantRuntimeRegistry()
registry.register('demo', demoTenant)

// 2. Setup runtime engine
const engine = new RuntimeEngine(/* ... */)
const engines = new Map([['demo', engine]])

// 3. Setup control plane
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()
const server = new ControlPlaneServer(registry, engines, query, inspector)

// 4. Start server
await server.start(3000)

// 5. Use API
const response = await fetch('http://localhost:3000/events', {
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
```

## Testing

Run API tests:

```bash
npx tsx --test src/tests/api.test.ts
```

Run the demo:

```bash
npx tsx src/examples/api-demo.ts
```

## What This Unlocks

Once this API layer exists, you can:

1. **Plug into OperNext immediately**
   - Event ingestion becomes API call
   - Execution becomes backend service

2. **Add real tenants**
   - No code changes required
   - Just POST models + events

3. **Build UI on top**
   - Execution viewer
   - Simulation console
   - Model editor

4. **Replace internal mock adapters with real providers**
   - Stripe
   - DocuSign
   - CRM systems

## The Key Mental Shift

You are no longer building:
> a runtime system

You are building:
> a tenant-driven execution platform with a deterministic kernel

## Roadmap

**v4: Model Management Layer**
- Create/update tenant models via API
- Version control models
- Diff simulations

**v5: UI Control Plane**
- Execution timeline viewer
- Simulation playground
- Model editor

**v6: OperNext Integration**
- Runtime becomes backend brain
- All workflows route through it

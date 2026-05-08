# Tenant Runtime Registry

## Overview

The TenantRuntimeRegistry is a centralized registry for managing tenant models and versions. It provides a critical foundation for scaling into a multi-tenant platform where each tenant can have different operational models.

## Purpose

Centralized lookup of:
- Tenant models
- Model versions (versioning support)
- Execution configuration

This registry enables:
- **Multi-tenancy**: Each tenant can have their own operational model
- **Versioning**: Track and manage different versions of tenant models
- **Isolation**: Tenants are isolated from each other
- **Scalability**: Easy to add new tenants without code changes

## API

### Basic Operations

```typescript
import { TenantRuntimeRegistry } from './runtime/registry/tenant-registry.js'

const registry = new TenantRuntimeRegistry()

// Register a tenant model
registry.register('tenant-1', tenantModel)

// Check if tenant exists
if (registry.hasTenant('tenant-1')) {
  // Get tenant model
  const model = registry.getModel('tenant-1')
}
```

### Model Versioning

```typescript
// Register specific versions
registry.registerVersion('tenant-1', 'v1.0', modelV1)
registry.registerVersion('tenant-1', 'v1.1', modelV1_1)
registry.registerVersion('tenant-1', 'v2.0', modelV2)

// Get specific version
const modelV1 = registry.getModelVersion('tenant-1', 'v1.0')

// List all versions for a tenant
const versions = registry.listVersions('tenant-1')
// Returns: [{ version: 'v1.0', model: {...}, createdAt: Date }, ...]
```

### Version Management

When you register a tenant, it automatically creates a `'latest'` version:

```typescript
registry.register('tenant-1', tenantModel)

// This creates:
// - Current model: tenantModel
// - Version 'latest': tenantModel

const latest = registry.getModelVersion('tenant-1', 'latest')
```

## Data Types

### ModelVersion

```typescript
type ModelVersion = {
  version: string       // Version identifier (e.g., 'v1.0', 'latest')
  model: TenantModel    // The tenant model at this version
  createdAt: Date       // When this version was registered
}
```

### TenantModel

```typescript
type TenantModel = {
  entities: string[]              // Entity types (e.g., ['document'])
  states: string[]                // State machine states
  events: string[]                // Event types
  transitions: Transition[]       // State transitions
  actions: ActionDefinition[]     // Action definitions
}
```

## Use Cases

### 1. Multi-Tenant Platform

```typescript
const registry = new TenantRuntimeRegistry()

// Register multiple tenants
registry.register('acme-corp', acmeModel)
registry.register('widgets-inc', widgetsModel)
registry.register('tech-startup', techModel)

// Each tenant has their own model
const acmeModel = registry.getModel('acme-corp')
const widgetsModel = registry.getModel('widgets-inc')
```

### 2. Model Versioning for A/B Testing

```typescript
// Register different versions for testing
registry.registerVersion('tenant-1', 'current', currentModel)
registry.registerVersion('tenant-1', 'experiment', experimentModel)

// Run simulations with different versions
const currentResult = await simulate(event, currentModel)
const experimentResult = await simulate(event, experimentModel)

// Compare results
console.log('Current:', currentResult.predictedState)
console.log('Experiment:', experimentResult.predictedState)
```

### 3. Model Rollback

```typescript
// Register versions as you deploy changes
registry.registerVersion('tenant-1', 'v1.0', modelV1)
registry.registerVersion('tenant-1', 'v1.1', modelV1_1)
registry.registerVersion('tenant-1', 'v2.0', modelV2)

// If v2.0 has issues, easily rollback
const safeModel = registry.getModelVersion('tenant-1', 'v1.1')
registry.register('tenant-1', safeModel)  // Set as current
```

### 4. Model Change Tracking

```typescript
// List all versions to track changes over time
const versions = registry.listVersions('tenant-1')

versions.forEach((version) => {
  console.log(`Version ${version.version}:`)
  console.log(`  Created: ${version.createdAt}`)
  console.log(`  States: ${version.model.states.join(', ')}`)
  console.log(`  Transitions: ${version.model.transitions.length}`)
})
```

## Integration with Control Plane API

The registry integrates with the Control Plane API Server:

```typescript
import { ControlPlaneServer } from '../api/server.js'
import { TenantRuntimeRegistry } from './tenant-registry.js'

// Setup registry
const registry = new TenantRuntimeRegistry()
registry.register('tenant-1', tenantModel)

// Setup API server with registry
const server = new ControlPlaneServer(
  registry,      // Registry provides tenant models
  engines,       // Runtime engines per tenant
  query,         // Execution query
  inspector      // Runtime inspector
)

await server.start(3000)

// API endpoints use registry to:
// - Validate tenant exists (POST /events)
// - Get model versions (POST /simulate)
```

## Future Enhancements

### Planned Features

1. **Model Validation**
   - Validate model structure before registration
   - Ensure all references are valid

2. **Model Diffing**
   - Compare two model versions
   - Highlight changes

3. **Automatic Versioning**
   - Auto-increment version numbers
   - Semantic versioning support

4. **Persistence**
   - Save models to database
   - Load models on startup

5. **Model Metadata**
   - Author, description, tags
   - Change logs
   - Deprecation warnings

## Example: Complete Setup

```typescript
import { TenantRuntimeRegistry } from './runtime/registry/tenant-registry.js'
import { RuntimeEngine } from './runtime/engine.js'
import { ControlPlaneServer } from './runtime/api/server.js'

// 1. Create registry
const registry = new TenantRuntimeRegistry()

// 2. Register tenants
registry.register('acme', acmeModel)
registry.register('widgets', widgetsModel)

// 3. Create runtime engines for each tenant
const acmeEngine = new RuntimeEngine(acmeModel, /* ... */)
const widgetsEngine = new RuntimeEngine(widgetsModel, /* ... */)

const engines = new Map([
  ['acme', acmeEngine],
  ['widgets', widgetsEngine]
])

// 4. Create API server
const server = new ControlPlaneServer(
  registry,
  engines,
  query,
  inspector
)

// 5. Start server
await server.start(3000)

// Now the API can:
// - Ingest events for any registered tenant
// - Query executions per tenant
// - Simulate with specific model versions
```

## Testing

The registry is tested in `src/tests/api.test.ts`:

```bash
npx tsx --test src/tests/api.test.ts
```

Tests cover:
- ✓ Register and retrieve tenant model
- ✓ hasTenant checks tenant existence
- ✓ getModelVersion returns specific version
- ✓ registerVersion stores versioned model
- ✓ listVersions returns all versions

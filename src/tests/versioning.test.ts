import { test } from 'node:test'
import assert from 'node:assert'
import { TenantRuntimeRegistry } from '../runtime/registry/tenant-registry.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { ExecutionStore } from '../runtime/store/execution-store.js'
import { StateStore } from '../store/state-store.js'
import { EventStore } from '../store/event-store.js'
import { Executor } from '../runtime/executor.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { demoTenant } from '../tenants/demo-tenant.js'
import type { TenantModel } from '../models/tenant-model.js'

/**
 * Test suite for Model Versioning + Execution Binding
 * 
 * This test suite validates the core versioning functionality:
 * - Registry stores multiple versions
 * - Executions bind to specific model versions
 * - Version resolution works correctly
 */

test('TenantRuntimeRegistry: resolveVersion returns latest by default', () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const version = registry.resolveVersion('tenant-1')
  assert.equal(version, 'latest')
})

test('TenantRuntimeRegistry: resolveVersion respects explicit version', () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  registry.registerVersion('tenant-1', 'v1.0', demoTenant)
  
  const version = registry.resolveVersion('tenant-1', 'v1.0')
  assert.equal(version, 'v1.0')
})

test('TenantRuntimeRegistry: resolveVersion throws on invalid version', () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  assert.throws(() => {
    registry.resolveVersion('tenant-1', 'v999')
  }, /Model version not found/)
})

test('TenantRuntimeRegistry: getLatestModel returns current model', () => {
  const registry = new TenantRuntimeRegistry()
  registry.register('tenant-1', demoTenant)
  
  const model = registry.getLatestModel('tenant-1')
  assert.ok(model)
  assert.equal(model.states.length, demoTenant.states.length)
})

test('RuntimeEngine: execution records include modelVersion', async () => {
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  // Ingest event with explicit model version
  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  }, 'v1.0')
  
  // Verify execution has modelVersion
  const executions = await executionStore.all()
  assert.equal(executions.length, 2) // document.uploaded + signature.completed
  assert.equal(executions[0].modelVersion, 'v1.0')
})

test('RuntimeEngine: execution defaults to latest version when not specified', async () => {
  const executionStore = new ExecutionStore()
  const stateStore = new StateStore()
  const eventStore = new EventStore()
  const executor = new Executor({ docuseal: new DocuSealAdapter() })
  const dispatcher = new Dispatcher()
  
  const engine = new RuntimeEngine(
    demoTenant,
    stateStore,
    eventStore,
    executor,
    dispatcher,
    executionStore
  )
  
  // Ingest event without explicit model version
  await engine.ingest({
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  })
  
  // Verify execution defaults to 'latest'
  const executions = await executionStore.all()
  assert.equal(executions.length, 2) // document.uploaded + signature.completed
  assert.equal(executions[0].modelVersion, 'latest')
})

test('TenantRuntimeRegistry: multiple versions for same tenant', () => {
  const registry = new TenantRuntimeRegistry()
  
  // Register initial version
  registry.register('tenant-1', demoTenant)
  
  // Create modified version with different states
  const modelV2: TenantModel = {
    ...demoTenant,
    states: [...demoTenant.states, 'archived']
  }
  
  // Register v2
  registry.registerVersion('tenant-1', 'v2.0', modelV2)
  
  // List versions
  const versions = registry.listVersions('tenant-1')
  assert.equal(versions.length, 2)
  assert.ok(versions.some(v => v.version === 'latest'))
  assert.ok(versions.some(v => v.version === 'v2.0'))
  
  // Get specific versions
  const latest = registry.getModelVersion('tenant-1', 'latest')
  const v2 = registry.getModelVersion('tenant-1', 'v2.0')
  
  assert.ok(latest)
  assert.ok(v2)
  assert.equal(latest.states.length, demoTenant.states.length)
  assert.equal(v2.states.length, demoTenant.states.length + 1)
})

test('Versioned execution: same event, different model versions produce different results', async () => {
  const registry = new TenantRuntimeRegistry()
  
  // Register v1
  const modelV1: TenantModel = {
    ...demoTenant,
    transitions: [demoTenant.transitions[0]] // Only first transition
  }
  registry.registerVersion('tenant-1', 'v1.0', modelV1)
  
  // Register v2 with more transitions
  registry.registerVersion('tenant-1', 'v2.0', demoTenant)
  
  // Create execution stores for v1 and v2
  const storeV1 = new ExecutionStore()
  const storeV2 = new ExecutionStore()
  
  const engineV1 = new RuntimeEngine(
    modelV1,
    new StateStore(),
    new EventStore(),
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    storeV1
  )
  
  const engineV2 = new RuntimeEngine(
    demoTenant,
    new StateStore(),
    new EventStore(),
    new Executor({ docuseal: new DocuSealAdapter() }),
    new Dispatcher(),
    storeV2
  )
  
  // Same event
  const event = {
    tenantId: 'tenant-1',
    entityId: 'doc-1',
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  }
  
  // Execute with v1
  await engineV1.ingest(event, 'v1.0')
  
  // Execute with v2
  await engineV2.ingest(event, 'v2.0')
  
  // Verify both executions tracked their versions
  const execsV1 = await storeV1.all()
  const execsV2 = await storeV2.all()
  
  assert.equal(execsV1.length, 2) // document.uploaded + signature.completed
  assert.equal(execsV2.length, 2) // document.uploaded + signature.completed
  assert.equal(execsV1[0].modelVersion, 'v1.0')
  assert.equal(execsV2[0].modelVersion, 'v2.0')
  
  // Verify they used different models
  assert.equal(execsV1[0].contextSnapshot.model.transitions.length, 1)
  assert.equal(execsV2[0].contextSnapshot.model.transitions.length, demoTenant.transitions.length)
})

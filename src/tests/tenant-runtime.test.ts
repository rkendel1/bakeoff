/**
 * Test: Multi-Tenant Runtime Isolation Layer
 * 
 * Validates that:
 * - TenantRuntimeRegistry manages isolated runtimes per tenant
 * - Each tenant has its own execution state
 * - RuntimeCore provides consistent execution interface
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { TenantRuntimeRegistry } from '../runtime/tenant/TenantRuntimeRegistry.js'
import { RuntimeMemoryStore } from '../runtime/memory/RuntimeMemoryStore.js'

test('TenantRuntimeRegistry: initializes with dependencies', () => {
  const registry = new TenantRuntimeRegistry()
  
  // Initialize with factory functions
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  assert.equal(registry.size(), 0)
})

test('TenantRuntimeRegistry: registers tenant runtimes', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  const runtime = registry.register('tenant-1')
  
  assert.ok(runtime)
  assert.equal(runtime.tenantId, 'tenant-1')
  assert.equal(registry.size(), 1)
  assert.equal(registry.has('tenant-1'), true)
})

test('TenantRuntimeRegistry: isolates tenant runtimes', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  const runtime1 = registry.register('tenant-1')
  const runtime2 = registry.register('tenant-2')
  
  assert.notEqual(runtime1, runtime2)
  assert.equal(runtime1.tenantId, 'tenant-1')
  assert.equal(runtime2.tenantId, 'tenant-2')
  
  // Each tenant has isolated stores
  assert.notEqual(runtime1.executionStore, runtime2.executionStore)
  assert.notEqual(runtime1.memoryStore, runtime2.memoryStore)
  assert.notEqual(runtime1.predictionStore, runtime2.predictionStore)
  assert.notEqual(runtime1.governanceStore, runtime2.governanceStore)
})

test('TenantRuntimeRegistry: get and require methods', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  registry.register('tenant-1')
  
  // get returns undefined for missing tenant
  assert.equal(registry.get('tenant-missing'), undefined)
  
  // require throws for missing tenant
  assert.throws(() => {
    registry.require('tenant-missing')
  }, /Tenant runtime not found: tenant-missing/)
  
  // get returns runtime for existing tenant
  const runtime = registry.get('tenant-1')
  assert.ok(runtime)
  assert.equal(runtime.tenantId, 'tenant-1')
})

test('TenantRuntimeRegistry: executes intents per tenant', async () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  registry.register('tenant-1')
  
  const result = await registry.executeIntent('tenant-1', {
    goal: 'process document',
    context: { documentId: 'doc-123' }
  })
  
  assert.ok(result)
  assert.ok(result.executionId)
  assert.ok(result.decision)
  assert.equal(result.decision.strategy, 'default')
})

test('TenantRuntimeRegistry: unregister removes tenant', () => {
  const registry = new TenantRuntimeRegistry()
  
  registry.initialize({
    executionStoreFactory: (tenantId) => ({ tenantId, type: 'execution' }),
    memoryStoreFactory: (tenantId) => new RuntimeMemoryStore(),
    predictionStoreFactory: (tenantId) => ({ tenantId, type: 'prediction' }),
    governanceStoreFactory: (tenantId) => ({ tenantId, type: 'governance' }),
    policyEngineFactory: (tenantId) => ({ tenantId, type: 'policy' }),
    intelligenceEngineFactory: (tenantId) => ({ tenantId, type: 'intelligence' })
  })
  
  registry.register('tenant-1')
  assert.equal(registry.has('tenant-1'), true)
  
  registry.unregister('tenant-1')
  assert.equal(registry.has('tenant-1'), false)
  assert.equal(registry.size(), 0)
})

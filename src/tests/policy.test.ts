import { test } from 'node:test'
import assert from 'node:assert'
import { RuntimePolicyEngine } from '../runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from '../runtime/policy/PolicyStore.js'
import { AdaptiveProviderRouter } from '../runtime/policy/AdaptiveProviderRouter.js'
import { CanonicalPathProtector } from '../runtime/policy/CanonicalPathProtector.js'
import type { TenantModel } from '../models/tenant-model.js'
import type { ExecutionPlan, PolicyEvaluationContext, ProviderStabilityRule } from '../runtime/policy/types.js'

// Test model with multiple providers
const testModel: TenantModel = {
  entities: ['document'],
  states: ['draft', 'pending'],
  events: ['submit'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'submit',
      toState: 'pending',
      actions: ['process']
    }
  ],
  actions: [
    { name: 'process', provider: 'provider_a' },
    { name: 'process', provider: 'provider_b' }  // Alternate
  ]
}

test('PolicyStore stores and retrieves rules', async () => {
  const store = new PolicyStore()
  
  await store.addRule('tenant-1', {
    type: 'provider_stability',
    threshold: 0.5,
    action: 'reroute'
  })
  
  const rules = await store.getRules('tenant-1')
  assert.equal(rules.length, 1)
  assert.equal(rules[0].type, 'provider_stability')
  const rule = rules[0] as ProviderStabilityRule
  assert.equal(rule.threshold, 0.5)
})

test('RuntimePolicyEngine evaluates provider stability rule with reroute', async () => {
  const policyStore = new PolicyStore()
  await policyStore.addRule('test-tenant', {
    type: 'provider_stability',
    threshold: 0.5,
    action: 'reroute'
  })
  
  const engine = new RuntimePolicyEngine(policyStore)
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const providerStability = new Map([
    ['provider_a', 0.3],  // Unstable
    ['provider_b', 0.9]   // Stable
  ])
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-1',
    executionContext: {} as any,
    model: testModel,
    executionPlan,
    providerStability
  }
  
  const decision = await engine.evaluate(context)
  
  assert.equal(decision.allowed, true)
  assert.ok(decision.modifiedExecutionPlan)
  assert.equal(decision.modifiedExecutionPlan!.actions[0].provider, 'provider_b')
  assert.ok(decision.enforcementActions)
  assert.equal(decision.enforcementActions![0].type, 'provider_reroute')
})

test('RuntimePolicyEngine blocks execution on high entropy', async () => {
  const policyStore = new PolicyStore()
  await policyStore.addRule('test-tenant', {
    type: 'entropy_limit',
    maxEntropy: 0.7,
    action: 'block'
  })
  
  const engine = new RuntimePolicyEngine(policyStore)
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-1',
    executionContext: {} as any,
    model: testModel,
    executionPlan: { actions: [] },
    entropy: 0.9  // High entropy
  }
  
  const decision = await engine.evaluate(context)
  
  assert.equal(decision.allowed, false)
  assert.ok(decision.warnings)
  assert.equal(decision.warnings![0].rule, 'entropy_limit')
  assert.equal(decision.warnings![0].severity, 'high')
})

test('RuntimePolicyEngine warns on low convergence', async () => {
  const policyStore = new PolicyStore()
  await policyStore.addRule('test-tenant', {
    type: 'minimum_convergence',
    threshold: 0.7,
    action: 'warn'
  })
  
  const engine = new RuntimePolicyEngine(policyStore)
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-1',
    executionContext: {} as any,
    model: testModel,
    executionPlan: { actions: [] },
    convergenceScore: 0.5  // Low convergence
  }
  
  const decision = await engine.evaluate(context)
  
  assert.equal(decision.allowed, true)
  assert.ok(decision.warnings)
  assert.equal(decision.warnings![0].rule, 'minimum_convergence')
  assert.equal(decision.warnings![0].severity, 'medium')
})

test('RuntimePolicyEngine engages canonical protection', async () => {
  const policyStore = new PolicyStore()
  await policyStore.addRule('test-tenant', {
    type: 'canonical_path_protection',
    minConfidence: 0.8,
    action: 'prefer_canonical_transition'
  })
  
  const engine = new RuntimePolicyEngine(policyStore)
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-1',
    executionContext: {} as any,
    model: testModel,
    executionPlan: { actions: [] },
    canonicalConfidence: 0.5,  // Low confidence
    entropy: 0.8               // High entropy
  }
  
  const decision = await engine.evaluate(context)
  
  assert.equal(decision.allowed, true)
  assert.ok(decision.warnings)
  assert.ok(decision.warnings!.some((w: any) => w.rule === 'canonical_path_protection'))
  assert.ok(decision.enforcementActions)
  assert.ok(decision.enforcementActions!.some((a: any) => a.type === 'canonical_protection'))
})

test('AdaptiveProviderRouter reroutes unstable provider', () => {
  const router = new AdaptiveProviderRouter()
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const providerStability = new Map([
    ['provider_a', 0.3],
    ['provider_b', 0.9]
  ])
  
  const result = router.reroute(executionPlan, testModel, providerStability, 0.5)
  
  assert.equal(result.modifiedPlan.actions[0].provider, 'provider_b')
  assert.equal(result.actions.length, 1)
  assert.equal(result.actions[0].type, 'provider_reroute')
  assert.equal(result.actions[0].target, 'provider_b')
})

test('AdaptiveProviderRouter does not reroute stable provider', () => {
  const router = new AdaptiveProviderRouter()
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const providerStability = new Map([
    ['provider_a', 0.9],  // Stable
    ['provider_b', 0.8]
  ])
  
  const result = router.reroute(executionPlan, testModel, providerStability, 0.5)
  
  assert.equal(result.modifiedPlan.actions[0].provider, 'provider_a')
  assert.equal(result.actions.length, 0)
})

test('AdaptiveProviderRouter handles missing alternate provider', () => {
  const router = new AdaptiveProviderRouter()
  
  const modelWithoutAlternate: TenantModel = {
    entities: ['document'],
    states: [],
    events: [],
    transitions: [],
    actions: [
      { name: 'process', provider: 'provider_a' }
      // No alternate provider
    ]
  }
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const providerStability = new Map([
    ['provider_a', 0.3]  // Unstable, but no alternative
  ])
  
  const result = router.reroute(executionPlan, modelWithoutAlternate, providerStability, 0.5)
  
  // Should keep original provider since no alternative
  assert.equal(result.modifiedPlan.actions[0].provider, 'provider_a')
  assert.equal(result.actions.length, 0)
})

test('CanonicalPathProtector engages protection on low confidence', () => {
  const protector = new CanonicalPathProtector()
  
  const result = protector.protect(
    { actions: [] },
    0.5,  // Low canonical confidence
    0.4,  // Low entropy
    0.8   // Min confidence threshold
  )
  
  assert.equal(result.shouldProtect, true)
  assert.ok(result.warnings.length > 0)
  assert.ok(result.actions.length > 0)
  assert.equal(result.actions[0].type, 'canonical_protection')
})

test('CanonicalPathProtector engages protection on high entropy', () => {
  const protector = new CanonicalPathProtector()
  
  const result = protector.protect(
    { actions: [] },
    0.9,  // High canonical confidence
    0.8,  // High entropy
    0.7   // Min confidence threshold
  )
  
  assert.equal(result.shouldProtect, true)
  assert.ok(result.warnings.length > 0)
})

test('CanonicalPathProtector does not engage on good conditions', () => {
  const protector = new CanonicalPathProtector()
  
  const result = protector.protect(
    { actions: [] },
    0.9,  // High canonical confidence
    0.3,  // Low entropy
    0.7   // Min confidence threshold
  )
  
  assert.equal(result.shouldProtect, false)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.actions.length, 0)
})

test('CanonicalPathProtector assesses path stability', () => {
  const protector = new CanonicalPathProtector()
  
  // High stability
  const highStability = protector.assessPathStability(
    { actions: [] },
    0.95,  // High canonical confidence
    0.1    // Low entropy
  )
  assert.ok(highStability.score >= 0.9)
  assert.ok(highStability.reasoning.includes('High stability'))
  
  // Low stability
  const lowStability = protector.assessPathStability(
    { actions: [] },
    0.3,   // Low canonical confidence
    0.9    // High entropy
  )
  assert.ok(lowStability.score < 0.5)
  assert.ok(lowStability.reasoning.includes('low stability'))
})

test('RuntimePolicyEngine evaluates multiple policies together', async () => {
  const policyStore = new PolicyStore()
  
  // Add multiple policies
  await policyStore.addRule('test-tenant', {
    type: 'provider_stability',
    threshold: 0.5,
    action: 'reroute'
  })
  
  await policyStore.addRule('test-tenant', {
    type: 'entropy_limit',
    maxEntropy: 0.7,
    action: 'warn'
  })
  
  await policyStore.addRule('test-tenant', {
    type: 'minimum_convergence',
    threshold: 0.6,
    action: 'warn'
  })
  
  const engine = new RuntimePolicyEngine(policyStore)
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-1',
    executionContext: {} as any,
    model: testModel,
    executionPlan,
    providerStability: new Map([
      ['provider_a', 0.3],
      ['provider_b', 0.9]
    ]),
    entropy: 0.75,          // Above warning threshold
    convergenceScore: 0.5   // Below warning threshold
  }
  
  const decision = await engine.evaluate(context)
  
  assert.equal(decision.allowed, true)
  assert.ok(decision.modifiedExecutionPlan)  // Provider rerouted
  assert.ok(decision.warnings)
  assert.ok(decision.warnings!.length >= 2)  // At least entropy and convergence warnings
  assert.ok(decision.enforcementActions)
})

import { test } from 'node:test'
import assert from 'node:assert'
import { RuntimeMemoryStore } from '../runtime/memory/RuntimeMemoryStore.js'
import { StrategyEffectivenessAnalyzer } from '../runtime/memory/StrategyEffectivenessAnalyzer.js'
import { MemoryInformedGovernanceEngine } from '../runtime/memory/MemoryInformedGovernanceEngine.js'
import { RuntimePolicyEngine } from '../runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from '../runtime/policy/PolicyStore.js'
import type { RuntimeMemoryRecord } from '../runtime/memory/types.js'
import type { PolicyEvaluationContext, ExecutionPlan } from '../runtime/policy/types.js'
import type { TenantModel } from '../models/tenant-model.js'
import { randomUUID } from 'node:crypto'

// Helper to create test memory record
function createMemoryRecord(
  tenantId: string,
  triggerType: 'provider_instability' | 'high_entropy' | 'low_convergence' | 'canonical_drift',
  strategyApplied: string,
  effectivenessScore: number,
  success: boolean
): RuntimeMemoryRecord {
  return {
    id: randomUUID(),
    tenantId,
    trigger: {
      type: triggerType,
      context: {},
      timestamp: new Date()
    },
    decision: {
      policyDecision: {
        allowed: true,
        rationale: []
      },
      enforcementActions: [],
      strategyApplied,
      rationale: []
    },
    outcome: {
      executionId: randomUUID(),
      status: success ? 'completed' : 'failed',
      retryCount: success ? 0 : 2
    },
    effectiveness: {
      score: effectivenessScore,
      factors: {
        executionSuccess: success,
        retryReduction: effectivenessScore * 0.5,
        convergenceGain: effectivenessScore * 0.3,
        entropyReduction: effectivenessScore * 0.2
      }
    },
    createdAt: new Date(),
    outcomeCapturedAt: new Date()
  }
}

test('RuntimeMemoryStore: stores and retrieves records', async () => {
  const store = new RuntimeMemoryStore()
  
  const record = createMemoryRecord(
    'test-tenant',
    'provider_instability',
    'reroute:provider_a->provider_b',
    0.85,
    true
  )
  
  await store.store(record)
  
  const retrieved = await store.get(record.id)
  assert.ok(retrieved)
  assert.equal(retrieved.id, record.id)
  assert.equal(retrieved.tenantId, 'test-tenant')
})

test('RuntimeMemoryStore: queries by tenant', async () => {
  const store = new RuntimeMemoryStore()
  
  await store.store(createMemoryRecord('tenant-1', 'provider_instability', 'reroute:a->b', 0.8, true))
  await store.store(createMemoryRecord('tenant-1', 'high_entropy', 'block', 0.7, true))
  await store.store(createMemoryRecord('tenant-2', 'provider_instability', 'reroute:c->d', 0.9, true))
  
  const tenant1Records = await store.getByTenant('tenant-1')
  assert.equal(tenant1Records.length, 2)
  
  const tenant2Records = await store.getByTenant('tenant-2')
  assert.equal(tenant2Records.length, 1)
})

test('RuntimeMemoryStore: queries by trigger type', async () => {
  const store = new RuntimeMemoryStore()
  
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.8, true))
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:c->d', 0.9, true))
  await store.store(createMemoryRecord('test-tenant', 'high_entropy', 'block', 0.7, true))
  
  const instabilityRecords = await store.getByTrigger('test-tenant', 'provider_instability')
  assert.equal(instabilityRecords.length, 2)
  
  const entropyRecords = await store.getByTrigger('test-tenant', 'high_entropy')
  assert.equal(entropyRecords.length, 1)
})

test('RuntimeMemoryStore: queries by strategy', async () => {
  const store = new RuntimeMemoryStore()
  
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.8, true))
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.9, true))
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:c->d', 0.7, true))
  
  const strategyRecords = await store.getByStrategy('test-tenant', 'reroute:a->b')
  assert.equal(strategyRecords.length, 2)
})

test('RuntimeMemoryStore: gets most effective strategies', async () => {
  const store = new RuntimeMemoryStore()
  
  // Strategy A: high effectiveness
  for (let i = 0; i < 5; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.9, true))
  }
  
  // Strategy B: medium effectiveness
  for (let i = 0; i < 5; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:c->d', 0.6, true))
  }
  
  // Strategy C: low effectiveness
  for (let i = 0; i < 5; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'block', 0.3, false))
  }
  
  const patterns = await store.getMostEffectiveStrategies('test-tenant', 'provider_instability', 3)
  
  assert.equal(patterns.length, 3)
  assert.equal(patterns[0].strategyName, 'reroute:a->b')
  assert.ok(patterns[0].effectivenessScore > patterns[1].effectivenessScore)
  assert.ok(patterns[1].effectivenessScore > patterns[2].effectivenessScore)
})

test('RuntimeMemoryStore: calculates strategy trends', async () => {
  const store = new RuntimeMemoryStore()
  
  // Add improving strategy (starts bad, gets better)
  const now = Date.now()
  for (let i = 0; i < 10; i++) {
    const record = createMemoryRecord('test-tenant', 'provider_instability', 'improving:a->b', 0.3 + (i * 0.07), true)
    record.createdAt = new Date(now + i * 1000)
    await store.store(record)
  }
  
  const patterns = await store.getMostEffectiveStrategies('test-tenant', 'provider_instability', 1)
  
  assert.equal(patterns[0].recentTrend, 'improving')
})

test('StrategyEffectivenessAnalyzer: builds tenant profile', async () => {
  const store = new RuntimeMemoryStore()
  const analyzer = new StrategyEffectivenessAnalyzer(store)
  
  // Add various records
  for (let i = 0; i < 10; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.85, true))
  }
  for (let i = 0; i < 5; i++) {
    await store.store(createMemoryRecord('test-tenant', 'high_entropy', 'block', 0.7, true))
  }
  
  const profile = await analyzer.buildTenantProfile('test-tenant')
  
  assert.equal(profile.tenantId, 'test-tenant')
  assert.equal(profile.totalMemoryRecords, 15)
  assert.ok(profile.learningConfidence > 0.5)
  assert.ok(profile.preferredStrategies.length > 0)
  assert.ok(profile.commonTriggers.length > 0)
})

test('StrategyEffectivenessAnalyzer: recommends best strategy', async () => {
  const store = new RuntimeMemoryStore()
  const analyzer = new StrategyEffectivenessAnalyzer(store)
  
  // Add high-performing strategy
  for (let i = 0; i < 10; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.9, true))
  }
  
  // Add low-performing strategy
  for (let i = 0; i < 5; i++) {
    await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'block', 0.4, false))
  }
  
  const recommendation = await analyzer.recommendStrategy('test-tenant', 'provider_instability')
  
  assert.ok(recommendation)
  assert.equal(recommendation.strategy, 'reroute:a->b')
  assert.ok(recommendation.effectivenessScore > 0.5)
  // 10 samples should give medium confidence (0.6)
  assert.ok(recommendation.confidence >= 0.5 && recommendation.confidence < 0.8)
})

test('StrategyEffectivenessAnalyzer: detects declining strategies', async () => {
  const store = new RuntimeMemoryStore()
  const analyzer = new StrategyEffectivenessAnalyzer(store)
  
  // Add declining strategy (starts good, gets worse)
  const now = Date.now()
  for (let i = 0; i < 20; i++) {
    const record = createMemoryRecord('test-tenant', 'provider_instability', 'declining:a->b', 0.9 - (i * 0.04), i < 10)
    record.createdAt = new Date(now + i * 1000)
    await store.store(record)
  }
  
  const insights = await analyzer.generateInsights('test-tenant')
  
  const decliningInsight = insights.find(i => 
    i.type === 'effectiveness_change' && 
    i.severity === 'warning'
  )
  
  assert.ok(decliningInsight)
  assert.ok(decliningInsight.message.includes('declining'))
})

test('MemoryInformedGovernanceEngine: enhances policy decision with memory', async () => {
  const memoryStore = new RuntimeMemoryStore()
  const policyStore = new PolicyStore()
  const policyEngine = new RuntimePolicyEngine(policyStore)
  const memoryEngine = new MemoryInformedGovernanceEngine(policyEngine, memoryStore)
  
  // Add learned successful strategy (need 20+ samples for >0.7 confidence)
  for (let i = 0; i < 25; i++) {
    await memoryStore.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:provider_a->provider_b', 0.9, true))
  }
  
  // Add policy rule
  await policyStore.addRule('test-tenant', {
    type: 'provider_stability',
    threshold: 0.5,
    action: 'reroute'
  })
  
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
      { name: 'process', provider: 'provider_b' }
    ]
  }
  
  const executionPlan: ExecutionPlan = {
    actions: [{ name: 'process', provider: 'provider_a' }]
  }
  
  const context: PolicyEvaluationContext = {
    tenantId: 'test-tenant',
    entityId: 'test-entity',
    executionContext: {} as any,
    model: testModel,
    executionPlan,
    providerStability: new Map([
      ['provider_a', 0.3],  // Unstable
      ['provider_b', 0.9]   // Stable
    ])
  }
  
  const decision = await memoryEngine.evaluateWithMemory(context)
  
  assert.ok(decision.memoryInformed)
  assert.ok(decision.memoryInformed.recommendedStrategy)
  assert.ok(decision.memoryInformed.effectiveness! > 0.5)
  // 25 samples should give good confidence (0.8)
  assert.ok(decision.memoryInformed.confidence! >= 0.8 && decision.memoryInformed.confidence! < 0.95)
  assert.ok(decision.rationale.some(r => r.includes('[LEARNED]')))
})

test('MemoryInformedGovernanceEngine: handles no historical data gracefully', async () => {
  const memoryStore = new RuntimeMemoryStore()
  const policyStore = new PolicyStore()
  const policyEngine = new RuntimePolicyEngine(policyStore)
  const memoryEngine = new MemoryInformedGovernanceEngine(policyEngine, memoryStore)
  
  const testModel: TenantModel = {
    entities: ['document'],
    states: ['draft'],
    events: [],
    transitions: [],
    actions: []
  }
  
  const context: PolicyEvaluationContext = {
    tenantId: 'new-tenant',
    entityId: 'test-entity',
    executionContext: {} as any,
    model: testModel,
    executionPlan: { actions: [] },
    entropy: 0.9
  }
  
  const decision = await memoryEngine.evaluateWithMemory(context)
  
  assert.ok(decision.memoryInformed)
  assert.ok(decision.memoryInformed.rationale)
  assert.ok(decision.memoryInformed.rationale.some(r => r.includes('No historical data')))
})

test('RuntimeMemoryStore: clears tenant data', async () => {
  const store = new RuntimeMemoryStore()
  
  await store.store(createMemoryRecord('test-tenant', 'provider_instability', 'reroute:a->b', 0.8, true))
  await store.store(createMemoryRecord('test-tenant', 'high_entropy', 'block', 0.7, true))
  
  let records = await store.getByTenant('test-tenant')
  assert.equal(records.length, 2)
  
  await store.clear('test-tenant')
  
  records = await store.getByTenant('test-tenant')
  assert.equal(records.length, 0)
})

test('StrategyEffectivenessAnalyzer: calculates learning confidence correctly', async () => {
  const store = new RuntimeMemoryStore()
  const analyzer = new StrategyEffectivenessAnalyzer(store)
  
  // Test low confidence (< 5 samples)
  for (let i = 0; i < 3; i++) {
    await store.store(createMemoryRecord('tenant-1', 'provider_instability', 'reroute:a->b', 0.8, true))
  }
  const profile1 = await analyzer.buildTenantProfile('tenant-1')
  assert.ok(profile1.learningConfidence < 0.5)
  
  // Test medium confidence (5-20 samples)
  for (let i = 0; i < 7; i++) {
    await store.store(createMemoryRecord('tenant-2', 'provider_instability', 'reroute:a->b', 0.8, true))
  }
  const profile2 = await analyzer.buildTenantProfile('tenant-2')
  assert.ok(profile2.learningConfidence >= 0.5 && profile2.learningConfidence < 0.8)
  
  // Test high confidence (50+ samples)
  for (let i = 0; i < 60; i++) {
    await store.store(createMemoryRecord('tenant-3', 'provider_instability', 'reroute:a->b', 0.8, true))
  }
  const profile3 = await analyzer.buildTenantProfile('tenant-3')
  assert.ok(profile3.learningConfidence >= 0.9)
})

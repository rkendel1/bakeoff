import { test } from 'node:test'
import assert from 'node:assert'
import { CanonicalTransitionGraph } from '../runtime/intelligence/CanonicalTransitionGraph.js'
import { ExecutionPatternAnalyzer } from '../runtime/intelligence/ExecutionPatternAnalyzer.js'
import { CanonicalInferenceEngine } from '../runtime/intelligence/CanonicalInferenceEngine.js'
import { DriftFromCanonicalAnalyzer } from '../runtime/intelligence/DriftFromCanonicalAnalyzer.js'
import { OperationalTopologyStore } from '../runtime/store/OperationalTopologyStore.js'
import type { ExecutionRecord } from '../runtime/store/execution-record.js'
import type { TenantModel } from '../models/tenant-model.js'
import type { ExecutionContext } from '../runtime/context/execution-context.js'

// Helper to create test execution records
function createTestExecution(
  id: string,
  entityId: string,
  fromState: string,
  toState: string,
  eventType: string,
  status: 'completed' | 'failed',
  actionName?: string,
  providerName?: string
): ExecutionRecord {
  const model: TenantModel = {
    entities: ['document'],
    states: ['draft', 'pending_signature', 'signed'],
    events: ['document.uploaded', 'signature.completed'],
    transitions: [],
    actions: []
  }

  const context: ExecutionContext = {
    tenantId: 'test-tenant',
    entityId,
    entityType: 'document',
    event: {
      tenantId: 'test-tenant',
      entityId,
      entityType: 'document',
      type: eventType,
      payload: {}
    },
    model,
    currentState: fromState,
    transitions: [],
    plannedActions: actionName && providerName ? [{ name: actionName, provider: providerName }] : [],
    emittedEvents: [],
    stateUpdates: [
      {
        entityId,
        fromState,
        toState,
        eventType,
        timestamp: new Date().toISOString()
      }
    ],
    trace: [
      {
        stage: 'APPLY',
        timestamp: new Date().toISOString()
      },
      ...(actionName && providerName
        ? [
            {
              stage: 'EXECUTE' as const,
              timestamp: new Date().toISOString()
            }
          ]
        : [])
    ]
  }

  return {
    id,
    tenantId: 'test-tenant',
    entityId,
    event: {
      tenantId: 'test-tenant',
      entityId,
      entityType: 'document',
      type: eventType,
      payload: {}
    },
    modelVersion: 'v1',
    status,
    contextSnapshot: context,
    createdAt: new Date(Date.now() - 1000),
    completedAt: new Date()
  }
}

test('CanonicalTransitionGraph: builds graph from executions', () => {
  const graph = new CanonicalTransitionGraph()

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e2', 'doc1', 'pending_signature', 'signed', 'signature.completed', 'completed'),
    createTestExecution('e3', 'doc2', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e4', 'doc2', 'pending_signature', 'signed', 'signature.completed', 'completed')
  ]

  graph.build(executions)

  const transitions = graph.getCanonicalTransitions()
  assert.equal(transitions.length, 2)
  assert.equal(transitions[0].executionCount >= 2, true)
  assert.equal(transitions[0].successRate, 1.0)
})

test('CanonicalTransitionGraph: calculates state centrality', () => {
  const graph = new CanonicalTransitionGraph()

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e2', 'doc1', 'pending_signature', 'signed', 'signature.completed', 'completed')
  ]

  graph.build(executions)

  const centrality = graph.getStateCentrality('pending_signature')
  assert.ok(centrality > 0)
  assert.ok(centrality <= 1)
})

test('CanonicalTransitionGraph: identifies most canonical transitions', () => {
  const graph = new CanonicalTransitionGraph()

  const executions: ExecutionRecord[] = [
    // Common path (5 times)
    ...Array.from({ length: 5 }, (_, i) =>
      createTestExecution(`e${i * 2}`, `doc${i}`, 'draft', 'pending_signature', 'document.uploaded', 'completed')
    ),
    // Rare path (1 time)
    createTestExecution('e99', 'doc99', 'draft', 'review', 'document.uploaded', 'completed')
  ]

  graph.build(executions)

  const mostCanonical = graph.getMostCanonicalFrom('draft')
  assert.ok(mostCanonical)
  assert.equal(mostCanonical.to, 'pending_signature') // Most common destination
})

test('ExecutionPatternAnalyzer: analyzes execution patterns', () => {
  const analyzer = new ExecutionPatternAnalyzer()

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e2', 'doc1', 'pending_signature', 'signed', 'signature.completed', 'completed'),
    createTestExecution('e3', 'doc2', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e4', 'doc2', 'pending_signature', 'signed', 'signature.completed', 'completed')
  ]

  const patterns = analyzer.analyzePatterns(executions)
  assert.ok(patterns.length > 0)
  assert.ok(patterns[0].frequency >= 1)
  assert.ok(patterns[0].successRate >= 0 && patterns[0].successRate <= 1)
})

test('ExecutionPatternAnalyzer: calculates execution entropy', () => {
  const analyzer = new ExecutionPatternAnalyzer()

  // Low entropy: all executions follow same path
  const lowEntropyExecutions: ExecutionRecord[] = Array.from({ length: 10 }, (_, i) =>
    createTestExecution(`e${i}`, `doc${i}`, 'draft', 'pending_signature', 'document.uploaded', 'completed')
  )

  const lowEntropy = analyzer.calculateExecutionEntropy(lowEntropyExecutions)
  assert.ok(lowEntropy >= 0 && lowEntropy <= 1)

  // High entropy: diverse execution paths
  const highEntropyExecutions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e2', 'doc2', 'draft', 'review', 'document.uploaded', 'completed'),
    createTestExecution('e3', 'doc3', 'draft', 'archived', 'document.uploaded', 'completed')
  ]

  const highEntropy = analyzer.calculateExecutionEntropy(highEntropyExecutions)
  assert.ok(highEntropy >= 0 && highEntropy <= 1)
  assert.ok(highEntropy > lowEntropy) // Diverse paths should have higher entropy
})

test('ExecutionPatternAnalyzer: identifies stable paths', () => {
  const analyzer = new ExecutionPatternAnalyzer()

  const executions: ExecutionRecord[] = [
    // Stable path (high frequency, high success)
    ...Array.from({ length: 5 }, (_, i) =>
      createTestExecution(`e${i}`, `doc${i}`, 'draft', 'pending_signature', 'document.uploaded', 'completed')
    ),
    // Unstable path (low frequency, failed)
    createTestExecution('e99', 'doc99', 'draft', 'review', 'document.uploaded', 'failed')
  ]

  const stablePaths = analyzer.getStablePaths(executions, 0.8, 2)
  assert.ok(stablePaths.length >= 1)
  assert.ok(stablePaths[0].successRate >= 0.8)
})

test('CanonicalInferenceEngine: generates topology snapshot', () => {
  const engine = new CanonicalInferenceEngine()

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed', 'send_for_signature', 'docuseal'),
    createTestExecution('e2', 'doc1', 'pending_signature', 'signed', 'signature.completed', 'completed'),
    createTestExecution('e3', 'doc2', 'draft', 'pending_signature', 'document.uploaded', 'completed', 'send_for_signature', 'docuseal'),
    createTestExecution('e4', 'doc2', 'pending_signature', 'signed', 'signature.completed', 'completed')
  ]

  const snapshot = engine.generateTopologySnapshot('test-tenant', executions)

  assert.equal(snapshot.tenantId, 'test-tenant')
  assert.ok(snapshot.canonicalStates.length > 0)
  assert.ok(snapshot.canonicalTransitions.length > 0)
  assert.ok(snapshot.dominantProviders.length > 0)
  assert.ok(snapshot.entropyScore >= 0 && snapshot.entropyScore <= 1)
  assert.ok(snapshot.operationalComplexity >= 0 && snapshot.operationalComplexity <= 1)
  assert.ok(snapshot.canonicalConfidence >= 0 && snapshot.canonicalConfidence <= 1)
})

test('CanonicalInferenceEngine: identifies dominant providers', () => {
  const engine = new CanonicalInferenceEngine()

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed', 'send_for_signature', 'docuseal'),
    createTestExecution('e2', 'doc2', 'draft', 'pending_signature', 'document.uploaded', 'completed', 'send_for_signature', 'docuseal'),
    createTestExecution('e3', 'doc3', 'draft', 'pending_signature', 'document.uploaded', 'completed', 'send_for_signature', 'docusign')
  ]

  const snapshot = engine.generateTopologySnapshot('test-tenant', executions)
  const dominantProvider = snapshot.dominantProviders.find((p) => p.action === 'send_for_signature')

  assert.ok(dominantProvider)
  assert.equal(dominantProvider.provider, 'docuseal') // Most used provider
  assert.ok(dominantProvider.usage > 0.5) // Majority usage
})

test('DriftFromCanonicalAnalyzer: detects unused transitions', () => {
  const analyzer = new DriftFromCanonicalAnalyzer()

  const model: TenantModel = {
    entities: ['document'],
    states: ['draft', 'pending_review', 'pending_signature', 'signed'],
    events: ['document.uploaded', 'review.completed', 'signature.completed'],
    transitions: [
      {
        entityType: 'document',
        fromState: 'draft',
        eventType: 'document.uploaded',
        toState: 'pending_review', // Defined but not used
        actions: []
      },
      {
        entityType: 'document',
        fromState: 'pending_review',
        eventType: 'review.completed',
        toState: 'pending_signature',
        actions: []
      }
    ],
    actions: []
  }

  const executions: ExecutionRecord[] = [
    // All executions skip review
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed'),
    createTestExecution('e2', 'doc2', 'draft', 'pending_signature', 'document.uploaded', 'completed')
  ]

  const drift = analyzer.analyzeDrift('test-tenant', model, executions)

  assert.equal(drift.driftDetected, true)
  assert.ok(drift.unusedTransitions.length > 0)
  assert.ok(drift.unusedTransitions.some((t) => t.includes('pending_review')))
})

test('DriftFromCanonicalAnalyzer: detects shadow transitions', () => {
  const analyzer = new DriftFromCanonicalAnalyzer()

  const model: TenantModel = {
    entities: ['document'],
    states: ['draft', 'pending_signature', 'signed'],
    events: ['document.uploaded', 'signature.completed'],
    transitions: [
      {
        entityType: 'document',
        fromState: 'draft',
        eventType: 'document.uploaded',
        toState: 'pending_review', // Model says go to review
        actions: []
      }
    ],
    actions: []
  }

  const executions: ExecutionRecord[] = [
    // But execution goes directly to signature
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed')
  ]

  const drift = analyzer.analyzeDrift('test-tenant', model, executions)

  assert.equal(drift.driftDetected, true)
  assert.ok(drift.shadowTransitions.length > 0)
  assert.ok(drift.shadowTransitions.some((t) => t.includes('pending_signature')))
})

test('DriftFromCanonicalAnalyzer: provides recommendations', () => {
  const analyzer = new DriftFromCanonicalAnalyzer()

  const model: TenantModel = {
    entities: ['document'],
    states: ['draft', 'pending_signature'],
    events: ['document.uploaded'],
    transitions: [
      {
        entityType: 'document',
        fromState: 'draft',
        eventType: 'document.uploaded',
        toState: 'pending_review', // Unused transition
        actions: []
      }
    ],
    actions: []
  }

  const executions: ExecutionRecord[] = [
    createTestExecution('e1', 'doc1', 'draft', 'pending_signature', 'document.uploaded', 'completed')
  ]

  const drift = analyzer.analyzeDrift('test-tenant', model, executions)

  assert.ok(drift.recommendations.length > 0)
  assert.ok(drift.recommendations.some((r) => r.toLowerCase().includes('unused')))
})

test('OperationalTopologyStore: stores and retrieves snapshots', async () => {
  const store = new OperationalTopologyStore()

  const snapshot = {
    tenantId: 'test-tenant',
    generatedAt: new Date().toISOString(),
    canonicalStates: [],
    canonicalTransitions: [],
    dominantProviders: [],
    stablePaths: [],
    entropyScore: 0.5,
    operationalComplexity: 0.3,
    canonicalConfidence: 0.8
  }

  await store.store(snapshot)

  const latest = await store.getLatest('test-tenant')
  assert.ok(latest)
  assert.equal(latest.tenantId, 'test-tenant')
  assert.equal(latest.entropyScore, 0.5)
})

test('OperationalTopologyStore: tracks evolution metrics', async () => {
  const store = new OperationalTopologyStore()

  // Store multiple snapshots with changing metrics
  await store.store({
    tenantId: 'test-tenant',
    generatedAt: new Date(Date.now() - 3000).toISOString(),
    canonicalStates: [],
    canonicalTransitions: [],
    dominantProviders: [],
    stablePaths: [],
    entropyScore: 0.8, // High entropy initially
    operationalComplexity: 0.7,
    canonicalConfidence: 0.3 // Low confidence
  })

  await store.store({
    tenantId: 'test-tenant',
    generatedAt: new Date(Date.now() - 2000).toISOString(),
    canonicalStates: [],
    canonicalTransitions: [],
    dominantProviders: [],
    stablePaths: [],
    entropyScore: 0.6,
    operationalComplexity: 0.5,
    canonicalConfidence: 0.5
  })

  await store.store({
    tenantId: 'test-tenant',
    generatedAt: new Date().toISOString(),
    canonicalStates: [],
    canonicalTransitions: [],
    dominantProviders: [],
    stablePaths: [],
    entropyScore: 0.3, // Low entropy now
    operationalComplexity: 0.2,
    canonicalConfidence: 0.9 // High confidence
  })

  const metrics = await store.getEvolutionMetrics('test-tenant')
  assert.ok(metrics)
  assert.equal(metrics.snapshotCount, 3)
  assert.equal(metrics.entropyTrend, 'decreasing')
  assert.equal(metrics.confidenceTrend, 'increasing')
})

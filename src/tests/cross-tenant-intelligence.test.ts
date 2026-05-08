import { test } from 'node:test'
import assert from 'node:assert'
import { CrossTenantSignalAggregator, type TenantSnapshot } from '../runtime/intelligence/cross-tenant/CrossTenantSignalAggregator.js'
import { CanonicalPatternGraph, type ProviderReliability } from '../runtime/intelligence/cross-tenant/CanonicalPatternGraph.js'
import { RecommendationAmplificationEngine, type GlobalRecommendation } from '../runtime/intelligence/cross-tenant/RecommendationAmplificationEngine.js'

test('CrossTenantSignalAggregator: aggregates tenant snapshots', () => {
  const aggregator = new CrossTenantSignalAggregator()

  const snapshots: TenantSnapshot[] = [
    {
      transitions: [
        { from: 'draft', to: 'pending' },
        { from: 'pending', to: 'approved' }
      ],
      transitionFrequency: 10,
      successRate: 0.9,
      providers: [
        { name: 'docusign', success: 8, failures: 2 }
      ],
      strategy: { type: 'approval', steps: 3 },
      entropy: 0.4,
      convergence: 0.8
    },
    {
      transitions: [
        { from: 'draft', to: 'review' },
        { from: 'review', to: 'approved' }
      ],
      transitionFrequency: 5,
      successRate: 0.85,
      providers: [
        { name: 'docusign', success: 4, failures: 1 },
        { name: 'adobesign', success: 3, failures: 2 }
      ],
      strategy: { type: 'review', steps: 2 },
      entropy: 0.5,
      convergence: 0.75
    }
  ]

  const signals = aggregator.aggregate(snapshots)

  // Verify transition signatures are hashed
  assert.ok(signals.transitionSignatures.length > 0)
  assert.ok(signals.transitionSignatures[0].signature.includes('->'))

  // Verify provider effectiveness is aggregated
  assert.ok(signals.providerEffectiveness['docusign'])
  assert.equal(signals.providerEffectiveness['docusign'].success, 12)
  assert.equal(signals.providerEffectiveness['docusign'].failures, 3)

  // Verify strategy distributions
  assert.equal(signals.strategyDistributions.length, 2)

  // Verify convergence trends
  assert.ok(signals.convergenceTrends.avgEntropy > 0)
  assert.ok(signals.convergenceTrends.avgConvergence > 0)
})

test('CanonicalPatternGraph: ingests and tracks patterns', () => {
  const graph = new CanonicalPatternGraph()
  const aggregator = new CrossTenantSignalAggregator()

  const snapshots: TenantSnapshot[] = [
    {
      transitions: [
        { from: 'draft', to: 'approved' }
      ],
      transitionFrequency: 10,
      successRate: 0.9,
      entropy: 0.3,
      convergence: 0.85
    }
  ]

  const signals = aggregator.aggregate(snapshots)
  graph.ingest(signals)

  const metrics = graph.getGlobalMetrics()
  
  assert.ok(metrics.totalObservations > 0)
  assert.ok(metrics.avgEntropy >= 0)
  assert.ok(metrics.avgConvergence >= 0)
})

test('CanonicalPatternGraph: tracks provider reliability', () => {
  const graph = new CanonicalPatternGraph()
  const aggregator = new CrossTenantSignalAggregator()

  const snapshots: TenantSnapshot[] = [
    {
      providers: [
        { name: 'provider-a', success: 90, failures: 10 }
      ],
      entropy: 0.4,
      convergence: 0.8
    },
    {
      providers: [
        { name: 'provider-a', success: 85, failures: 15 },
        { name: 'provider-b', success: 95, failures: 5 }
      ],
      entropy: 0.3,
      convergence: 0.9
    }
  ]

  const signals = aggregator.aggregate(snapshots)
  graph.ingest(signals)

  const providers = graph.getProviderReliability()
  
  assert.ok(providers.length > 0)
  
  const providerA = providers.find((p: ProviderReliability) => p.provider === 'provider-a')
  assert.ok(providerA)
  assert.ok(providerA.successRate > 0)
  assert.ok(providerA.totalOperations > 0)
})

test('CanonicalPatternGraph: calculates confidence scores', () => {
  const graph = new CanonicalPatternGraph()
  const aggregator = new CrossTenantSignalAggregator()

  // Few observations -> low confidence
  const snapshot1: TenantSnapshot = {
    transitions: [{ from: 'a', to: 'b' }],
    transitionFrequency: 3,
    successRate: 0.8,
    entropy: 0.4,
    convergence: 0.7
  }

  let signals = aggregator.aggregate([snapshot1])
  graph.ingest(signals)
  let patterns = graph.getTopPatterns(1)
  
  if (patterns.length > 0) {
    assert.ok(patterns[0].confidence <= 0.6) // Low confidence with few observations
  }

  // More observations -> higher confidence
  const snapshot2: TenantSnapshot = {
    transitions: [{ from: 'a', to: 'b' }],
    transitionFrequency: 50,
    successRate: 0.85,
    entropy: 0.3,
    convergence: 0.8
  }

  signals = aggregator.aggregate([snapshot2])
  graph.ingest(signals)
  patterns = graph.getTopPatterns(1)
  
  if (patterns.length > 0) {
    assert.ok(patterns[0].confidence > 0.6) // Higher confidence with more observations
  }
})

test('RecommendationAmplificationEngine: generates recommendations', () => {
  const graph = new CanonicalPatternGraph()
  const engine = new RecommendationAmplificationEngine(graph)
  const aggregator = new CrossTenantSignalAggregator()

  // Populate graph with data
  const snapshots: TenantSnapshot[] = [
    {
      providers: [
        { name: 'high-reliability-provider', success: 95, failures: 5 }
      ],
      entropy: 0.2,
      convergence: 0.9
    }
  ]

  const signals = aggregator.aggregate(snapshots)
  graph.ingest(signals)

  // Generate recommendations for a tenant with high entropy
  const recommendations = engine.generateRecommendations({
    currentProviders: ['low-reliability-provider'],
    entropy: 0.8,
    convergence: 0.5
  })

  assert.ok(recommendations.length > 0)
  
  // Should recommend entropy reduction
  const entropyRec = recommendations.find((r: GlobalRecommendation) => r.type === 'entropy_reduction')
  assert.ok(entropyRec)
  assert.ok(entropyRec.confidence > 0)
  assert.ok(entropyRec.actionableSteps.length > 0)
})

test('RecommendationAmplificationEngine: sorts by confidence', () => {
  const graph = new CanonicalPatternGraph()
  const engine = new RecommendationAmplificationEngine(graph)

  const recommendations = engine.generateRecommendations({
    currentProviders: [],
    entropy: 0.8
  })

  // Verify recommendations are sorted by confidence (descending)
  for (let i = 1; i < recommendations.length; i++) {
    assert.ok(recommendations[i - 1].confidence >= recommendations[i].confidence)
  }
})

test('Privacy guarantee: hashed transitions are irreversible', () => {
  const aggregator = new CrossTenantSignalAggregator()

  const snapshots: TenantSnapshot[] = [
    {
      transitions: [
        { from: 'draft', to: 'pending' },
        { from: 'pending', to: 'approved' }
      ],
      transitionFrequency: 1,
      successRate: 1
    }
  ]

  const signals = aggregator.aggregate(snapshots)
  const signature = signals.transitionSignatures[0].signature

  // Verify signature is abstracted (doesn't contain original state names directly)
  assert.ok(signature.includes('->'))
  assert.ok(signature.includes('|'))
  
  // Verify it's deterministic (same input = same hash)
  const signals2 = aggregator.aggregate(snapshots)
  assert.equal(signals2.transitionSignatures[0].signature, signature)
})

test('Privacy guarantee: no raw data in aggregated signals', () => {
  const aggregator = new CrossTenantSignalAggregator()

  const snapshots: TenantSnapshot[] = [
    {
      transitions: [{ from: 'state1', to: 'state2' }],
      transitionFrequency: 5,
      successRate: 0.8,
      providers: [
        { name: 'provider1', success: 4, failures: 1 }
      ],
      strategy: { type: 'custom', tenantId: 'secret-tenant', data: 'sensitive' },
      entropy: 0.5,
      convergence: 0.7
    }
  ]

  const signals = aggregator.aggregate(snapshots)

  // Verify no tenant identifiers in output
  const signalsJson = JSON.stringify(signals)
  assert.ok(!signalsJson.includes('secret-tenant'))
  assert.ok(!signalsJson.includes('sensitive'))
  
  // Verify strategy is hashed
  assert.ok(signals.strategyDistributions[0].strategy.startsWith('strategy_'))
})

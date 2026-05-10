import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BakeoffReasoning,
  type KernelReadBoundary,
  type KernelSnapshot
} from '../../../integration/bakeoff/reasoning/index.js'

function createSnapshot(): KernelSnapshot {
  return {
    version: 'snapshot-v1',
    graph: {
      nodes: [
        { id: 'provider.auth', capability: 'provider', status: 'failed', score: 0.2 },
        { id: 'workflow.signing', capability: 'workflow', status: 'degraded', score: 0.5 },
        { id: 'task.review', capability: 'task', status: 'degraded', score: 0.6 },
        { id: 'submission.42', capability: 'submission', status: 'failed', score: 0.3 },
        { id: 'document.9', capability: 'document', status: 'failed', score: 0.4 },
        { id: 'form.2', capability: 'form', status: 'healthy', score: 0.8 }
      ],
      edges: [
        { from: 'provider.auth', to: 'workflow.signing', relation: 'supports', weight: 0.95 },
        { from: 'workflow.signing', to: 'task.review', relation: 'drives', weight: 0.9 },
        { from: 'task.review', to: 'submission.42', relation: 'feeds', weight: 0.92 },
        { from: 'submission.42', to: 'document.9', relation: 'blocks', weight: 0.96 },
        { from: 'form.2', to: 'submission.42', relation: 'produces', weight: 0.4 }
      ]
    },
    simulationProjections: [
      {
        scenario: 'fallback-provider',
        outcomeDelta: 0.28,
        riskShift: -0.21,
        dependencyImpact: ['workflow.signing', 'task.review']
      }
    ],
    strategyProjections: [
      {
        strategyId: 'optimize-retries',
        predictedOutcome: 0.78,
        actualOutcome: 0.71,
        reliability: 0.82
      }
    ]
  }
}

class MockKernelBoundary implements KernelReadBoundary {
  constructor(private readonly snapshot: KernelSnapshot) {}

  readSnapshot(): Readonly<KernelSnapshot> {
    return this.snapshot
  }
}

test('Determinism: identical kernel snapshot produces identical reasoning output', () => {
  const boundary = new MockKernelBoundary(createSnapshot())
  const bakeoff = new BakeoffReasoning(boundary)

  const first = bakeoff.analyzeFailure('document.9')
  const second = bakeoff.analyzeFailure('document.9')

  assert.deepEqual(first, second)
})

test('Causal correctness: root cause follows graph lineage', () => {
  const boundary = new MockKernelBoundary(createSnapshot())
  const bakeoff = new BakeoffReasoning(boundary)

  const { result } = bakeoff.analyzeFailure('document.9')
  const rootCauseIds = result.rootCauses.map((node) => node.id).sort((a, b) => a.localeCompare(b))

  assert.deepEqual(rootCauseIds, ['form.2', 'provider.auth'])
  assert.ok(result.propagationPath.some((edge) => edge.from === 'provider.auth' && edge.to === 'workflow.signing'))
})

test('Isolation: reasoning does not mutate kernel state', () => {
  const snapshot = createSnapshot()
  const before = JSON.stringify(snapshot)
  const boundary = new MockKernelBoundary(snapshot)
  const bakeoff = new BakeoffReasoning(boundary)

  bakeoff.explainSystemState()
  bakeoff.generateHypotheses('document.9')
  bakeoff.analyzeDependencies()

  assert.equal(JSON.stringify(snapshot), before)
})

test('Counterfactual safety: no runtime execution calls are triggered', () => {
  const snapshot = createSnapshot()
  let runtimeCalls = 0

  class SafeBoundary extends MockKernelBoundary {
    runtimeCall(): void {
      runtimeCalls += 1
    }
  }

  const boundary = new SafeBoundary(snapshot)
  const bakeoff = new BakeoffReasoning(boundary)
  const { result } = bakeoff.simulateCounterfactual('fallback-provider')

  assert.equal(result.scenario, 'fallback-provider')
  assert.equal(runtimeCalls, 0)
})

test('Graph consistency: reasoning propagation paths match kernel graph edges', () => {
  const snapshot = createSnapshot()
  const boundary = new MockKernelBoundary(snapshot)
  const bakeoff = new BakeoffReasoning(boundary)
  const knownEdges = new Set(snapshot.graph.edges.map((edge) => `${edge.from}|${edge.to}|${edge.relation}`))

  const { result } = bakeoff.analyzeFailure('document.9')
  for (const edge of result.propagationPath) {
    assert.ok(knownEdges.has(`${edge.from}|${edge.to}|${edge.relation}`))
  }
})

test('Trace integrity: reasoning trace is reconstructable from recorded steps', () => {
  const boundary = new MockKernelBoundary(createSnapshot())
  const bakeoff = new BakeoffReasoning(boundary)

  const { trace } = bakeoff.generateHypotheses('document.9')
  const traversedFromSteps = trace.reasoningSteps
    .filter((step) => step.startsWith('traverse:'))
    .map((step) => step.replace('traverse:', ''))
    .sort((a, b) => a.localeCompare(b))

  const visited = [...trace.visitedNodes].sort((a, b) => a.localeCompare(b))

  assert.ok(trace.queryId.startsWith('generateHypotheses:'))
  assert.equal(trace.kernelSnapshotVersion, 'snapshot-v1')
  assert.ok(trace.reasoningSteps.includes('hypothesis:root:form.2'))
  assert.ok(trace.reasoningSteps.includes('hypothesis:root:provider.auth'))
  assert.ok(trace.reasoningSteps.includes('hypothesis:degradation-cluster'))
  assert.deepEqual(traversedFromSteps, visited)
})

#!/usr/bin/env tsx

/**
 * Demo: Emergent Canonical Intelligence
 * 
 * This demo showcases the intelligence layer that analyzes execution history
 * to provide evidence about operational behavior, helping tenants reconcile
 * their models (hypotheses) with observed execution patterns (evidence).
 */

import { CanonicalInferenceEngine } from './src/runtime/intelligence/CanonicalInferenceEngine.js'
import { DriftFromCanonicalAnalyzer } from './src/runtime/intelligence/DriftFromCanonicalAnalyzer.js'
import { OperationalTopologyStore } from './src/runtime/store/OperationalTopologyStore.js'
import type { TenantModel } from './src/models/tenant-model.js'
import type { ExecutionRecord } from './src/runtime/store/execution-record.js'
import type { RuntimeEvent } from './src/models/event.js'
import type { ExecutionContext } from './src/runtime/context/execution-context.js'

console.log('=== Emergent Canonical Intelligence Demo ===\n')

// Define the tenant's hypothesized workflow model
const tenantModel: TenantModel = {
  entities: ['document'],
  states: ['draft', 'pending_review', 'pending_signature', 'signed'],
  events: ['document.uploaded', 'review.completed', 'signature.completed'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'pending_review', // 👈 Tenant thinks documents go through review
      actions: ['send_for_review']
    },
    {
      entityType: 'document',
      fromState: 'pending_review',
      eventType: 'review.completed',
      toState: 'pending_signature',
      actions: ['send_for_signature']
    },
    {
      entityType: 'document',
      fromState: 'pending_signature',
      eventType: 'signature.completed',
      toState: 'signed',
      actions: []
    }
  ],
  actions: [
    {
      name: 'send_for_review',
      provider: 'internal'
    },
    {
      name: 'send_for_signature',
      provider: 'docuseal'
    }
  ]
}

console.log('📋 Tenant Model (Hypothesis):')
console.log('   States:', tenantModel.states.join(', '))
console.log('   Transitions:')
tenantModel.transitions.forEach((t) => {
  console.log(`   • ${t.fromState} --[${t.eventType}]--> ${t.toState}`)
})
console.log('')

// Simulate execution history where users bypass the review step
// This represents the EVIDENCE of what actually happens
const simulatedExecutions: ExecutionRecord[] = []

// Helper to create execution records
function createExecution(
  id: string,
  entityId: string,
  event: RuntimeEvent,
  fromState: string,
  toState: string,
  status: 'completed' | 'failed',
  provider?: { name: string; provider: string }
): ExecutionRecord {
  const context: ExecutionContext = {
    tenantId: 'demo',
    entityId,
    entityType: 'document',
    event,
    model: tenantModel,
    currentState: fromState,
    transitions: [],
    plannedActions: provider ? [provider] : [],
    emittedEvents: [],
    stateUpdates: [
      {
        entityId,
        fromState,
        toState,
        timestamp: new Date().toISOString()
      }
    ],
    trace: [
      {
        stage: 'APPLY',
        timestamp: new Date().toISOString(),
        context: {
          tenantId: 'demo',
          entityId,
          entityType: 'document',
          event,
          model: tenantModel,
          currentState: fromState,
          transitions: [],
          plannedActions: provider ? [provider] : [],
          emittedEvents: [],
          stateUpdates: [
            {
              entityId,
              fromState,
              toState,
              timestamp: new Date().toISOString()
            }
          ],
          trace: []
        }
      },
      ...(provider
        ? [
            {
              stage: 'EXECUTE' as const,
              timestamp: new Date().toISOString(),
              context: {
                tenantId: 'demo',
                entityId,
                entityType: 'document',
                event,
                model: tenantModel,
                currentState: fromState,
                transitions: [],
                plannedActions: [provider],
                emittedEvents: [],
                stateUpdates: [],
                trace: []
              }
            }
          ]
        : [])
    ]
  }

  return {
    id,
    tenantId: 'demo',
    entityId,
    event,
    modelVersion: 'v1',
    status,
    contextSnapshot: context,
    createdAt: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
    completedAt: new Date()
  }
}

// EVIDENCE: Most users go directly from draft to pending_signature (bypassing review)
console.log('🔬 Simulating Execution History (Evidence):\n')

// 45 successful direct paths: draft -> pending_signature -> signed
for (let i = 0; i < 45; i++) {
  const docId = `doc-${i + 1}`
  
  // draft -> pending_signature (bypassing review!)
  simulatedExecutions.push(
    createExecution(
      `exec-${i * 2 + 1}`,
      docId,
      {
        tenantId: 'demo',
        entityId: docId,
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      },
      'draft',
      'pending_signature', // 👈 EVIDENCE: Goes directly to signature
      'completed',
      { name: 'send_for_signature', provider: 'docuseal' }
    )
  )
  
  // pending_signature -> signed
  simulatedExecutions.push(
    createExecution(
      `exec-${i * 2 + 2}`,
      docId,
      {
        tenantId: 'demo',
        entityId: docId,
        entityType: 'document',
        type: 'signature.completed',
        payload: {}
      },
      'pending_signature',
      'signed',
      'completed'
    )
  )
}

// Only 3 executions actually used the review step
for (let i = 0; i < 3; i++) {
  const docId = `doc-review-${i + 1}`
  
  // draft -> pending_review
  simulatedExecutions.push(
    createExecution(
      `exec-review-${i * 3 + 1}`,
      docId,
      {
        tenantId: 'demo',
        entityId: docId,
        entityType: 'document',
        type: 'document.uploaded',
        payload: {}
      },
      'draft',
      'pending_review',
      'completed',
      { name: 'send_for_review', provider: 'internal' }
    )
  )
  
  // pending_review -> pending_signature
  simulatedExecutions.push(
    createExecution(
      `exec-review-${i * 3 + 2}`,
      docId,
      {
        tenantId: 'demo',
        entityId: docId,
        entityType: 'document',
        type: 'review.completed',
        payload: {}
      },
      'pending_review',
      'pending_signature',
      'completed',
      { name: 'send_for_signature', provider: 'docuseal' }
    )
  )
  
  // pending_signature -> signed
  simulatedExecutions.push(
    createExecution(
      `exec-review-${i * 3 + 3}`,
      docId,
      {
        tenantId: 'demo',
        entityId: docId,
        entityType: 'document',
        type: 'signature.completed',
        payload: {}
      },
      'pending_signature',
      'signed',
      'completed'
    )
  )
}

console.log(`   Total executions: ${simulatedExecutions.length}`)
console.log(`   Entities processed: ${new Set(simulatedExecutions.map((e) => e.entityId)).size}`)
console.log(`   Success rate: ${((simulatedExecutions.filter((e) => e.status === 'completed').length / simulatedExecutions.length) * 100).toFixed(1)}%`)
console.log('')

// 1. Canonical Inference
console.log('1️⃣  Canonical Inference')
console.log('   Analyzing execution history to identify operational patterns...\n')

const inferenceEngine = new CanonicalInferenceEngine()
const snapshot = inferenceEngine.generateTopologySnapshot('demo', simulatedExecutions)

console.log('   📊 Operational Topology Snapshot:')
console.log(`   • Generated at: ${snapshot.generatedAt}`)
console.log(`   • Entropy Score: ${snapshot.entropyScore.toFixed(2)} (${snapshot.entropyScore < 0.3 ? 'LOW - stable behavior' : 'HIGH - diverse behavior'})`)
console.log(`   • Operational Complexity: ${snapshot.operationalComplexity.toFixed(2)}`)
console.log(`   • Canonical Confidence: ${snapshot.canonicalConfidence.toFixed(2)} (${snapshot.canonicalConfidence > 0.85 ? 'HIGH confidence' : 'LOW confidence'})`)
console.log('')

console.log('   🎯 Canonical States (by centrality):')
snapshot.canonicalStates.slice(0, 3).forEach((state) => {
  console.log(`   • ${state.state}`)
  console.log(`     - Centrality: ${state.centrality.toFixed(2)}`)
  console.log(`     - Executions: ${state.executionCount}`)
})
console.log('')

console.log('   🔀 Canonical Transitions (by confidence):')
snapshot.canonicalTransitions.slice(0, 3).forEach((t) => {
  console.log(`   • ${t.from} --[${t.eventType}]--> ${t.to}`)
  console.log(`     - Confidence: ${t.confidence.toFixed(2)}`)
  console.log(`     - Executions: ${t.executionCount}`)
  console.log(`     - Success Rate: ${(t.successRate * 100).toFixed(1)}%`)
})
console.log('')

console.log('   🔧 Dominant Providers:')
snapshot.dominantProviders.forEach((p) => {
  console.log(`   • ${p.action} → ${p.provider}`)
  console.log(`     - Usage: ${(p.usage * 100).toFixed(1)}%`)
  console.log(`     - Success Rate: ${(p.successRate * 100).toFixed(1)}%`)
})
console.log('')

console.log('   🛤️  Stable Execution Paths:')
snapshot.stablePaths.slice(0, 2).forEach((path) => {
  console.log(`   • ${path.path.join(' → ')}`)
  console.log(`     - Frequency: ${path.frequency} executions`)
  console.log(`     - Success Rate: ${(path.successRate * 100).toFixed(1)}%`)
  console.log(`     - Avg Duration: ${path.averageDurationMs.toFixed(0)}ms`)
})
console.log('')

// 2. Drift Analysis
console.log('2️⃣  Drift Analysis')
console.log('   Comparing tenant model (hypothesis) with observed behavior (evidence)...\n')

const driftAnalyzer = new DriftFromCanonicalAnalyzer()
const driftAnalysis = driftAnalyzer.analyzeDrift('demo', tenantModel, simulatedExecutions)

console.log('   🔍 Drift Detection Results:')
console.log(`   • Drift Detected: ${driftAnalysis.driftDetected ? '⚠️  YES' : '✅ NO'}`)
console.log(`   • Entropy Score: ${driftAnalysis.entropyScore.toFixed(2)}`)
console.log('')

if (driftAnalysis.unusedTransitions.length > 0) {
  console.log('   ⚠️  Unused Transitions (defined in model, not observed):')
  driftAnalysis.unusedTransitions.forEach((t) => {
    console.log(`   • ${t}`)
  })
  console.log('')
}

if (driftAnalysis.shadowTransitions.length > 0) {
  console.log('   👻 Shadow Transitions (observed but not defined in model):')
  driftAnalysis.shadowTransitions.forEach((t) => {
    console.log(`   • ${t}`)
  })
  console.log('')
}

console.log('   💡 Recommendations:')
driftAnalysis.recommendations.forEach((rec, i) => {
  console.log(`   ${i + 1}. ${rec}`)
})
console.log('')

// 3. Store Topology for Evolution Tracking
console.log('3️⃣  Topology Storage')
console.log('   Storing snapshot for evolution tracking...\n')

const topologyStore = new OperationalTopologyStore()
await topologyStore.store(snapshot)

const latest = await topologyStore.getLatest('demo')
console.log(`   ✅ Stored snapshot for tenant: ${latest?.tenantId}`)
console.log(`   • Canonical confidence: ${latest?.canonicalConfidence.toFixed(2)}`)
console.log('')

// 4. Key Insights
console.log('4️⃣  Key Insights\n')

console.log('   📈 What the Evidence Shows:')
console.log(`   • ${((45 / 48) * 100).toFixed(1)}% of executions bypass the review step`)
console.log(`   • The dominant path is: draft → pending_signature → signed`)
console.log(`   • DocuSeal is the dominant provider (100% usage)`)
console.log(`   • Behavior has strongly converged (${snapshot.canonicalConfidence.toFixed(0)}% confidence)`)
console.log('')

console.log('   🤔 Hypothesis vs Evidence:')
console.log('   • Hypothesis (model): All documents must go through review')
console.log('   • Evidence (executions): 94% of documents skip review')
console.log('')

console.log('   🔄 Reconciliation Opportunity:')
console.log('   The runtime provides evidence that helps the tenant decide:')
console.log('   • Should the model be updated to match observed behavior?')
console.log('   • Or should enforcement be added to align behavior with intent?')
console.log('   • Is the review step truly necessary?')
console.log('')

console.log('   🎯 This is Emergent Canonical Intelligence:')
console.log('   • Models are hypotheses about how workflows should work')
console.log('   • Executions provide evidence of how workflows actually work')
console.log('   • The runtime helps reconcile the two')
console.log('   • Organizations can make data-driven decisions about their processes')
console.log('')

console.log('=== Demo Complete ===')

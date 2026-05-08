#!/usr/bin/env tsx

/**
 * Demo: Runtime Recommendation + Adaptive Optimization Engine
 * 
 * This demo showcases the adaptive runtime layer that transforms
 * execution evidence, canonical inference, and drift analysis into
 * actionable operational optimization intelligence.
 */

import { RecommendationEngine } from './src/runtime/intelligence/recommendation/RecommendationEngine.js'
import { ProviderReliabilityAnalyzer } from './src/runtime/intelligence/recommendation/ProviderReliabilityAnalyzer.js'
import { EntropyReductionAdvisor } from './src/runtime/intelligence/recommendation/EntropyReductionAdvisor.js'
import { CanonicalConvergenceAnalyzer } from './src/runtime/intelligence/recommendation/CanonicalConvergenceAnalyzer.js'
import { SuggestedModelPatchGenerator } from './src/runtime/intelligence/recommendation/SuggestedModelPatchGenerator.js'
import { DriftFromCanonicalAnalyzer } from './src/runtime/intelligence/DriftFromCanonicalAnalyzer.js'
import { OperationalTopologyStore } from './src/runtime/store/OperationalTopologyStore.js'
import { DurableExecutionQueue } from './src/runtime/queue/durable-execution-queue.js'
import type { TenantModel } from './src/models/tenant-model.js'
import type { ExecutionRecord } from './src/runtime/store/execution-record.js'
import type { RuntimeEvent } from './src/models/event.js'
import type { ExecutionContext } from './src/runtime/context/execution-context.js'

console.log('=== Runtime Recommendation + Adaptive Optimization Demo ===\n')

// Define the tenant's declared workflow model (the "hypothesis")
const tenantModel: TenantModel = {
  entities: ['document'],
  states: ['draft', 'review_pending', 'review_required', 'legal_review', 'approval_review', 'signature_pending', 'signed'],
  events: ['document.uploaded', 'review.completed', 'signature.completed'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'review_pending',
      actions: ['send_for_review']
    },
    {
      entityType: 'document',
      fromState: 'review_pending',
      eventType: 'review.completed',
      toState: 'review_required',
      actions: []
    },
    {
      entityType: 'document',
      fromState: 'review_required',
      eventType: 'review.completed',
      toState: 'legal_review',
      actions: []
    },
    {
      entityType: 'document',
      fromState: 'legal_review',
      eventType: 'review.completed',
      toState: 'approval_review',
      actions: []
    },
    {
      entityType: 'document',
      fromState: 'approval_review',
      eventType: 'review.completed',
      toState: 'signature_pending',
      actions: ['send_for_signature']
    },
    {
      entityType: 'document',
      fromState: 'signature_pending',
      eventType: 'signature.completed',
      toState: 'signed',
      actions: []
    }
  ],
  actions: [
    {
      name: 'send_for_review',
      provider: 'review_system'
    },
    {
      name: 'send_for_signature',
      provider: 'docuseal'
    }
  ]
}

// Helper to create simulated execution records
function createExecution(
  id: string,
  entityId: string,
  path: string[],
  events: string[],
  status: 'completed' | 'failed',
  provider?: string
): ExecutionRecord {
  const context: ExecutionContext = {
    tenantId: 'demo',
    entityId,
    entityType: 'document',
    event: {
      tenantId: 'demo',
      entityId,
      entityType: 'document',
      type: events[0],
      payload: {}
    },
    model: tenantModel,
    currentState: path[path.length - 1],
    transitions: [],
    plannedActions: provider ? [{ name: 'send_for_signature', provider }] : [],
    emittedEvents: [],
    stateUpdates: path.slice(0, -1).map((fromState, i) => ({
      entityId,
      fromState,
      toState: path[i + 1],
      eventType: events[Math.min(i, events.length - 1)],
      timestamp: new Date().toISOString()
    })),
    trace: [
      {
        stage: 'APPLY',
        timestamp: new Date().toISOString()
      }
    ]
  }

  return {
    id,
    tenantId: 'demo',
    entityId,
    event: {
      tenantId: 'demo',
      entityId,
      entityType: 'document',
      type: events[0],
      payload: {}
    },
    modelVersion: 'v1',
    status,
    contextSnapshot: context,
    createdAt: new Date(),
    completedAt: status === 'completed' ? new Date() : undefined
  }
}

// Simulate execution history where behavior differs from declared model
console.log('📊 Simulating Execution History')
console.log('-'.repeat(80))

// Most executions skip the review states and go directly to signature
const simulatedExecutions: ExecutionRecord[] = [
  // 47 executions follow the shadow transition (draft → signature_pending)
  ...Array.from({ length: 47 }, (_, i) =>
    createExecution(
      `exec-${i}`,
      `doc-${i}`,
      ['draft', 'signature_pending', 'signed'],
      ['document.uploaded', 'signature.completed'],
      'completed',
      i % 10 < 8 ? 'docuseal' : 'docusign' // 80% docuseal, 20% docusign
    )
  ),
  // Only 3 executions follow the declared review path
  createExecution(
    'exec-47',
    'doc-47',
    ['draft', 'review_pending', 'review_required', 'legal_review', 'approval_review', 'signature_pending', 'signed'],
    ['document.uploaded', 'review.completed', 'signature.completed'],
    'completed',
    'docuseal'
  ),
  createExecution(
    'exec-48',
    'doc-48',
    ['draft', 'review_pending', 'review_required', 'signature_pending', 'signed'],
    ['document.uploaded', 'review.completed', 'signature.completed'],
    'completed',
    'docuseal'
  ),
  createExecution(
    'exec-49',
    'doc-49',
    ['draft', 'review_pending', 'signature_pending', 'signed'],
    ['document.uploaded', 'review.completed', 'signature.completed'],
    'completed',
    'docuseal'
  )
]

console.log(`✓ Generated ${simulatedExecutions.length} execution records`)
console.log(`  - 47 executions: draft → signature_pending → signed (94%)`)
console.log(`  - 3 executions: various review paths (6%)`)
console.log('')

// 1. Provider Reliability Analysis
console.log('1️⃣  Provider Reliability Analysis')
console.log('-'.repeat(80))

const providerAnalyzer = new ProviderReliabilityAnalyzer()
const reliabilities = providerAnalyzer.analyzeProviders(simulatedExecutions)

console.log('   📊 Provider Reliability Metrics:')
for (const reliability of reliabilities) {
  const providerLabel = reliability.action 
    ? `${reliability.provider} (${reliability.action})`
    : reliability.provider

  console.log(`   • ${providerLabel}`)
  console.log(`     - Stability Score: ${reliability.stabilityScore.toFixed(2)} (${reliability.recommendation})`)
  console.log(`     - Failure Rate: ${(reliability.failureRate * 100).toFixed(1)}%`)
  console.log(`     - Execution Count: ${reliability.executionCount}`)
}
console.log('')

// 2. Entropy Reduction Analysis
console.log('2️⃣  Entropy Reduction Analysis')
console.log('-'.repeat(80))

const entropyAdvisor = new EntropyReductionAdvisor()
const entropyOpportunities = entropyAdvisor.analyzeEntropy(tenantModel, simulatedExecutions)

console.log('   🔍 Entropy Reduction Opportunities:')
for (const opp of entropyOpportunities) {
  console.log(`   • ${opp.type}: ${opp.description}`)
  console.log(`     - Severity: ${opp.severity}`)
  console.log(`     - Potential Entropy Reduction: ${(opp.potentialEntropyReduction * 100).toFixed(0)}%`)
  if (opp.affectedElements.length <= 5) {
    console.log(`     - Affected: ${opp.affectedElements.join(', ')}`)
  } else {
    console.log(`     - Affected: ${opp.affectedElements.length} elements`)
  }
}
console.log('')

// 3. Canonical Convergence Analysis
console.log('3️⃣  Canonical Convergence Analysis')
console.log('-'.repeat(80))

const topologyStore = new OperationalTopologyStore()
const convergenceAnalyzer = new CanonicalConvergenceAnalyzer(topologyStore)
const convergence = await convergenceAnalyzer.analyzeConvergence('demo', simulatedExecutions)

console.log('   📈 Convergence Metrics:')
console.log(`   • Convergence Score: ${convergence.convergenceScore.toFixed(2)} (${convergence.convergenceScore > 0.7 ? 'HIGH - converged' : 'LOW - divergent'})`)
console.log(`   • Dominant Path Coverage: ${(convergence.dominantPathCoverage * 100).toFixed(0)}% of executions`)
console.log(`   • Entropy Trend: ${convergence.entropyTrend === 0 ? 'stable' : convergence.entropyTrend < 0 ? 'decreasing (converging)' : 'increasing (diverging)'}`)
console.log(`   • Canonicalization Velocity: ${convergence.canonicalizationVelocity > 0 ? 'positive (stabilizing)' : convergence.canonicalizationVelocity < 0 ? 'negative (destabilizing)' : 'neutral'}`)
console.log('')

// 4. Suggested Model Patches
console.log('4️⃣  Suggested Model Patches')
console.log('-'.repeat(80))

const driftAnalyzer = new DriftFromCanonicalAnalyzer()
const driftAnalysis = driftAnalyzer.analyzeDrift('demo', tenantModel, simulatedExecutions)

const patchGenerator = new SuggestedModelPatchGenerator()
const patchSet = patchGenerator.generatePatchSet('demo', tenantModel, simulatedExecutions, driftAnalysis)

console.log('   🔧 Model Patch Summary:')
console.log(`   • Add Transitions: ${patchSet.summary.addTransitions}`)
console.log(`   • Remove Transitions: ${patchSet.summary.removeTransitions}`)
console.log(`   • Update Providers: ${patchSet.summary.updateProviders}`)
console.log(`   • Merge States: ${patchSet.summary.mergeStates}`)
console.log('')

console.log('   📝 Patches:')
for (const patch of patchSet.patches.slice(0, 3)) {
  console.log(`   • ${patch.operation}`)
  if (patch.target?.from && patch.target?.to) {
    console.log(`     ${patch.target.from} → ${patch.target.to} (${patch.target.event})`)
  } else if (patch.target?.transitionId) {
    console.log(`     Transition: ${patch.target.transitionId}`)
  } else if (patch.target?.states) {
    console.log(`     States: ${patch.target.states.join(', ')}`)
  }
  console.log(`     Reason: ${patch.reason}`)
}
console.log('')

// 5. Comprehensive Recommendations
console.log('5️⃣  Runtime Recommendations')
console.log('-'.repeat(80))

const recommendationEngine = new RecommendationEngine(topologyStore)
const recommendations = await recommendationEngine.generateRecommendations(
  'demo',
  tenantModel,
  simulatedExecutions,
  driftAnalysis,
  undefined,
  new DurableExecutionQueue()
)

console.log(`   ✨ Generated ${recommendations.length} recommendations (ranked by severity and confidence)`)
console.log('')

for (const rec of recommendations.slice(0, 3)) {
  const severityIcon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢'
  console.log(`   ${severityIcon} [${rec.severity.toUpperCase()}] ${rec.title}`)
  console.log(`      Confidence: ${(rec.confidence * 100).toFixed(0)}%`)
  console.log(`      ${rec.description}`)
  
  if (rec.suggestedAction) {
    console.log(`      Suggested: ${rec.suggestedAction.operation}`)
  }
  
  if (rec.estimatedImpact) {
    const impacts: string[] = []
    if (rec.estimatedImpact.complexityReduction) {
      impacts.push(`complexity ↓${(rec.estimatedImpact.complexityReduction * 100).toFixed(0)}%`)
    }
    if (rec.estimatedImpact.reliability) {
      impacts.push(`reliability ↑${(rec.estimatedImpact.reliability * 100).toFixed(0)}%`)
    }
    if (rec.estimatedImpact.entropyReduction) {
      impacts.push(`entropy ↓${(rec.estimatedImpact.entropyReduction * 100).toFixed(0)}%`)
    }
    if (impacts.length > 0) {
      console.log(`      Impact: ${impacts.join(', ')}`)
    }
  }
  console.log('')
}

// Final Summary
console.log('📋 Summary')
console.log('='.repeat(80))
console.log('')
console.log('The runtime has analyzed execution behavior and generated actionable intelligence:')
console.log('')
console.log(`Your operational model defines ${tenantModel.transitions.length} transitions across ${tenantModel.states.length} states,`)
console.log(`but ${(convergence.dominantPathCoverage * 100).toFixed(0)}% of successful executions converge into just a few dominant paths.`)
console.log('')
console.log(`${driftAnalysis.unusedTransitions.length} review states appear operationally dead.`)
console.log('')
console.log('Recommended actions:')
console.log('  • Formalize dominant shadow transition (draft → signature_pending)')
console.log('  • Remove unused review branch')
console.log('  • Reduce operational entropy by consolidating states')
console.log('')
console.log('Estimated impact:')
console.log(`  • Complexity reduction: ~${(entropyOpportunities.reduce((sum, opp) => sum + opp.potentialEntropyReduction, 0) * 100).toFixed(0)}%`)
console.log(`  • Canonical confidence: ${convergence.convergenceScore.toFixed(2)}`)
console.log(`  • Operational convergence: ${convergence.canonicalizationVelocity > 0 ? 'increasing' : 'stable'} over time`)
console.log('')
console.log('✅ The runtime is now adaptive and intelligent.')

#!/usr/bin/env node --experimental-specifier-resolution=node --no-warnings

/**
 * Demo: Runtime Memory + Learned Execution Strategies
 * 
 * Demonstrates the architectural evolution from:
 *   policy-driven governance
 * to:
 *   experience-informed adaptive governance
 * 
 * Shows:
 * 1. Recording governance outcomes in runtime memory
 * 2. Learning which strategies work best over time
 * 3. Building tenant operational profiles
 * 4. Memory-informed governance decisions
 * 5. Declining strategy detection
 * 6. Historical success rate analysis
 */

import { RuntimeMemoryStore } from './src/runtime/memory/RuntimeMemoryStore.js'
import { StrategyEffectivenessAnalyzer } from './src/runtime/memory/StrategyEffectivenessAnalyzer.js'
import { MemoryInformedGovernanceEngine } from './src/runtime/memory/MemoryInformedGovernanceEngine.js'
import { RuntimePolicyEngine } from './src/runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from './src/runtime/policy/PolicyStore.js'
import type { RuntimeMemoryRecord } from './src/runtime/memory/types.js'
import type { PolicyEvaluationContext, ExecutionPlan } from './src/runtime/policy/types.js'
import type { TenantModel } from './src/models/tenant-model.js'
import { randomUUID } from 'node:crypto'

console.log('━'.repeat(80))
console.log('Runtime Memory + Learned Execution Strategies Demo')
console.log('━'.repeat(80))
console.log()

// Create memory and policy infrastructure
const memoryStore = new RuntimeMemoryStore()
const policyStore = new PolicyStore()
const policyEngine = new RuntimePolicyEngine(policyStore)
const memoryEngine = new MemoryInformedGovernanceEngine(policyEngine, memoryStore)
const analyzer = new StrategyEffectivenessAnalyzer(memoryStore)

// Helper to create memory record
function createMemoryRecord(
  tenantId: string,
  triggerType: 'provider_instability' | 'high_entropy' | 'low_convergence' | 'canonical_drift',
  strategy: string,
  effectivenessScore: number,
  success: boolean,
  timestamp?: Date
): RuntimeMemoryRecord {
  return {
    id: randomUUID(),
    tenantId,
    trigger: {
      type: triggerType,
      context: {},
      timestamp: timestamp || new Date()
    },
    decision: {
      policyDecision: {
        allowed: true,
        rationale: []
      },
      enforcementActions: [],
      strategyApplied: strategy,
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
    createdAt: timestamp || new Date(),
    outcomeCapturedAt: new Date()
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Building Operational Memory
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 1: Building Operational Memory')
console.log('─'.repeat(80))
console.log()

console.log('Simulating 50 governance decisions over time...')
console.log()

// Add historical governance outcomes
// Strategy A: reroute:docuseal->docusign (high effectiveness)
for (let i = 0; i < 30; i++) {
  const timestamp = new Date(Date.now() - (50 - i) * 3600000) // Spread over last 50 hours
  await memoryStore.store(
    createMemoryRecord(
      'acme-corp',
      'provider_instability',
      'reroute:docuseal->docusign',
      0.85 + Math.random() * 0.1,  // 85-95% effective
      true,
      timestamp
    )
  )
}

// Strategy B: reroute:docuseal->adobesign (medium effectiveness)
for (let i = 0; i < 15; i++) {
  const timestamp = new Date(Date.now() - (50 - i) * 3600000)
  await memoryStore.store(
    createMemoryRecord(
      'acme-corp',
      'provider_instability',
      'reroute:docuseal->adobesign',
      0.65 + Math.random() * 0.1,  // 65-75% effective
      i % 3 !== 0,  // Some failures
      timestamp
    )
  )
}

// Strategy C: block (low effectiveness - defensive)
for (let i = 0; i < 5; i++) {
  const timestamp = new Date(Date.now() - (50 - i) * 3600000)
  await memoryStore.store(
    createMemoryRecord(
      'acme-corp',
      'provider_instability',
      'block',
      0.4 + Math.random() * 0.1,  // 40-50% effective
      false,
      timestamp
    )
  )
}

console.log('✓ Stored 50 governance decisions in runtime memory')
console.log()

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Learning Most Effective Strategies
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 2: Learning Most Effective Strategies')
console.log('─'.repeat(80))
console.log()

const patterns = await memoryStore.getMostEffectiveStrategies(
  'acme-corp',
  'provider_instability',
  3
)

console.log('Learned strategy effectiveness (ranked):')
console.log()

for (let i = 0; i < patterns.length; i++) {
  const pattern = patterns[i]
  console.log(`${i + 1}. ${pattern.strategyName}`)
  console.log(`   Effectiveness: ${(pattern.effectivenessScore * 100).toFixed(1)}%`)
  console.log(`   Success Rate: ${(pattern.successRate * 100).toFixed(1)}%`)
  console.log(`   Times Applied: ${pattern.timesApplied}`)
  console.log(`   Avg Retry Reduction: ${(pattern.averageRetryReduction * 100).toFixed(1)}%`)
  console.log(`   Avg Convergence Gain: ${(pattern.averageConvergenceGain * 100).toFixed(1)}%`)
  console.log(`   Recent Trend: ${pattern.recentTrend}`)
  console.log()
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Building Tenant Operational Profile
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 3: Building Tenant Operational Profile')
console.log('─'.repeat(80))
console.log()

const profile = await analyzer.buildTenantProfile('acme-corp')

console.log(`Tenant: ${profile.tenantId}`)
console.log(`Total Memory Records: ${profile.totalMemoryRecords}`)
console.log(`Learning Confidence: ${(profile.learningConfidence * 100).toFixed(0)}%`)
console.log()

console.log('Preferred Strategies:')
for (const pref of profile.preferredStrategies) {
  console.log(`  • ${pref.strategy}`)
  console.log(`    Effectiveness: ${(pref.effectivenessScore * 100).toFixed(1)}%`)
  console.log(`    Confidence: ${(pref.confidence * 100).toFixed(0)}%`)
}
console.log()

console.log('Common Triggers:')
for (const trigger of profile.commonTriggers) {
  console.log(`  • ${trigger.triggerType}: ${trigger.frequency} occurrences`)
  console.log(`    Last: ${trigger.lastOccurred.toLocaleString()}`)
}
console.log()

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Memory-Informed Governance Decision
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 4: Memory-Informed Governance Decision')
console.log('─'.repeat(80))
console.log()

// Add policy rule
await policyStore.addRule('acme-corp', {
  type: 'provider_stability',
  threshold: 0.5,
  action: 'reroute'
})

const testModel: TenantModel = {
  entities: ['document'],
  states: ['draft', 'pending_signature', 'signed'],
  events: ['document.uploaded', 'signature.completed'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'pending_signature',
      actions: ['send_for_signature']
    }
  ],
  actions: [
    { name: 'send_for_signature', provider: 'docuseal' },
    { name: 'send_for_signature', provider: 'docusign' },
    { name: 'send_for_signature', provider: 'adobesign' }
  ]
}

const executionPlan: ExecutionPlan = {
  actions: [{ name: 'send_for_signature', provider: 'docuseal' }]
}

const context: PolicyEvaluationContext = {
  tenantId: 'acme-corp',
  entityId: 'doc-123',
  executionContext: {} as any,
  model: testModel,
  executionPlan,
  providerStability: new Map([
    ['docuseal', 0.35],      // Unstable
    ['docusign', 0.92],      // Stable
    ['adobesign', 0.78]      // Stable
  ])
}

console.log('Input Context:')
console.log(`  Tenant: ${context.tenantId}`)
console.log(`  Provider Stability:`)
console.log(`    • docuseal: 0.35 (unstable)`)
console.log(`    • docusign: 0.92 (stable)`)
console.log(`    • adobesign: 0.78 (stable)`)
console.log()

const decision = await memoryEngine.evaluateWithMemory(context)

console.log('Policy Decision:')
console.log(`  Allowed: ${decision.allowed}`)
console.log(`  Modified Plan: ${decision.modifiedExecutionPlan ? 'Yes' : 'No'}`)
if (decision.modifiedExecutionPlan) {
  console.log(`  New Provider: ${decision.modifiedExecutionPlan.actions[0].provider}`)
}
console.log()

console.log('Memory-Informed Insights:')
if (decision.memoryInformed) {
  if (decision.memoryInformed.recommendedStrategy) {
    console.log(`  Recommended Strategy: ${decision.memoryInformed.recommendedStrategy}`)
    console.log(`  Historical Effectiveness: ${(decision.memoryInformed.effectiveness! * 100).toFixed(1)}%`)
    console.log(`  Confidence: ${(decision.memoryInformed.confidence! * 100).toFixed(0)}%`)
    console.log(`  Success Rate: ${(decision.memoryInformed.historicalSuccessRate! * 100).toFixed(1)}%`)
    console.log()
  }
  
  console.log('  Rationale:')
  for (const reason of decision.memoryInformed.rationale) {
    console.log(`    • ${reason}`)
  }
}
console.log()

console.log('Full Decision Rationale:')
for (const reason of decision.rationale) {
  console.log(`  • ${reason}`)
}
console.log()

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Strategy Recommendation
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 5: Strategy Recommendation')
console.log('─'.repeat(80))
console.log()

const recommendation = await analyzer.recommendStrategy('acme-corp', 'provider_instability')

if (recommendation) {
  console.log('Runtime Recommendation:')
  console.log(`  Strategy: ${recommendation.strategy}`)
  console.log(`  Effectiveness: ${(recommendation.effectivenessScore * 100).toFixed(1)}%`)
  console.log(`  Confidence: ${(recommendation.confidence * 100).toFixed(0)}%`)
  console.log()
  console.log('Historical Data:')
  console.log(`  Times Applied: ${recommendation.historicalData.timesApplied}`)
  console.log(`  Success Rate: ${(recommendation.historicalData.successRate * 100).toFixed(1)}%`)
  console.log(`  Avg Retry Reduction: ${(recommendation.historicalData.avgRetryReduction * 100).toFixed(1)}%`)
  console.log()
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Detecting Declining Strategies
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 6: Detecting Declining Strategies')
console.log('─'.repeat(80))
console.log()

// Add a declining strategy
console.log('Simulating a strategy that starts good but declines...')
for (let i = 0; i < 20; i++) {
  const timestamp = new Date(Date.now() - (20 - i) * 1800000) // Spread over last 10 hours
  const effectiveness = 0.9 - (i * 0.03)  // Starts at 90%, declines to 33%
  await memoryStore.store(
    createMemoryRecord(
      'beta-corp',
      'high_entropy',
      'restrict_branching',
      effectiveness,
      effectiveness > 0.5,
      timestamp
    )
  )
}
console.log()

const insights = await analyzer.generateInsights('beta-corp')

console.log('Generated Insights:')
for (const insight of insights) {
  const severityEmoji = insight.severity === 'warning' ? '⚠️' : insight.severity === 'critical' ? '🔴' : 'ℹ️'
  console.log(`  ${severityEmoji} [${insight.type}] ${insight.message}`)
}
console.log()

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7: Comparing Before and After
// ═══════════════════════════════════════════════════════════════════════════════

console.log('▸ SCENARIO 7: The Architectural Evolution')
console.log('─'.repeat(80))
console.log()

console.log('BEFORE: Policy-Driven Governance')
console.log('  • Runtime evaluates: "Can this transition execute?"')
console.log('  • Decisions based on: current conditions + static rules')
console.log('  • No learning from outcomes')
console.log('  • Every execution evaluated in isolation')
console.log()

console.log('AFTER: Experience-Informed Adaptive Governance')
console.log('  • Runtime evaluates: "Should this transition execute right now?"')
console.log('  • Decisions based on: current conditions + learned strategies')
console.log('  • Continuous learning from outcomes')
console.log('  • Historical effectiveness informs future decisions')
console.log()

console.log('The Key Shift:')
console.log('  When provider instability occurs,')
console.log('  the runtime now knows:')
console.log()
console.log('  "Historically, rerouting docuseal → docusign')
console.log('   has 92% effectiveness and reduced retry rates by 63%"')
console.log()
console.log('  This is not just governance.')
console.log('  This is operational intuition.')
console.log()

console.log('━'.repeat(80))
console.log('Demo Complete')
console.log('━'.repeat(80))

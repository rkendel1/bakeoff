#!/usr/bin/env node --experimental-specifier-resolution=node --no-warnings

/**
 * Demo: Intent Layer + Goal-Oriented Runtime Planning
 * 
 * Demonstrates the architectural evolution from:
 *   adaptive execution engine
 * to:
 *   goal-oriented operational cognition runtime
 * 
 * Shows:
 * 1. Defining operational goals
 * 2. Registering strategies for goals
 * 3. Selecting best strategy based on historical data
 * 4. Generating adaptive execution plans
 * 5. Intent-aware governance decisions
 * 6. Goal completion tracking
 * 7. Strategy effectiveness evaluation
 */

import { IntentGraph } from './src/runtime/intent/IntentGraph.js'
import { IntentStore } from './src/runtime/intent/IntentStore.js'
import { GoalExecutionStore } from './src/runtime/intent/GoalExecutionStore.js'
import { StrategyOutcomeStore } from './src/runtime/intent/StrategyOutcomeStore.js'
import { GoalPlanner } from './src/runtime/intent/GoalPlanner.js'
import { StrategyGraph } from './src/runtime/intent/StrategyGraph.js'
import { GoalOutcomeEvaluator } from './src/runtime/intent/GoalOutcomeEvaluator.js'
import { IntentAwareGovernanceEngine } from './src/runtime/intent/IntentAwareGovernanceEngine.js'
import { OperationalPlanSynthesizer } from './src/runtime/intent/OperationalPlanSynthesizer.js'
import { RuntimePolicyEngine } from './src/runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from './src/runtime/policy/PolicyStore.js'
import type { GoalDefinition, StrategyDefinition, GoalOutcome } from './src/runtime/intent/types.js'

console.log('═══════════════════════════════════════════════════════════')
console.log('   Intent Layer + Goal-Oriented Runtime Planning Demo')
console.log('═══════════════════════════════════════════════════════════\n')

// Initialize stores
const intentGraph = new IntentGraph()
const intentStore = new IntentStore()
const goalExecutionStore = new GoalExecutionStore()
const strategyOutcomeStore = new StrategyOutcomeStore()

// Initialize components
const goalPlanner = new GoalPlanner(intentGraph, strategyOutcomeStore)
const strategyGraph = new StrategyGraph(intentGraph)
const goalOutcomeEvaluator = new GoalOutcomeEvaluator(
  strategyOutcomeStore,
  intentGraph
)
const policyEngine = new RuntimePolicyEngine(new PolicyStore())
const intentAwareGovernance = new IntentAwareGovernanceEngine(
  policyEngine,
  intentGraph,
  goalOutcomeEvaluator
)
const planSynthesizer = new OperationalPlanSynthesizer(
  intentGraph,
  strategyGraph,
  goalOutcomeEvaluator
)

// ============================================================================
// STEP 1: Define Operational Goal
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 1: Define Operational Goal')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const goal: GoalDefinition = {
  id: 'goal-signed-contract',
  tenantId: 'acme-corp',
  goal: 'obtain_signed_contract',
  description: 'Achieve fully signed contract state',
  successCriteria: [
    'document.state == signed',
    'all_parties_signed == true'
  ],
  priority: 'high',
  operationalStrategies: [
    'docusign_fast_path',
    'docuseal_standard_path',
    'manual_review_flow'
  ],
  createdAt: new Date(),
  updatedAt: new Date()
}

intentGraph.registerGoal(goal)
await intentStore.storeGoal(goal)

console.log('✅ Goal defined:')
console.log(`   Goal: ${goal.goal}`)
console.log(`   Priority: ${goal.priority}`)
console.log(`   Success criteria: ${goal.successCriteria.join(', ')}`)
console.log(`   Available strategies: ${goal.operationalStrategies.length}`)
console.log()

// ============================================================================
// STEP 2: Register Operational Strategies
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 2: Register Operational Strategies')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const strategies: StrategyDefinition[] = [
  {
    id: 'strategy-docusign',
    strategyName: 'docusign_fast_path',
    goalId: goal.id,
    tenantId: 'acme-corp',
    description: 'Fast path using DocuSign provider',
    requiredTransitions: [
      {
        from: 'draft',
        to: 'pending_signature',
        event: 'document.submitted_for_signature'
      },
      {
        from: 'pending_signature',
        to: 'signed',
        event: 'document.all_signed'
      }
    ],
    requiredProviders: [
      {
        action: 'send_for_signature',
        provider: 'docusign',
        alternateProviders: ['docuseal', 'adobe_sign']
      },
      {
        action: 'verify_signatures',
        provider: 'docusign',
        alternateProviders: ['manual']
      }
    ],
    fallbackStrategy: 'manual_review_flow',
    expectedExecutionTimeMs: 5000,
    expectedRetryRate: 0.05,
    expectedConvergence: 0.95,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'strategy-docuseal',
    strategyName: 'docuseal_standard_path',
    goalId: goal.id,
    tenantId: 'acme-corp',
    description: 'Standard path using DocuSeal provider',
    requiredTransitions: [
      {
        from: 'draft',
        to: 'pending_signature',
        event: 'document.submitted_for_signature'
      },
      {
        from: 'pending_signature',
        to: 'signed',
        event: 'document.all_signed'
      }
    ],
    requiredProviders: [
      {
        action: 'send_for_signature',
        provider: 'docuseal',
        alternateProviders: ['docusign']
      }
    ],
    fallbackStrategy: 'manual_review_flow',
    expectedExecutionTimeMs: 7000,
    expectedRetryRate: 0.08,
    expectedConvergence: 0.90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'strategy-manual',
    strategyName: 'manual_review_flow',
    goalId: goal.id,
    tenantId: 'acme-corp',
    description: 'Manual review and approval flow',
    requiredTransitions: [
      {
        from: 'draft',
        to: 'pending_review',
        event: 'document.submitted_for_review'
      },
      {
        from: 'pending_review',
        to: 'signed',
        event: 'document.manually_approved'
      }
    ],
    requiredProviders: [
      {
        action: 'manual_review',
        provider: 'manual'
      }
    ],
    expectedExecutionTimeMs: 20000,
    expectedRetryRate: 0.02,
    expectedConvergence: 0.85,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

for (const strategy of strategies) {
  intentGraph.registerStrategy(strategy)
  await intentStore.storeStrategy(strategy)
  console.log(`✅ Strategy registered: ${strategy.strategyName}`)
  console.log(`   Transitions: ${strategy.requiredTransitions.length}`)
  console.log(`   Providers: ${strategy.requiredProviders.length}`)
  console.log(`   Expected time: ${strategy.expectedExecutionTimeMs}ms`)
  console.log()
}

// ============================================================================
// STEP 3: Simulate Historical Outcomes
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 3: Simulate Historical Outcomes')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('Simulating 100 historical goal executions...\n')

// Simulate outcomes for DocuSign strategy (high success rate)
for (let i = 0; i < 60; i++) {
  const outcome: GoalOutcome = {
    id: `outcome-docusign-${i}`,
    intentId: `intent-${i}`,
    goalId: goal.id,
    tenantId: 'acme-corp',
    entityId: `doc-${i}`,
    strategyUsed: 'docusign_fast_path',
    fallbacksAttempted: [],
    executionId: `exec-${i}`,
    executionStatus: i < 57 ? 'completed' : 'failed',
    goalAchieved: i < 57,
    criteriaResults: [
      { criterion: 'document.state == signed', satisfied: i < 57 },
      { criterion: 'all_parties_signed == true', satisfied: i < 57 }
    ],
    totalExecutionTimeMs: 4800 + Math.random() * 1000,
    retryCount: i < 57 ? 0 : 1,
    providerFailures: i < 57 ? 0 : 1,
    strategyEffectiveness: {
      score: i < 57 ? 0.92 : 0.4,
      factors: {
        goalAchieved: i < 57,
        executionEfficiency: i < 57 ? 0.95 : 0.5,
        recoveryEffectiveness: 0.8,
        timeEfficiency: i < 57 ? 0.9 : 0.3
      }
    },
    startedAt: new Date(Date.now() - (100 - i) * 86400000),
    completedAt: new Date(Date.now() - (100 - i) * 86400000 + 5000)
  }
  await strategyOutcomeStore.storeOutcome(outcome)
}

// Simulate outcomes for DocuSeal strategy (medium success rate)
for (let i = 0; i < 30; i++) {
  const outcome: GoalOutcome = {
    id: `outcome-docuseal-${i}`,
    intentId: `intent-ds-${i}`,
    goalId: goal.id,
    tenantId: 'acme-corp',
    entityId: `doc-ds-${i}`,
    strategyUsed: 'docuseal_standard_path',
    fallbacksAttempted: [],
    executionId: `exec-ds-${i}`,
    executionStatus: i < 25 ? 'completed' : 'failed',
    goalAchieved: i < 25,
    criteriaResults: [
      { criterion: 'document.state == signed', satisfied: i < 25 },
      { criterion: 'all_parties_signed == true', satisfied: i < 25 }
    ],
    totalExecutionTimeMs: 6800 + Math.random() * 1500,
    retryCount: i < 25 ? 0 : 2,
    providerFailures: i < 25 ? 0 : 1,
    strategyEffectiveness: {
      score: i < 25 ? 0.85 : 0.35,
      factors: {
        goalAchieved: i < 25,
        executionEfficiency: i < 25 ? 0.88 : 0.45,
        recoveryEffectiveness: 0.7,
        timeEfficiency: i < 25 ? 0.82 : 0.25
      }
    },
    startedAt: new Date(Date.now() - (100 - i) * 86400000),
    completedAt: new Date(Date.now() - (100 - i) * 86400000 + 7000)
  }
  await strategyOutcomeStore.storeOutcome(outcome)
}

// Simulate outcomes for Manual strategy (lower success rate but reliable)
for (let i = 0; i < 10; i++) {
  const outcome: GoalOutcome = {
    id: `outcome-manual-${i}`,
    intentId: `intent-m-${i}`,
    goalId: goal.id,
    tenantId: 'acme-corp',
    entityId: `doc-m-${i}`,
    strategyUsed: 'manual_review_flow',
    fallbacksAttempted: [],
    executionId: `exec-m-${i}`,
    executionStatus: i < 8 ? 'completed' : 'failed',
    goalAchieved: i < 8,
    criteriaResults: [
      { criterion: 'document.state == signed', satisfied: i < 8 },
      { criterion: 'all_parties_signed == true', satisfied: i < 8 }
    ],
    totalExecutionTimeMs: 18000 + Math.random() * 4000,
    retryCount: 0,
    providerFailures: 0,
    strategyEffectiveness: {
      score: i < 8 ? 0.78 : 0.3,
      factors: {
        goalAchieved: i < 8,
        executionEfficiency: i < 8 ? 0.75 : 0.4,
        recoveryEffectiveness: 0.9,
        timeEfficiency: i < 8 ? 0.6 : 0.2
      }
    },
    startedAt: new Date(Date.now() - (100 - i) * 86400000),
    completedAt: new Date(Date.now() - (100 - i) * 86400000 + 20000)
  }
  await strategyOutcomeStore.storeOutcome(outcome)
}

console.log('✅ Historical outcomes simulated:')
const stats = strategyOutcomeStore.getStats()
console.log(`   Total outcomes: ${stats.totalOutcomes}`)
console.log(`   Successful: ${stats.successfulOutcomes} (${(stats.successfulOutcomes / stats.totalOutcomes * 100).toFixed(1)}%)`)
console.log(`   Average execution time: ${stats.averageExecutionTimeMs.toFixed(0)}ms`)
console.log()

// ============================================================================
// STEP 4: Select Best Strategy for Goal
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 4: Select Best Strategy for Goal')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const strategySelection = await goalPlanner.selectStrategy('acme-corp', goal.id)

console.log('✅ Strategy selected:')
console.log(`   Selected: ${strategySelection.selectedStrategy}`)
console.log(`   Confidence: ${(strategySelection.confidence * 100).toFixed(1)}%`)
console.log(`   Expected success: ${(strategySelection.expectedSuccessProbability * 100).toFixed(1)}%`)
console.log(`   Expected time: ${strategySelection.expectedExecutionTimeMs.toFixed(0)}ms`)
console.log()
console.log('Reasoning:')
for (const reason of strategySelection.rationale) {
  console.log(`   ${reason}`)
}
console.log()
console.log('Fallback strategies:')
for (const fallback of strategySelection.fallbackStrategies) {
  console.log(`   - ${fallback.strategy} (confidence: ${(fallback.confidence * 100).toFixed(1)}%)`)
}
console.log()

// ============================================================================
// STEP 5: Evaluate Goal Completion Rate
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 5: Evaluate Goal Completion Rate')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const completionRate = await goalOutcomeEvaluator.evaluateGoalCompletionRate(
  'acme-corp',
  goal.id
)

console.log('✅ Goal completion metrics:')
console.log(`   Total attempts: ${completionRate.totalAttempts}`)
console.log(`   Successful: ${completionRate.successfulCompletions}`)
console.log(`   Completion rate: ${(completionRate.completionRate * 100).toFixed(1)}%`)
console.log()
console.log('Strategy performance breakdown:')
for (const perf of completionRate.strategyPerformance) {
  console.log(`   ${perf.strategy}:`)
  console.log(`     Attempts: ${perf.attempts}`)
  console.log(`     Success rate: ${(perf.successRate * 100).toFixed(1)}%`)
  console.log(`     Effectiveness: ${(perf.effectiveness * 100).toFixed(1)}%`)
}
console.log()

// ============================================================================
// STEP 6: Evaluate Strategy Effectiveness
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('STEP 6: Evaluate Strategy Effectiveness')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

for (const strategy of strategies) {
  const metrics = await goalOutcomeEvaluator.evaluateStrategyEffectiveness(
    'acme-corp',
    goal.id,
    strategy.strategyName
  )
  
  console.log(`Strategy: ${strategy.strategyName}`)
  console.log(`   Attempts: ${metrics.totalAttempts}`)
  console.log(`   Success rate: ${(metrics.successRate * 100).toFixed(1)}%`)
  console.log(`   Effectiveness: ${(metrics.effectivenessScore * 100).toFixed(1)}%`)
  console.log(`   Avg execution time: ${metrics.averageExecutionTimeMs.toFixed(0)}ms`)
  console.log(`   Avg retries: ${metrics.averageRetries.toFixed(1)}`)
  console.log(`   Trend: ${metrics.recentTrend}`)
  console.log(`   Confidence: ${(metrics.confidence * 100).toFixed(1)}%`)
  console.log()
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('SUMMARY: Goal-Oriented Runtime Intelligence')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('The runtime now operates with goal-oriented intelligence:')
console.log()
console.log('✅ Goals define operational objectives')
console.log('✅ Strategies are evaluated by historical effectiveness')
console.log('✅ Planning is adaptive and learned')
console.log('✅ Governance considers goal completion probability')
console.log('✅ Execution is outcome-oriented rather than workflow-oriented')
console.log()
console.log('This is the transformation from:')
console.log('   "Execute this workflow" (reactive)')
console.log('to:')
console.log('   "Achieve this goal adaptively" (strategic)')
console.log()
console.log('═══════════════════════════════════════════════════════════')

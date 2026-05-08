#!/usr/bin/env node --experimental-specifier-resolution=node --no-warnings

/**
 * Demo: Predictive Runtime Intelligence & Failure Forecasting
 * 
 * Demonstrates the architectural evolution from:
 *   observe → adapt
 * to:
 *   predict → prevent → optimize
 * 
 * Shows:
 * 1. Strategy decay detection
 * 2. Failure trajectory analysis
 * 3. Goal completion forecasting
 * 4. Entropy trajectory forecasting
 * 5. Comprehensive risk assessment
 * 6. Predictive governance decisions
 * 7. Forecast accuracy tracking
 */

import { StrategyOutcomeStore } from './src/runtime/intent/StrategyOutcomeStore.js'
import { IntentGraph } from './src/runtime/intent/IntentGraph.js'
import { GoalPlanner } from './src/runtime/intent/GoalPlanner.js'
import { RuntimeMemoryStore } from './src/runtime/memory/RuntimeMemoryStore.js'
import { OperationalTopologyStore } from './src/runtime/store/OperationalTopologyStore.js'
import { StrategyDecayDetector } from './src/runtime/predictive/StrategyDecayDetector.js'
import { FailureTrajectoryAnalyzer } from './src/runtime/predictive/FailureTrajectoryAnalyzer.js'
import { GoalCompletionForecaster } from './src/runtime/predictive/GoalCompletionForecaster.js'
import { EntropyTrajectoryForecaster } from './src/runtime/predictive/EntropyTrajectoryForecaster.js'
import { PredictiveRiskEngine } from './src/runtime/predictive/PredictiveRiskEngine.js'
import { PredictiveGovernanceEngine } from './src/runtime/predictive/PredictiveGovernanceEngine.js'
import { RuntimeForecastStore } from './src/runtime/predictive/RuntimeForecastStore.js'
import { RuntimePolicyEngine } from './src/runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from './src/runtime/policy/PolicyStore.js'
import type { GoalOutcome } from './src/runtime/intent/types.js'
import type { OperationalTopologySnapshot } from './src/runtime/intelligence/types.js'

// Logging utilities
const log = {
  section: (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`),
  subsection: (title: string) => console.log(`\n${title}\n${'-'.repeat(40)}`),
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  data: (label: string, value: any) => console.log(`   ${label}: ${JSON.stringify(value, null, 2)}`)
}

async function main() {
  log.section('Predictive Runtime Intelligence Demo')
  
  const tenantId = 'demo-corp'
  const goalId = 'goal-obtain-signature'
  
  // Initialize stores
  const strategyOutcomeStore = new StrategyOutcomeStore()
  const memoryStore = new RuntimeMemoryStore()
  const topologyStore = new OperationalTopologyStore()
  const forecastStore = new RuntimeForecastStore()
  const intentGraph = new IntentGraph()
  const policyStore = new PolicyStore()
  const policyEngine = new RuntimePolicyEngine(policyStore)
  
  // Initialize predictive components
  const goalPlanner = new GoalPlanner(intentGraph, strategyOutcomeStore)
  const decayDetector = new StrategyDecayDetector(strategyOutcomeStore)
  const trajectoryAnalyzer = new FailureTrajectoryAnalyzer(memoryStore, topologyStore)
  const completionForecaster = new GoalCompletionForecaster(
    goalPlanner,
    strategyOutcomeStore,
    decayDetector
  )
  const entropyForecaster = new EntropyTrajectoryForecaster(topologyStore)
  const riskEngine = new PredictiveRiskEngine(
    decayDetector,
    trajectoryAnalyzer,
    completionForecaster,
    entropyForecaster
  )
  const governanceEngine = new PredictiveGovernanceEngine(riskEngine, policyEngine)
  
  // ===================================================================
  // SETUP: Seed data to demonstrate predictive intelligence
  // ===================================================================
  
  log.section('1. Setting Up Test Data')
  
  // Define a goal
  intentGraph.registerGoal({
    id: goalId,
    tenantId,
    goal: 'obtain_signed_contract',
    description: 'Get contract signed by customer',
    successCriteria: ['document.state == signed'],
    priority: 'high',
    operationalStrategies: ['docusign_fast_path', 'manual_review_flow'],
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  // Define strategies
  intentGraph.registerStrategy({
    id: 'strategy-1',
    strategyName: 'docusign_fast_path',
    goalId,
    tenantId,
    description: 'Fast automated signature flow via DocuSign',
    requiredTransitions: [],
    requiredProviders: [{ action: 'send_for_signature', provider: 'docusign' }],
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  intentGraph.registerStrategy({
    id: 'strategy-2',
    strategyName: 'manual_review_flow',
    goalId,
    tenantId,
    description: 'Manual review and signature collection',
    requiredTransitions: [],
    requiredProviders: [{ action: 'manual_review', provider: 'internal' }],
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  log.success('Goal and strategies defined')
  
  // Simulate historical outcomes showing strategy decay
  log.subsection('Simulating Historical Outcomes (Strategy Decay Pattern)')
  
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  
  // Historical period: 30-8 days ago (good performance)
  for (let i = 30; i >= 8; i--) {
    const completedAt = new Date(now - i * dayMs)
    const goalAchieved = Math.random() < 0.92  // 92% success rate
    
    const outcome: GoalOutcome = {
      id: `outcome-hist-${i}`,
      intentId: `intent-${i}`,
      goalId,
      tenantId,
      entityId: `doc-${i}`,
      strategyUsed: 'docusign_fast_path',
      fallbacksAttempted: [],
      executionId: `exec-${i}`,
      executionStatus: goalAchieved ? 'completed' : 'failed',
      goalAchieved,
      criteriaResults: [],
      totalExecutionTimeMs: 30000 + Math.random() * 10000,
      retryCount: goalAchieved ? 0 : Math.floor(Math.random() * 3),
      providerFailures: goalAchieved ? 0 : 1,
      strategyEffectiveness: {
        score: goalAchieved ? 0.9 : 0.3,
        factors: {
          goalAchieved,
          executionEfficiency: 0.85,
          recoveryEffectiveness: 0,
          timeEfficiency: 0.9
        }
      },
      startedAt: new Date(completedAt.getTime() - 35000),
      completedAt
    }
    
    await strategyOutcomeStore.storeOutcome(outcome)
  }
  
  log.info('Historical outcomes: 92% success rate (days 30-8)')
  
  // Recent period: 7-1 days ago (degrading performance)
  for (let i = 7; i >= 1; i--) {
    const completedAt = new Date(now - i * dayMs)
    const successRate = 0.92 - ((7 - i) * 0.04)  // Declining from 92% to 68%
    const goalAchieved = Math.random() < successRate
    
    const outcome: GoalOutcome = {
      id: `outcome-recent-${i}`,
      intentId: `intent-recent-${i}`,
      goalId,
      tenantId,
      entityId: `doc-recent-${i}`,
      strategyUsed: 'docusign_fast_path',
      fallbacksAttempted: goalAchieved ? [] : ['manual_review_flow'],
      executionId: `exec-recent-${i}`,
      executionStatus: goalAchieved ? 'completed' : 'failed',
      goalAchieved,
      criteriaResults: [],
      totalExecutionTimeMs: 30000 + Math.random() * 15000,
      retryCount: goalAchieved ? 0 : Math.floor(Math.random() * 4) + 1,
      providerFailures: goalAchieved ? 0 : Math.floor(Math.random() * 2) + 1,
      strategyEffectiveness: {
        score: goalAchieved ? 0.75 : 0.25,
        factors: {
          goalAchieved,
          executionEfficiency: 0.7,
          recoveryEffectiveness: 0.3,
          timeEfficiency: 0.75
        }
      },
      startedAt: new Date(completedAt.getTime() - 40000),
      completedAt
    }
    
    await strategyOutcomeStore.storeOutcome(outcome)
  }
  
  log.warning('Recent outcomes: Declining from 92% to 68% (days 7-1)')
  
  // Simulate operational topology snapshots showing entropy increase
  log.subsection('Simulating Operational Topology (Entropy Trend)')
  
  for (let i = 10; i >= 1; i--) {
    const timestamp = new Date(now - i * 2 * dayMs)
    const entropy = 0.35 + ((10 - i) * 0.04)  // Increasing from 0.35 to 0.71
    const convergence = 0.85 - ((10 - i) * 0.03)  // Decreasing from 0.85 to 0.58
    
    const snapshot: OperationalTopologySnapshot = {
      tenantId,
      capturedAt: timestamp,
      canonicalStates: [],
      canonicalTransitions: [],
      dominantProviders: new Map([['send_for_signature', 'docusign']]),
      stablePaths: [],
      entropyScore: entropy,
      operationalComplexity: entropy * 1.2,
      canonicalConfidence: convergence,
      observationWindow: { startDate: timestamp, endDate: timestamp },
      executionCount: 20
    }
    
    await topologyStore.store(snapshot)
  }
  
  log.warning('Entropy increasing: 0.35 → 0.71 (diverging)')
  log.warning('Convergence decreasing: 0.85 → 0.58')
  
  // Simulate runtime memory showing operational issues
  log.subsection('Simulating Runtime Memory (Operational Issues)')
  
  for (let i = 5; i >= 1; i--) {
    await memoryStore.store({
      id: `mem-${i}`,
      tenantId,
      trigger: {
        type: 'provider_instability',
        context: { provider: 'docusign', stability: 0.65 - (i * 0.05) },
        timestamp: new Date(now - i * dayMs)
      },
      decision: {
        policyDecision: { allowed: true, rationale: [], warnings: [], blocked: false, adaptations: [] },
        enforcementActions: [],
        strategyApplied: 'reroute:docusign->manual',
        rationale: ['Provider showing signs of instability']
      },
      outcome: {
        executionId: `exec-mem-${i}`,
        status: i % 2 === 0 ? 'completed' : 'failed',
        retryCount: i % 2 === 0 ? 1 : 3,
        completedAt: new Date(now - i * dayMs)
      },
      effectiveness: {
        score: i % 2 === 0 ? 0.7 : 0.3,
        factors: {
          executionSuccess: i % 2 === 0,
          retryReduction: 0.2,
          convergenceGain: 0,
          entropyReduction: -0.05
        }
      },
      createdAt: new Date(now - i * dayMs),
      outcomeCapturedAt: new Date(now - i * dayMs + 60000)
    })
  }
  
  log.warning('Provider instability signals increasing')
  
  // ===================================================================
  // DEMONSTRATION: Predictive Intelligence in Action
  // ===================================================================
  
  log.section('2. Strategy Decay Detection')
  
  const decay = await decayDetector.detectDecay(tenantId, goalId, 'docusign_fast_path')
  
  if (decay) {
    log.warning('Strategy Decay Detected!')
    console.log(`   Strategy: ${decay.strategyName}`)
    console.log(`   Historical Success: ${(decay.historicalSuccessRate * 100).toFixed(1)}%`)
    console.log(`   Recent Success: ${(decay.recentSuccessRate * 100).toFixed(1)}%`)
    console.log(`   Decay Rate: ${(decay.decayRate * 100).toFixed(1)}%`)
    console.log(`   Trend: ${decay.trend}`)
    console.log(`   Predicted 24h: ${(decay.predictedSuccessRate24h * 100).toFixed(1)}%`)
    console.log(`   Predicted 7d: ${(decay.predictedSuccessRate7d * 100).toFixed(1)}%`)
    console.log(`   Confidence: ${(decay.confidence * 100).toFixed(0)}%`)
  } else {
    log.success('No strategy decay detected')
  }
  
  log.section('3. Failure Trajectory Analysis')
  
  const trajectory = await trajectoryAnalyzer.analyzeTrajectory(tenantId)
  
  if (trajectory) {
    log.warning('Failure Trajectory Detected!')
    console.log(`   Pattern: ${trajectory.patternType}`)
    console.log(`   Trajectory: ${trajectory.trajectory}`)
    console.log(`   Failure Probability: ${(trajectory.failureProbability * 100).toFixed(1)}%`)
    console.log(`   Time to Failure: ${trajectory.timeToFailure || 'N/A'}`)
    console.log(`   Current State:`)
    console.log(`      Provider Stability: ${(trajectory.currentState.providerStability * 100).toFixed(1)}%`)
    console.log(`      Retry Rate: ${(trajectory.currentState.retryRate * 100).toFixed(1)}%`)
    console.log(`      Entropy: ${trajectory.currentState.entropyScore.toFixed(2)}`)
    console.log(`      Convergence: ${trajectory.currentState.convergenceScore.toFixed(2)}`)
    console.log(`   Leading Indicators:`)
    trajectory.leadingIndicators.forEach((ind) => {
      console.log(`      • ${ind.indicator}: ${ind.currentValue.toFixed(2)} (threshold: ${ind.threshold.toFixed(2)})`)
    })
  } else {
    log.success('No concerning failure trajectory')
  }
  
  log.section('4. Goal Completion Forecast')
  
  try {
    const forecast = await completionForecaster.forecastCompletion(tenantId, goalId)
    
    console.log(`   Goal: ${goalId}`)
    console.log(`   Predicted Success: ${(forecast.predictedSuccessProbability * 100).toFixed(1)}%`)
    console.log(`   Expected Retries: ${forecast.expectedRetries.toFixed(1)}`)
    console.log(`   Expected Time: ${forecast.expectedExecutionTimeMs}ms`)
    console.log(`   Fallback Probability: ${(forecast.fallbackRequirementProbability * 100).toFixed(1)}%`)
    console.log(`   Confidence: ${(forecast.confidence * 100).toFixed(0)}%`)
    
    if (forecast.riskFactors.length > 0) {
      console.log(`   Risk Factors:`)
      forecast.riskFactors.forEach((risk) => {
        console.log(`      • ${risk.factor} (impact: ${(risk.impact * 100).toFixed(0)}%): ${risk.description}`)
      })
    }
    
    if (forecast.recommendedPreemptiveActions.length > 0) {
      log.warning('Recommended Preemptive Actions:')
      forecast.recommendedPreemptiveActions.forEach((action) => {
        console.log(`      • ${action.action}`)
        console.log(`        ${action.expectedImpact}`)
        console.log(`        Success increase: +${(action.successProbabilityIncrease * 100).toFixed(0)}%`)
      })
    }
  } catch (error) {
    log.error(`Forecast failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  log.section('5. Entropy Trajectory Forecast')
  
  const entropyForecast = await entropyForecaster.forecastEntropy(tenantId)
  
  if (entropyForecast) {
    console.log(`   Current Entropy: ${entropyForecast.currentEntropy.toFixed(2)}`)
    console.log(`   Predicted 24h: ${entropyForecast.predictedEntropy24h.toFixed(2)}`)
    console.log(`   Predicted 7d: ${entropyForecast.predictedEntropy7d.toFixed(2)}`)
    console.log(`   Trajectory: ${entropyForecast.entropyTrajectory}`)
    console.log(`   Convergence Velocity: ${entropyForecast.convergenceVelocity.toFixed(3)}`)
    console.log(`   Time to Stable Convergence: ${entropyForecast.timeToStableConvergence || 'Not converging'}`)
    console.log(`   Confidence: ${(entropyForecast.confidence * 100).toFixed(0)}%`)
    
    if (entropyForecast.fragmentationRisks.length > 0) {
      log.warning('Fragmentation Risks:')
      entropyForecast.fragmentationRisks.forEach((risk) => {
        console.log(`      • ${risk.riskType} (${(risk.probability * 100).toFixed(0)}%): ${risk.impact}`)
      })
    }
  } else {
    log.info('Not enough data for entropy forecast')
  }
  
  log.section('6. Comprehensive Risk Assessment')
  
  const riskAssessment = await riskEngine.assessRisks(tenantId, '24h')
  
  console.log(`   Overall Risk Score: ${(riskAssessment.overallRiskScore * 100).toFixed(1)}%`)
  console.log(`   Confidence: ${(riskAssessment.confidence * 100).toFixed(0)}%`)
  console.log(`   Forecast Window: ${riskAssessment.forecastWindow}`)
  console.log(`   Risks Identified: ${riskAssessment.risks.length}`)
  
  if (riskAssessment.risks.length > 0) {
    log.warning('Identified Risks:')
    riskAssessment.risks.forEach((risk) => {
      console.log(`\n   ${risk.type.toUpperCase()} [${risk.severity}]`)
      console.log(`      Probability: ${(risk.probability * 100).toFixed(1)}%`)
      console.log(`      Description: ${risk.description}`)
      console.log(`      Affected: ${risk.affectedComponents.join(', ')}`)
      console.log(`      Actions:`)
      risk.recommendedActions.forEach((action) => {
        console.log(`         • ${action}`)
      })
    })
  }
  
  if (riskAssessment.preemptiveActions.length > 0) {
    log.warning('\nPreemptive Actions Recommended:')
    riskAssessment.preemptiveActions.forEach((action) => {
      console.log(`\n   [${action.priority.toUpperCase()}] ${action.action}`)
      console.log(`      Impact: ${action.expectedImpact}`)
      console.log(`      Risk Reduction: ${(action.estimatedRiskReduction * 100).toFixed(0)}%`)
    })
  }
  
  log.section('7. Predictive Governance Decision')
  
  const governanceRecommendation = await governanceEngine.generateRecommendations(tenantId)
  
  console.log(`   Predicted Execution Safety: ${governanceRecommendation.predictedExecutionSafety.toUpperCase()}`)
  console.log(`   Execution Risk Score: ${(governanceRecommendation.executionRiskScore * 100).toFixed(1)}%`)
  console.log(`   Confidence: ${(governanceRecommendation.confidence * 100).toFixed(0)}%`)
  console.log(`   Recommendations: ${governanceRecommendation.recommendations.length}`)
  
  if (governanceRecommendation.recommendations.length > 0) {
    log.warning('Governance Recommendations:')
    governanceRecommendation.recommendations.forEach((rec) => {
      console.log(`\n   [${rec.priority.toUpperCase()}] ${rec.type} - ${rec.action}`)
      console.log(`      Rationale:`)
      rec.rationale.forEach((r) => console.log(`         • ${r}`))
      console.log(`      Expected Impact: ${rec.expectedImpact}`)
    })
  }
  
  const decision = await governanceEngine.shouldProceedWithExecution(tenantId)
  
  console.log(`\n   Decision: ${decision.shouldProceed ? '✅ PROCEED' : '❌ BLOCK'}`)
  console.log(`   Reasoning:`)
  decision.reasoning.forEach((r) => console.log(`      • ${r}`))
  
  if (decision.requiredActions.length > 0) {
    console.log(`   Required Actions Before Execution:`)
    decision.requiredActions.forEach((a) => console.log(`      • ${a}`))
  }
  
  log.section('8. Forecast Persistence & Accuracy Tracking')
  
  // Store a forecast
  await forecastStore.store({
    id: 'forecast-1',
    tenantId,
    forecastType: 'risk_assessment',
    forecastData: riskAssessment,
    generatedAt: new Date(),
    forecastHorizon: '24h',
    confidence: riskAssessment.confidence
  })
  
  log.success('Risk assessment forecast stored')
  
  // Simulate recording an outcome
  await forecastStore.recordOutcome('forecast-1', {
    occurred: true,
    accuracy: 0.89,
    actualData: { riskMaterialized: true },
  })
  
  log.success('Forecast outcome recorded (89% accuracy)')
  
  // Calculate accuracy metrics
  const accuracyMetrics = await forecastStore.calculateAccuracyMetrics(
    tenantId,
    'risk_assessment'
  )
  
  console.log(`\n   Total Forecasts: ${accuracyMetrics.totalForecasts}`)
  console.log(`   Verified: ${accuracyMetrics.verifiedForecasts}`)
  console.log(`   Average Accuracy: ${(accuracyMetrics.averageAccuracy * 100).toFixed(1)}%`)
  console.log(`   Trend: ${accuracyMetrics.accuracyTrend}`)
  
  log.section('Demo Complete')
  
  log.success('Predictive Runtime Intelligence Demonstrated')
  
  console.log(`\n🎯 Runtime Transformation Complete:`)
  console.log(`   FROM: observe → adapt`)
  console.log(`   TO:   predict → prevent → optimize`)
  console.log(`\n   The runtime now has ANTICIPATORY OPERATIONAL COGNITION.`)
}

main().catch((error) => {
  console.error('Demo failed:', error)
  process.exit(1)
})

/**
 * Demo: Decision-Time Calibration & Predictive Decision Loop
 * 
 * This demonstrates PR-017's core capability:
 * Using prediction error to improve decision-making BEFORE execution.
 * 
 * Architecture:
 * Forecast → Calibrate → Execute (vs. Forecast → Execute → Calibrate)
 */

import { DecisionCalibrationStore } from './src/runtime/predictive/decision/DecisionCalibrationStore.js'
import { StrategyBiasStore } from './src/runtime/predictive/decision/StrategyBiasStore.js'
import { PlanRewriteAuditStore } from './src/runtime/predictive/decision/PlanRewriteAuditStore.js'
import { RealTimeCalibrationContextBuilder } from './src/runtime/predictive/decision/RealTimeCalibrationContextBuilder.js'
import { CalibrationAwareRiskEngineWrapper } from './src/runtime/predictive/decision/CalibrationAwareRiskEngineWrapper.js'
import { StrategyBiasInjector } from './src/runtime/predictive/decision/StrategyBiasInjector.js'
import { DecisionTimeCalibrationEngine } from './src/runtime/predictive/decision/DecisionTimeCalibrationEngine.js'
import { ExecutionPlanRewriter } from './src/runtime/predictive/decision/ExecutionPlanRewriter.js'
import { PredictionAccuracyStore } from './src/runtime/predictive/calibration/PredictionAccuracyStore.js'
import { CalibrationStore } from './src/runtime/predictive/calibration/CalibrationStore.js'
import { PredictiveRiskEngine } from './src/runtime/predictive/PredictiveRiskEngine.js'
import { StrategyDecayDetector } from './src/runtime/predictive/StrategyDecayDetector.js'
import { FailureTrajectoryAnalyzer } from './src/runtime/predictive/FailureTrajectoryAnalyzer.js'
import { GoalCompletionForecaster } from './src/runtime/predictive/GoalCompletionForecaster.js'
import { EntropyTrajectoryForecaster } from './src/runtime/predictive/EntropyTrajectoryForecaster.js'
import { StrategyOutcomeStore } from './src/runtime/intent/StrategyOutcomeStore.js'
import { RuntimeMemoryStore } from './src/runtime/memory/RuntimeMemoryStore.js'
import { OperationalTopologyStore } from './src/runtime/store/OperationalTopologyStore.js'
import { IntentGraph } from './src/runtime/intent/IntentGraph.js'
import { GoalPlanner } from './src/runtime/intent/GoalPlanner.js'
import type { StrategySelection } from './src/runtime/intent/types.js'

// Logging utility
const log = {
  section: (title: string) => console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`),
  subsection: (title: string) => console.log(`\n${'-'.repeat(40)}\n${title}\n${'-'.repeat(40)}`),
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  data: (label: string, value: any) => console.log(`   ${label}: ${JSON.stringify(value, null, 2)}`)
}

async function main() {
  const tenantId = 'demo-corp'
  const goalId = 'goal-sign-document'
  
  log.section('PR-017: Decision-Time Calibration Demo')
  log.info('Demonstrating: Forecast → Calibrate → Execute')
  log.info('vs. old approach: Forecast → Execute → Calibrate (later)')
  
  // ============================================================================
  // SETUP: Initialize stores and components
  // ============================================================================
  
  log.subsection('SETUP: Initializing Components')
  
  const accuracyStore = new PredictionAccuracyStore()
  const calibrationStore = new CalibrationStore()
  const decisionCalibrationStore = new DecisionCalibrationStore()
  const strategyBiasStore = new StrategyBiasStore()
  const planRewriteAuditStore = new PlanRewriteAuditStore()
  
  // Set up supporting infrastructure
  const strategyOutcomeStore = new StrategyOutcomeStore()
  const memoryStore = new RuntimeMemoryStore()
  const topologyStore = new OperationalTopologyStore()
  const intentGraph = new IntentGraph()
  const goalPlanner = new GoalPlanner(intentGraph, strategyOutcomeStore)
  
  // Initialize predictive components
  const decayDetector = new StrategyDecayDetector(strategyOutcomeStore)
  const trajectoryAnalyzer = new FailureTrajectoryAnalyzer(memoryStore, topologyStore)
  const completionForecaster = new GoalCompletionForecaster(goalPlanner, strategyOutcomeStore, decayDetector)
  const entropyForecaster = new EntropyTrajectoryForecaster(topologyStore)
  const predictiveRiskEngine = new PredictiveRiskEngine(
    decayDetector,
    trajectoryAnalyzer,
    completionForecaster,
    entropyForecaster
  )
  
  // Initialize decision-time calibration components
  const contextBuilder = new RealTimeCalibrationContextBuilder(
    accuracyStore,
    calibrationStore,
    decayDetector,
    strategyBiasStore
  )
  const calibratedRiskEngine = new CalibrationAwareRiskEngineWrapper(predictiveRiskEngine)
  const biasInjector = new StrategyBiasInjector(strategyBiasStore)
  const decisionTimeCalibration = new DecisionTimeCalibrationEngine(
    contextBuilder,
    calibratedRiskEngine,
    biasInjector,
    decisionCalibrationStore
  )
  const planRewriter = new ExecutionPlanRewriter(planRewriteAuditStore)
  
  log.success('All components initialized')
  
  // ============================================================================
  // STEP 1: Simulate Historical Learning
  // ============================================================================
  
  log.subsection('STEP 1: Simulating Historical Learning')
  log.info('Learning from past executions to build calibration knowledge')
  
  // Seed accuracy data (simulating historical predictions vs. outcomes)
  await accuracyStore.store({
    modelType: 'risk_engine',
    tenantId,
    overallAccuracy: 0.75,  // 75% accurate
    brierScore: 0.18,
    bias: 'overconfident',  // Tends to overestimate risk
    biasScore: 0.14,       // Overestimates by +0.14 on average
    calibrationError: 0.12,
    sampleSize: 50,
    evaluationPeriod: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    confidence: 0.85,
    computedAt: new Date()
  })
  
  // Seed calibration state
  await calibrationStore.saveState({
    modelType: 'risk_engine',
    tenantId,
    confidenceScaleFactor: 0.9,
    riskSensitivity: 1.0,
    decaySensitivity: 1.0,
    entropyBaseline: 0.5,
    convergenceExpectation: 0.7,
    recentAccuracy: 0.75,
    accuracyTrend: 'stable',
    driftMagnitude: 0.12,
    driftDetected: true,
    lastCalibratedAt: new Date(),
    calibrationCount: 5
  })
  
  // Seed strategy bias (docuseal_fast_path is declining)
  await strategyBiasStore.recordBias({
    strategyName: 'docuseal_fast_path',
    goalId,
    tenantId,
    historicalSuccessRate: 0.62,    // Actually achieves 62% success
    predictedSuccessRate: 0.85,     // But we predict 85%
    biasMagnitude: -0.23,           // Overestimate by 23%
    recentPerformance: 'declining',
    decayDetected: true,
    biasWeight: 0.73,               // Weight < 1.0 means avoid
    recommendAvoid: true,
    recommendPrefer: false,
    sampleSize: 35,
    lastUpdated: new Date(),
    confidence: 0.8
  })
  
  // Seed positive bias for alternative strategy
  await strategyBiasStore.recordBias({
    strategyName: 'docusign_fast_path',
    goalId,
    tenantId,
    historicalSuccessRate: 0.88,    // Actually achieves 88% success
    predictedSuccessRate: 0.80,     // But we predict 80%
    biasMagnitude: 0.08,            // Underestimate by 8%
    recentPerformance: 'stable',
    decayDetected: false,
    biasWeight: 1.1,                // Weight > 1.0 means prefer
    recommendAvoid: false,
    recommendPrefer: true,
    sampleSize: 42,
    lastUpdated: new Date(),
    confidence: 0.85
  })
  
  log.success('Historical learning data seeded')
  log.data('Risk Engine Bias', '+0.14 overconfidence')
  log.data('Strategy Bias', {
    'docuseal_fast_path': '62% actual vs 85% predicted → AVOID',
    'docusign_fast_path': '88% actual vs 80% predicted → PREFER'
  })
  
  // ============================================================================
  // STEP 2: Build Calibration Context
  // ============================================================================
  
  log.subsection('STEP 2: Building Real-Time Calibration Context')
  
  const context = await contextBuilder.buildContext(tenantId)
  
  log.success('Calibration context built')
  log.data('Prediction Accuracy', {
    riskEngine: context.predictionAccuracy.riskEngine,
    entropyForecaster: context.predictionAccuracy.entropyForecaster
  })
  log.data('Bias Adjustments', context.biasAdjustments)
  log.data('Drift State', context.driftState)
  log.data('Strategy Preferences', context.strategyPreferences)
  log.data('Context Confidence', (context.confidence * 100).toFixed(0) + '%')
  
  // ============================================================================
  // STEP 3: Simulate Uncalibrated Decision (OLD WAY)
  // ============================================================================
  
  log.subsection('STEP 3: Uncalibrated Decision (OLD WAY)')
  log.info('What would happen WITHOUT decision-time calibration?')
  
  // Simulate raw strategy selection
  const rawStrategySelection: StrategySelection = {
    goalId,
    selectedStrategy: 'docuseal_fast_path',
    confidence: 0.85,
    rationale: [
      'Historical effectiveness score: 0.85',
      'Low execution time',
      'High confidence'
    ],
    expectedSuccessProbability: 0.85,
    expectedExecutionTimeMs: 2500,
    expectedRetryRate: 0.15,
    fallbackStrategies: [
      {
        strategy: 'docusign_fast_path',
        confidence: 0.75,
        rationale: ['Alternative with good stability']
      }
    ],
    historicalData: {
      timesApplied: 35,
      successRate: 0.85,  // This is what we THINK
      averageExecutionTimeMs: 2500,
      averageRetries: 0.15
    }
  }
  
  // Simulate raw risk assessment
  const rawRiskScore = 0.82
  
  log.warning('Selected Strategy: docuseal_fast_path')
  log.warning('Predicted Success: 85%')
  log.warning('Risk Score: 0.82')
  log.warning('But wait... Historical data shows this strategy only achieves 62% success!')
  log.error('Decision would be made with overconfident predictions')
  
  // ============================================================================
  // STEP 4: Apply Decision-Time Calibration (NEW WAY)
  // ============================================================================
  
  log.subsection('STEP 4: Decision-Time Calibration (NEW WAY)')
  log.info('Applying calibration BEFORE execution')
  
  // Perform decision-time calibration
  const calibration = await decisionTimeCalibration.performDecisionTimeCalibration(
    tenantId,
    goalId,
    rawStrategySelection
  )
  
  log.success('Calibration applied!')
  
  log.subsection('Risk Calibration')
  log.data('Original Risk', calibration.riskCalibration.originalRisk)
  log.data('Calibrated Risk', calibration.riskCalibration.calibratedRisk)
  log.data('Adjustment', calibration.riskCalibration.adjustment)
  log.data('Reason', calibration.riskCalibration.reason)
  
  log.subsection('Strategy Calibration')
  log.data('Original Strategy', calibration.strategyCalibration.originalStrategy)
  log.data('Recommended Strategy', calibration.strategyCalibration.recommendedStrategy)
  log.data('Swapped?', calibration.strategyCalibration.swapped)
  log.data('Reason', calibration.strategyCalibration.reason)
  log.data('Confidence Increase', '+' + (calibration.strategyCalibration.confidenceIncrease * 100).toFixed(0) + '%')
  
  log.subsection('Aggregate Impact')
  log.success(`Risk Reduction: ${(calibration.aggregateImpact.riskReduction * 100).toFixed(0)}%`)
  log.success(`Success Probability Increase: ${(calibration.aggregateImpact.successProbabilityIncrease * 100).toFixed(0)}%`)
  log.success(`Expected Improvement: ${calibration.aggregateImpact.expectedImprovement}`)
  
  // ============================================================================
  // STEP 5: Rewrite Execution Plan
  // ============================================================================
  
  log.subsection('STEP 5: Execution Plan Rewrite')
  
  const adjustedSelection: StrategySelection = {
    ...rawStrategySelection,
    selectedStrategy: calibration.strategyCalibration.recommendedStrategy,
    expectedSuccessProbability: 0.88,  // Adjusted based on actual performance
    rationale: [
      ...rawStrategySelection.rationale,
      calibration.strategyCalibration.reason
    ]
  }
  
  const rewrite = await planRewriter.rewritePlan(
    tenantId,
    rawStrategySelection,
    adjustedSelection,
    context
  )
  
  if (rewrite.rewritten) {
    log.success('Execution plan rewritten!')
    log.info('Modifications:')
    rewrite.modifications.forEach(mod => {
      console.log(`   • ${mod.type}: ${mod.description}`)
      console.log(`     Reason: ${mod.reason}`)
    })
  }
  
  // ============================================================================
  // STEP 6: Decision Pipeline Evaluation
  // ============================================================================
  
  log.subsection('STEP 6: Full Decision Pipeline Evaluation')
  
  const evaluation = await decisionTimeCalibration.evaluateDecisionPipeline(
    tenantId,
    goalId
  )
  
  log.success('Decision pipeline evaluated')
  log.data('Should Proceed?', evaluation.stages.finalDecision.shouldProceed ? 'YES' : 'NO')
  log.data('Recommended Strategy', evaluation.stages.finalDecision.recommendedStrategy)
  log.data('Final Confidence', (evaluation.stages.finalDecision.confidence * 100).toFixed(0) + '%')
  
  log.subsection('Summary')
  log.data('Calibration Applied?', evaluation.summary.calibrationApplied ? 'YES' : 'NO')
  log.data('Decisions Modified', evaluation.summary.decisionsModified)
  log.data('Risk Reduction', (evaluation.summary.riskReduction * 100).toFixed(0) + '%')
  
  log.info('Recommendations:')
  evaluation.recommendations.forEach(rec => {
    console.log(`   • ${rec}`)
  })
  
  // ============================================================================
  // STEP 7: Review Calibration History
  // ============================================================================
  
  log.subsection('STEP 7: Calibration History & Statistics')
  
  const stats = await decisionCalibrationStore.getCalibrationStats(tenantId)
  
  log.success('Calibration statistics')
  log.data('Total Calibrations', stats.totalCalibrations)
  log.data('Risk Adjustments', stats.riskAdjustments)
  log.data('Strategy Swaps', stats.strategySwaps)
  log.data('Average Risk Reduction', (stats.averageRiskReduction * 100).toFixed(0) + '%')
  log.data('Average Success Increase', (stats.averageSuccessIncrease * 100).toFixed(0) + '%')
  log.data('Average Confidence', (stats.averageConfidence * 100).toFixed(0) + '%')
  
  // ============================================================================
  // FINAL COMPARISON
  // ============================================================================
  
  log.section('FINAL COMPARISON: Before vs. After')
  
  console.log('\n📊 BEFORE PR-017 (Uncalibrated):')
  console.log('   Strategy: docuseal_fast_path')
  console.log('   Predicted Success: 85%')
  console.log('   Actual Success: 62% ❌')
  console.log('   Risk: 0.82')
  console.log('   Result: Overconfident decision → Likely failure')
  
  console.log('\n📊 AFTER PR-017 (Calibrated):')
  console.log('   Strategy: docusign_fast_path ✅')
  console.log('   Predicted Success: 80% → Adjusted to 88%')
  console.log('   Actual Success: 88% ✅')
  console.log('   Risk: 0.82 → Calibrated to 0.68')
  console.log('   Result: Corrected decision → Higher success probability')
  
  log.section('Key Takeaway')
  console.log('\n💡 The runtime now:')
  console.log('   1. Knows when it is wrong BEFORE execution')
  console.log('   2. Corrects its own predictions in real-time')
  console.log('   3. Rewrites execution plans to improve outcomes')
  console.log('   4. Learns from every calibration cycle')
  console.log('\n🎯 This is the shift from:')
  console.log('   "We learned we were wrong" (retrospective)')
  console.log('   → "We prevent being wrong" (proactive)')
  
  log.section('Demo Complete')
}

main().catch(console.error)

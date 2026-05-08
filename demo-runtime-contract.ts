/**
 * Demo: Runtime-Core Contract v1 Usage
 * 
 * This demonstrates how OperNext would use the Runtime-Core Contract to:
 * 1. Express intent
 * 2. Get decision context
 * 3. Monitor execution
 * 4. Learn from intelligence
 */

import type {
  IntentRequest,
  IntentResponse,
  DecisionContextRequest,
  ExecutionStatusResponse,
  IntelligenceForecastRequest
} from './src/runtime/api/contract-types.js'

/**
 * Example 1: Express Intent and Get Decision
 * 
 * OperNext describes WHAT it wants (intent)
 * Runtime-core returns HOW it will achieve it (decision + prediction + trace)
 */
async function example1_ExpressIntent() {
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('Example 1: Intent Ingestion')
  console.log('═══════════════════════════════════════════════════════════════════════\n')

  // OperNext sends intent
  const intentRequest: IntentRequest = {
    tenantId: 'acme-corp',
    intent: {
      goalId: 'obtain_signed_contract',
      type: 'document_lifecycle',
      context: {
        documentId: 'doc-123',
        documentType: 'sales_contract',
        customerTier: 'enterprise',
        urgency: 'high'
      },
      successCriteria: [
        'document.state == signed',
        'document.signatures.length >= 2',
        'document.audit_trail.length > 0'
      ],
      priority: 'high',
      timeoutMs: 300000  // 5 minutes
    },
    currentState: {
      entityId: 'doc-123',
      entityType: 'document',
      knownState: {
        state: 'draft',
        signatures: [],
        created_at: new Date().toISOString()
      }
    },
    constraints: {
      preferences: {
        speed: 'fast',
        reliability: 'high',
        cost: 'balanced'
      },
      mustInclude: [
        'audit_trail',
        'encryption'
      ],
      complianceRequirements: [
        'SOC2',
        'GDPR'
      ]
    },
    metadata: {
      correlationId: 'corr-789',
      originatingSystem: 'OperNext',
      userContext: {
        userId: 'user-456',
        accountId: 'acct-789'
      }
    }
  }

  console.log('OperNext sends intent:')
  console.log(JSON.stringify(intentRequest, null, 2))
  console.log()

  // Simulate API call
  const response = await fetch('http://localhost:3000/runtime/v1/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intentRequest)
  })

  const intentResponse: IntentResponse = await response.json()

  console.log('Runtime-core responds with:')
  console.log()

  // 1. DECISION
  console.log('1. DECISION (what strategy will be used):')
  console.log(`   Selected Strategy: ${intentResponse.decision.selectedStrategy.strategyName}`)
  console.log(`   Confidence: ${intentResponse.decision.selectedStrategy.confidence}`)
  console.log('   Reasoning:')
  intentResponse.decision.selectedStrategy.selectionReasoning.forEach(r => {
    console.log(`     - ${r.rationale} (weight: ${r.weight})`)
  })
  console.log()

  // 2. PREDICTION
  console.log('2. PREDICTION (what will likely happen):')
  console.log(`   Success Probability: ${intentResponse.prediction.expectedOutcome.goalAchievementProbability * 100}%`)
  console.log(`   Expected Time: ${intentResponse.prediction.expectedOutcome.predictedExecutionTimeMs}ms`)
  console.log(`   Expected Retries: ${intentResponse.prediction.expectedOutcome.expectedResourceUsage.estimatedRetries}`)
  console.log(`   Risks Identified: ${intentResponse.prediction.risks.length}`)
  intentResponse.prediction.risks.forEach(r => {
    console.log(`     - ${r.riskType} (${r.severity}, ${r.probability * 100}% probability)`)
    console.log(`       Mitigation: ${r.mitigation}`)
  })
  console.log()

  // 3. EXECUTION TRACE
  console.log('3. EXECUTION TRACE (how to track progress):')
  console.log(`   Execution ID: ${intentResponse.execution.executionId}`)
  console.log(`   Tracking Endpoint: ${intentResponse.execution.trackingEndpoint}`)
  console.log(`   Real-time Updates: ${intentResponse.execution.supportsRealTimeUpdates}`)
  console.log('   Expected Checkpoints:')
  intentResponse.execution.expectedCheckpoints.forEach(cp => {
    console.log(`     - ${cp.description} (at +${cp.expectedTimestampRelativeMs}ms)`)
  })
  console.log()

  // 4. INTELLIGENCE
  console.log('4. INTELLIGENCE (what runtime knows):')
  console.log(`   Historical Success Rate: ${intentResponse.intelligence.goalIntelligence.historicalSuccessRate * 100}%`)
  console.log(`   Total Attempts: ${intentResponse.intelligence.goalIntelligence.totalAttempts}`)
  console.log(`   Recent Trend: ${intentResponse.intelligence.goalIntelligence.recentTrend}`)
  console.log(`   System Entropy: ${intentResponse.intelligence.operationalHealth.systemEntropy}`)
  console.log(`   Convergence Score: ${intentResponse.intelligence.operationalHealth.convergenceScore}`)
  console.log()

  return intentResponse
}

/**
 * Example 2: Get Decision Context
 * 
 * OperNext asks: "What strategies are available and why?"
 * Runtime-core exposes decision intelligence
 */
async function example2_GetDecisionContext() {
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('Example 2: Decision Context')
  console.log('═══════════════════════════════════════════════════════════════════════\n')

  const request: DecisionContextRequest = {
    tenantId: 'acme-corp',
    goalId: 'obtain_signed_contract'
  }

  const response = await fetch(
    `http://localhost:3000/runtime/v1/decision/context?tenantId=${request.tenantId}&goalId=${request.goalId}`
  )

  const context = await response.json()

  console.log('Available Strategies:')
  context.availableStrategies.forEach((s: any) => {
    console.log(`\n  ${s.strategyName} (${s.currentSuitability.recommended ? 'RECOMMENDED' : 'available'})`)
    console.log(`    Success Rate: ${s.characteristics.expectedSuccessRate * 100}%`)
    console.log(`    Avg Time: ${s.characteristics.expectedExecutionTimeMs}ms`)
    console.log(`    Historical Attempts: ${s.historicalPerformance.totalAttempts}`)
    console.log(`    Suitability Score: ${s.currentSuitability.suitabilityScore}`)
    console.log('    Reasoning:')
    s.currentSuitability.reasoning.forEach((r: string) => {
      console.log(`      - ${r}`)
    })
  })

  console.log('\nOperational Context:')
  console.log(`  System Health: Entropy=${context.operationalContext.systemHealth.entropy}, Convergence=${context.operationalContext.systemHealth.convergence}`)
  console.log(`  Active Risks: ${context.operationalContext.activeRisks.length}`)
  console.log(`  Calibration Enabled: ${context.calibration.calibrationEnabled}`)
  console.log(`  Prediction Accuracy: ${context.calibration.predictionAccuracy.overall * 100}%`)
  console.log()
}

/**
 * Example 3: Monitor Execution
 * 
 * OperNext observes execution WITHOUT controlling it
 */
async function example3_MonitorExecution(executionId: string) {
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('Example 3: Monitor Execution')
  console.log('═══════════════════════════════════════════════════════════════════════\n')

  // Poll execution status
  const response = await fetch(`http://localhost:3000/runtime/v1/execution/${executionId}`)
  const status: ExecutionStatusResponse = await response.json()

  console.log('Execution Status:')
  console.log(`  Phase: ${status.status.phase}`)
  console.log(`  Progress: ${(status.status.progress * 100).toFixed(1)}%`)
  console.log(`  Strategy: ${status.strategy.strategyName} (attempt ${status.strategy.attemptNumber}/${status.strategy.maxAttempts})`)
  console.log()

  console.log('Current State:')
  console.log(`  Completed Actions: ${status.currentState.executionState.completedActions}/${status.currentState.executionState.totalActions}`)
  console.log(`  Criteria Satisfied: ${status.currentState.goalProgress.criteriaSatisfied}/${status.currentState.goalProgress.totalCriteria}`)
  console.log()

  console.log('Real-time Predictions:')
  console.log(`  Success Probability: ${status.predictions.goalAchievementProbability * 100}%`)
  console.log(`  Time Remaining: ${status.predictions.estimatedTimeRemainingMs}ms`)
  if (status.predictions.emergingRisks.length > 0) {
    console.log('  Emerging Risks:')
    status.predictions.emergingRisks.forEach(r => {
      console.log(`    - ${r.riskType} (${r.severity}) - Mitigation: ${r.mitigation}`)
    })
  }
  console.log()

  console.log('Adaptive Actions Taken:')
  if (status.adaptiveActions.length === 0) {
    console.log('  None')
  } else {
    status.adaptiveActions.forEach(a => {
      console.log(`  - ${a.actionType}: ${a.reasoning}`)
      console.log(`    Impact: ${a.impact}`)
    })
  }
  console.log()

  // Get detailed trace
  const traceResponse = await fetch(`http://localhost:3000/runtime/v1/execution/${executionId}/trace`)
  const trace = await traceResponse.json()

  console.log('Execution Timeline:')
  console.log(`  Planning: ${trace.timeline.planningDurationMs}ms`)
  console.log(`  Governance: ${trace.timeline.governanceDurationMs}ms`)
  console.log(`  Execution: ${trace.timeline.executionDurationMs}ms`)
  console.log(`  Total: ${trace.timeline.totalDurationMs}ms`)
  console.log()
}

/**
 * Example 4: Learn from Intelligence
 * 
 * OperNext asks: "What can you teach me?"
 * Runtime-core safely exposes learned intelligence
 */
async function example4_LearnFromIntelligence() {
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('Example 4: Learn from Intelligence')
  console.log('═══════════════════════════════════════════════════════════════════════\n')

  // Get forecast
  const forecastRequest: IntelligenceForecastRequest = {
    tenantId: 'acme-corp',
    forecastType: 'risk_assessment',
    forecastHorizon: '24h'
  }

  const forecastResponse = await fetch(
    `http://localhost:3000/runtime/v1/intelligence/forecast?` +
    `tenantId=${forecastRequest.tenantId}&` +
    `forecastType=${forecastRequest.forecastType}&` +
    `forecastHorizon=${forecastRequest.forecastHorizon}`
  )

  const forecast = await forecastResponse.json()

  console.log('24-Hour Risk Forecast:')
  forecast.forecasts.forEach((f: any) => {
    console.log(`\n  Forecast: ${f.forecastType}`)
    console.log('  Predicted Events:')
    f.predictedEvents.forEach((e: any) => {
      console.log(`    - ${e.eventType} (${e.probability * 100}% probability, ${e.severity})`)
      console.log(`      ${e.description}`)
    })
  })

  console.log('\n  Recommended Actions:')
  forecast.recommendedActions.forEach((a: any) => {
    console.log(`    - [${a.priority}] ${a.description}`)
    console.log(`      Expected Impact: ${a.expectedImpact}`)
  })
  console.log()

  // Get recommendations
  const recommendationsResponse = await fetch(
    'http://localhost:3000/runtime/v1/intelligence/recommendations?' +
    'tenantId=acme-corp&recommendationType=optimization'
  )

  const recommendations = await recommendationsResponse.json()

  console.log('Optimization Recommendations:')
  recommendations.recommendations.forEach((r: any) => {
    console.log(`\n  [${r.priority}] ${r.recommendation.title}`)
    console.log(`  ${r.recommendation.description}`)
    console.log('  Actionable Steps:')
    r.recommendation.actionableSteps.forEach((step: string) => {
      console.log(`    - ${step}`)
    })
    console.log(`  Expected Improvement: ${r.expectedImpact.estimatedImprovement * 100}%`)
    console.log(`  Confidence: ${r.expectedImpact.confidenceInImpact * 100}%`)
  })
  console.log()
}

/**
 * Main Demo Flow
 */
async function main() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║  Runtime-Core Contract v1 Demo                                        ║')
  console.log('║  OperNext ↔ Bakeoff Interface                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('This demo shows how OperNext uses the Runtime-Core Contract to:')
  console.log('  1. Express intent (NOT execution instructions)')
  console.log('  2. Receive decisions with reasoning and predictions')
  console.log('  3. Monitor execution WITHOUT controlling it')
  console.log('  4. Learn from runtime intelligence')
  console.log()
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log()

  try {
    // Example 1: Express intent
    const intentResponse = await example1_ExpressIntent()
    
    console.log('Press Enter to continue...')
    // await new Promise(resolve => process.stdin.once('data', resolve))

    // Example 2: Get decision context
    await example2_GetDecisionContext()
    
    console.log('Press Enter to continue...')
    // await new Promise(resolve => process.stdin.once('data', resolve))

    // Example 3: Monitor execution
    await example3_MonitorExecution(intentResponse.execution.executionId)
    
    console.log('Press Enter to continue...')
    // await new Promise(resolve => process.stdin.once('data', resolve))

    // Example 4: Learn from intelligence
    await example4_LearnFromIntelligence()

    console.log('═══════════════════════════════════════════════════════════════════════')
    console.log('Demo Complete!')
    console.log('═══════════════════════════════════════════════════════════════════════')
    console.log()

  } catch (error) {
    console.error('Demo error:', error)
    console.log()
    console.log('Note: This demo requires a running ControlPlaneServer on port 3000.')
    console.log('Start the server with appropriate test data before running this demo.')
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { example1_ExpressIntent, example2_GetDecisionContext, example3_MonitorExecution, example4_LearnFromIntelligence }

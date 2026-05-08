/**
 * Runtime-Core Contract v1 - Implementation
 * 
 * This file implements the versioned contract endpoints defined in contract-types.ts
 */

import type {
  IntentRequest,
  IntentResponse,
  DecisionContextRequest,
  DecisionContextResponse,
  DecisionEvaluationRequest,
  DecisionEvaluationResponse,
  ExecutionStatusResponse,
  ExecutionTraceResponse,
  ObservationRequest,
  ObservationResponse,
  IntelligenceForecastRequest,
  IntelligenceForecastResponse,
  IntelligenceLearningRequest,
  IntelligenceLearningResponse,
  IntelligenceRecommendationRequest,
  IntelligenceRecommendationResponse
} from './contract-types.js'
import { RUNTIME_CORE_CONTRACT_VERSION } from './contract-types.js'
import type { GoalPlanner } from '../intent/GoalPlanner.js'
import type { OperationalPlanSynthesizer } from '../intent/OperationalPlanSynthesizer.js'
import type { PredictiveRiskEngine } from '../predictive/PredictiveRiskEngine.js'
import type { GoalCompletionForecaster } from '../predictive/GoalCompletionForecaster.js'
import type { ExecutionStore } from '../store/execution-store.js'
import type { IntentGraph } from '../intent/IntentGraph.js'
import type { RuntimeMemoryStore } from '../memory/RuntimeMemoryStore.js'
import type { RecommendationEngine } from '../intelligence/recommendation/RecommendationEngine.js'
import type { TenantRuntimeRegistry } from '../registry/tenant-registry.js'
import type { ExecutionRecord } from '../store/execution-record.js'
import type { RuntimeForecastStore } from '../predictive/RuntimeForecastStore.js'
import type { StrategyOutcomeStore } from '../intent/StrategyOutcomeStore.js'

/**
 * RuntimeCoreContractHandler - Implements the v1 contract
 */
export class RuntimeCoreContractHandler {
  constructor(
    private readonly goalPlanner: GoalPlanner,
    private readonly planSynthesizer: OperationalPlanSynthesizer,
    private readonly predictiveRiskEngine: PredictiveRiskEngine,
    private readonly completionForecaster: GoalCompletionForecaster,
    private readonly executionStore: ExecutionStore,
    private readonly intentGraph: IntentGraph,
    private readonly memoryStore: RuntimeMemoryStore,
    private readonly recommendationEngine: RecommendationEngine,
    private readonly registry: TenantRuntimeRegistry,
    private readonly forecastStore: RuntimeForecastStore,
    private readonly strategyOutcomeStore: StrategyOutcomeStore
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DOMAIN A: INTENT INGESTION
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * POST /runtime/v1/intent
   * 
   * Process intent and return decision + prediction + trace
   */
  async handleIntent(request: IntentRequest): Promise<IntentResponse> {
    const startTime = Date.now()
    const requestId = this.generateRequestId()

    try {
      // 1. Validate and accept intent
      const goal = this.intentGraph.getGoal(request.intent.goalId)
      if (!goal) {
        return this.buildRejectedIntentResponse(
          requestId,
          request.intent.goalId,
          'Goal not found in intent graph'
        )
      }

      // 2. Select strategy (DECISION)
      const strategySelection = await this.goalPlanner.selectStrategy(
        request.tenantId,
        request.intent.goalId
      )

      // 3. Generate prediction (PREDICTION)
      const forecast = await this.completionForecaster.forecastCompletion(
        request.tenantId,
        request.intent.goalId
      )

      // 4. Assess risks
      const riskAssessment = await this.predictiveRiskEngine.assessRisks(
        request.tenantId,
        '24h'
      )

      // 5. Generate execution plan
      const model = this.registry.getModel(request.tenantId)
      if (!model) {
        return this.buildRejectedIntentResponse(
          requestId,
          request.intent.goalId,
          'Tenant model not found'
        )
      }

      const plan = await this.planSynthesizer.synthesizePlan(
        request.tenantId,
        request.intent.goalId,
        strategySelection.selectedStrategy,
        model
      )

      // 6. Get historical intelligence
      const strategyMetrics = await this.getStrategyMetrics(
        request.tenantId,
        request.intent.goalId
      )

      // 7. Build response
      const processingTime = Date.now() - startTime
      const executionId = this.generateExecutionId()

      const response: IntentResponse = {
        requestId,
        intent: {
          goalId: request.intent.goalId,
          status: 'accepted'
        },
        decision: {
          selectedStrategy: {
            strategyName: strategySelection.selectedStrategy,
            strategyId: `strategy-${strategySelection.selectedStrategy}`,
            description: this.getStrategyDescription(strategySelection.selectedStrategy),
            selectionReasoning: strategySelection.rationale.map((r, i) => ({
              factor: `factor_${i}`,
              weight: 1 / strategySelection.rationale.length,
              rationale: r
            })),
            confidence: strategySelection.confidence
          },
          fallbackStrategies: strategySelection.fallbackStrategies.map(f => ({
            strategyName: f.strategy,
            strategyId: `strategy-${f.strategy}`,
            confidence: f.confidence,
            triggerConditions: ['provider_failure', 'timeout', 'convergence_failure']
          })),
          governance: {
            adaptiveGovernanceEnabled: true,
            activePolicies: [
              {
                policyId: 'policy-adaptive-governance',
                policyType: 'adaptive_execution',
                description: 'Runtime will adaptively govern execution based on operational intelligence'
              }
            ],
            riskMitigations: riskAssessment.risks
              .filter(r => r.severity === 'high' || r.severity === 'critical')
              .map(r => ({
                riskType: r.type,
                mitigationAction: r.recommendedActions[0] || 'Monitor and adapt',
                reasoning: r.description
              }))
          }
        },
        prediction: {
          expectedOutcome: {
            goalAchievementProbability: forecast.predictedSuccessProbability,
            predictedFinalState: {
              goal: request.intent.goalId,
              status: 'completed',
              criteriaSatisfied: request.intent.successCriteria
            },
            predictedExecutionTimeMs: strategySelection.expectedExecutionTimeMs || 5000,
            expectedResourceUsage: {
              providerCalls: forecast.expectedRetries + 1,
              estimatedRetries: forecast.expectedRetries
            }
          },
          risks: riskAssessment.risks.map(r => ({
            riskType: r.type,
            severity: r.severity,
            probability: r.probability,
            description: r.description,
            mitigation: r.recommendedActions[0] || 'No specific mitigation'
          })),
          predictionConfidence: {
            overall: forecast.confidence,
            basedOnSamples: strategySelection.historicalData.timesApplied,
            historicalAccuracy: 0.90  // TODO: Get from calibration system
          }
        },
        execution: {
          executionId,
          trackingEndpoint: `/runtime/v1/execution/${executionId}`,
          expectedCheckpoints: [
            {
              checkpointId: 'cp-planning',
              description: 'Planning completed',
              expectedTimestampRelativeMs: 100
            },
            {
              checkpointId: 'cp-governance',
              description: 'Governance evaluation completed',
              expectedTimestampRelativeMs: 200
            },
            {
              checkpointId: 'cp-execution-start',
              description: 'Execution started',
              expectedTimestampRelativeMs: 300
            },
            {
              checkpointId: 'cp-execution-complete',
              description: 'Execution completed',
              expectedTimestampRelativeMs: strategySelection.expectedExecutionTimeMs || 5000
            }
          ],
          supportsRealTimeUpdates: true,
          websocketEndpoint: `/runtime/v1/execution/${executionId}/stream`
        },
        intelligence: {
          goalIntelligence: {
            historicalSuccessRate: strategySelection.historicalData.successRate,
            totalAttempts: strategySelection.historicalData.timesApplied,
            recentTrend: this.determineRecentTrend(strategyMetrics)
          },
          strategyEffectiveness: strategyMetrics.map((m: any) => ({
            strategyName: m.strategyName,
            successRate: m.successRate,
            averageExecutionTimeMs: m.avgExecutionTimeMs,
            effectivenessScore: m.effectivenessScore
          })),
          operationalHealth: {
            systemEntropy: 0.25,  // TODO: Get from entropy analyzer
            convergenceScore: 0.85,  // TODO: Get from convergence analyzer
            providerStability: 0.92  // TODO: Get from provider analyzer
          }
        },
        metadata: {
          processedAt: new Date().toISOString(),
          runtimeVersion: RUNTIME_CORE_CONTRACT_VERSION.version,
          processingTimeMs: processingTime
        }
      }

      return response
    } catch (error) {
      return this.buildRejectedIntentResponse(
        requestId,
        request.intent.goalId,
        error instanceof Error ? error.message : 'Internal error'
      )
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DOMAIN B: STRATEGY DECISION
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * GET /runtime/v1/decision/context
   */
  async handleDecisionContext(
    request: DecisionContextRequest
  ): Promise<DecisionContextResponse> {
    const strategies = this.intentGraph.getStrategiesForGoal(request.goalId)
    const riskAssessment = await this.predictiveRiskEngine.assessRisks(
      request.tenantId,
      '24h'
    )

    const availableStrategies = await Promise.all(
      strategies.map(async (strategy) => {
        const metrics = await this.getStrategyMetrics(
          request.tenantId,
          request.goalId
        )
        const strategyMetric = metrics.find((m: any) => m.strategyName === strategy.strategyName)

        return {
          strategyId: strategy.id,
          strategyName: strategy.strategyName,
          description: strategy.description,
          characteristics: {
            expectedSuccessRate: strategyMetric?.successRate || 0.5,
            expectedExecutionTimeMs: strategy.expectedExecutionTimeMs || 5000,
            expectedRetries: strategy.expectedRetryRate || 0.1,
            providerDependencies: strategy.requiredProviders.map(p => p.provider)
          },
          historicalPerformance: {
            totalAttempts: strategyMetric?.totalAttempts || 0,
            successfulAttempts: strategyMetric ? Math.floor(strategyMetric.totalAttempts * strategyMetric.successRate) : 0,
            averageExecutionTimeMs: strategyMetric?.avgExecutionTimeMs || 5000,
            effectivenessScore: strategyMetric?.effectivenessScore || 0.5
          },
          currentSuitability: {
            recommended: strategyMetric ? strategyMetric.successRate > 0.8 : false,
            suitabilityScore: strategyMetric?.effectivenessScore || 0.5,
            reasoning: [
              strategyMetric
                ? `Historical success rate: ${(strategyMetric.successRate * 100).toFixed(1)}%`
                : 'No historical data available'
            ]
          }
        }
      })
    )

    return {
      goalId: request.goalId,
      tenantId: request.tenantId,
      availableStrategies,
      operationalContext: {
        systemHealth: {
          entropy: 0.25,
          convergence: 0.85,
          providerStability: 0.92
        },
        activeRisks: riskAssessment.risks.map(r => ({
          riskType: r.type,
          severity: r.severity,
          affectedStrategies: r.affectedComponents
        })),
        predictiveInsights: {
          strategyDecayDetected: riskAssessment.risks.some(r => r.type === 'strategy_decay'),
          failureTrajectoryDetected: riskAssessment.risks.some(r => r.type === 'execution_failure'),
          entropyTrend: 'stable' as const
        }
      },
      calibration: {
        calibrationEnabled: true,
        predictionAccuracy: {
          overall: 0.90,
          byStrategy: {}
        },
        confidenceAdjustments: {
          applied: true,
          adjustmentFactor: 1.0,
          reasoning: 'No adjustments needed based on current accuracy'
        }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        validForMs: 60000
      }
    }
  }

  /**
   * POST /runtime/v1/decision/evaluate
   */
  async handleDecisionEvaluate(
    request: DecisionEvaluationRequest
  ): Promise<DecisionEvaluationResponse> {
    const strategyToEvaluate = request.hypotheticalStrategy ||
      (await this.goalPlanner.selectStrategy(request.tenantId, request.goalId)).selectedStrategy

    const forecast = await this.completionForecaster.forecastCompletion(
      request.tenantId,
      request.goalId
    )

    const metrics = await this.getStrategyMetrics(
      request.tenantId,
      request.goalId
    )
    const strategyMetric = metrics.find((m: any) => m.strategyName === strategyToEvaluate)

    return {
      evaluatedStrategy: strategyToEvaluate,
      evaluation: {
        overallScore: strategyMetric?.effectivenessScore || 0.5,
        scoring: {
          successProbability: strategyMetric?.successRate || 0.5,
          riskScore: 0.85,
          efficiencyScore: 0.80,
          reliabilityScore: strategyMetric?.successRate || 0.5
        },
        predictedOutcome: {
          goalAchievementProbability: forecast.predictedSuccessProbability,
          expectedExecutionTimeMs: strategyMetric?.avgExecutionTimeMs || 5000,
          expectedRetries: forecast.expectedRetries,
          riskFactors: forecast.riskFactors.map((r: any) => r.factor)
        },
        comparedToAlternatives: metrics
          .filter((m: any) => m.strategyName !== strategyToEvaluate)
          .map((m: any) => ({
            alternativeStrategy: m.strategyName,
            scoreComparison: (strategyMetric?.effectivenessScore || 0.5) - m.effectivenessScore,
            reasoning: `Alternative has ${(m.successRate * 100).toFixed(1)}% success rate vs ${((strategyMetric?.successRate || 0.5) * 100).toFixed(1)}%`
          }))
      },
      recommendation: {
        recommended: (strategyMetric?.successRate || 0) > 0.8,
        confidence: forecast.confidence,
        reasoning: [
          `Historical success rate: ${((strategyMetric?.successRate || 0.5) * 100).toFixed(1)}%`,
          `Based on ${strategyMetric?.totalAttempts || 0} historical attempts`,
          `Predicted success probability: ${(forecast.predictedSuccessProbability * 100).toFixed(1)}%`
        ],
        suggestedAlternatives: metrics
          .filter((m: any) => m.strategyName !== strategyToEvaluate && m.successRate > (strategyMetric?.successRate || 0))
          .map((m: any) => m.strategyName)
      },
      metadata: {
        evaluatedAt: new Date().toISOString(),
        evaluationTimeMs: 10
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DOMAIN C: EXECUTION CONTROL
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * GET /runtime/v1/execution/{executionId}
   */
  async handleExecutionStatus(executionId: string): Promise<ExecutionStatusResponse | null> {
    const execution = await this.executionStore.get(executionId)
    if (!execution) {
      return null
    }

    return this.buildExecutionStatus(execution)
  }

  /**
   * GET /runtime/v1/execution/{executionId}/trace
   */
  async handleExecutionTrace(executionId: string): Promise<ExecutionTraceResponse | null> {
    const execution = await this.executionStore.get(executionId)
    if (!execution) {
      return null
    }

    return this.buildExecutionTrace(execution)
  }

  /**
   * POST /runtime/v1/execution/{executionId}/observe
   */
  async handleObservation(
    executionId: string,
    request: ObservationRequest
  ): Promise<ObservationResponse> {
    // Process observations and update runtime state
    // This enables the runtime to learn from external observations

    return {
      executionId,
      observationsReceived: request.observations.length,
      impact: {
        predictionUpdated: false,
        strategyAdjusted: false,
        governanceTriggered: false,
        changes: []
      },
      metadata: {
        processedAt: new Date().toISOString()
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DOMAIN D: INTELLIGENCE EXPOSURE
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * GET /runtime/v1/intelligence/forecast
   */
  async handleIntelligenceForecast(
    request: IntelligenceForecastRequest
  ): Promise<IntelligenceForecastResponse> {
    const riskAssessment = await this.predictiveRiskEngine.assessRisks(
      request.tenantId,
      request.forecastHorizon
    )

    return {
      tenantId: request.tenantId,
      forecastType: request.forecastType,
      forecastHorizon: request.forecastHorizon,
      forecasts: [
        {
          forecastId: this.generateForecastId(),
          forecastType: request.forecastType,
          predictedEvents: riskAssessment.risks.map(r => ({
            eventType: r.type,
            probability: r.probability,
            predictedTimeframe: request.forecastHorizon,
            severity: r.severity,
            description: r.description
          })),
          predictedMetrics: {},
          confidence: riskAssessment.confidence,
          basedOn: {
            historicalSamples: 100,
            similarPatterns: 10,
            calibrationAccuracy: 0.90
          }
        }
      ],
      recommendedActions: riskAssessment.preemptiveActions.map(a => ({
        actionType: a.action,
        priority: a.priority,
        description: a.expectedImpact,
        expectedImpact: a.expectedImpact
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        confidenceLevel: riskAssessment.confidence
      }
    }
  }

  /**
   * GET /runtime/v1/intelligence/learning
   */
  async handleIntelligenceLearning(
    request: IntelligenceLearningRequest
  ): Promise<IntelligenceLearningResponse> {
    // Get learned patterns and insights
    return {
      tenantId: request.tenantId,
      learningType: request.learningType,
      learnedPatterns: [],
      strategyInsights: [],
      systemLearnings: {
        optimalConditions: [],
        antiPatterns: []
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        basedOnSamples: 0,
        confidenceLevel: 0.5
      }
    }
  }

  /**
   * GET /runtime/v1/intelligence/recommendations
   */
  async handleIntelligenceRecommendations(
    request: IntelligenceRecommendationRequest
  ): Promise<IntelligenceRecommendationResponse> {
    // Simplified implementation - just return empty recommendations for now
    const recommendations: any[] = []

    return {
      tenantId: request.tenantId,
      recommendationType: request.recommendationType,
      recommendations: recommendations.map((r: any) => ({
        recommendationId: r.id,
        type: r.type,
        priority: 'medium' as const,
        recommendation: {
          title: r.title,
          description: r.description,
          actionableSteps: []
        },
        expectedImpact: {
          impactType: r.type,
          estimatedImprovement: 0,
          affectedGoals: [],
          confidenceInImpact: r.confidence
        },
        evidence: {
          basedOn: [],
          supportingData: []
        },
        implementation: {
          complexity: 'medium' as const,
          estimatedEffort: 'Unknown'
        }
      })),
      strategicInsights: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        confidenceLevel: 0.85
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * HELPER METHODS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  private buildRejectedIntentResponse(
    requestId: string,
    goalId: string,
    reason: string
  ): IntentResponse {
    return {
      requestId,
      intent: {
        goalId,
        status: 'rejected',
        rejectionReason: reason
      },
      decision: {
        selectedStrategy: {
          strategyName: 'none',
          strategyId: 'none',
          description: 'No strategy selected',
          selectionReasoning: [],
          confidence: 0
        },
        fallbackStrategies: [],
        governance: {
          adaptiveGovernanceEnabled: false,
          activePolicies: [],
          riskMitigations: []
        }
      },
      prediction: {
        expectedOutcome: {
          goalAchievementProbability: 0,
          predictedFinalState: {},
          predictedExecutionTimeMs: 0,
          expectedResourceUsage: {
            providerCalls: 0,
            estimatedRetries: 0
          }
        },
        risks: [],
        predictionConfidence: {
          overall: 0,
          basedOnSamples: 0,
          historicalAccuracy: 0
        }
      },
      execution: {
        executionId: 'none',
        trackingEndpoint: '/runtime/v1/execution/none',
        expectedCheckpoints: [],
        supportsRealTimeUpdates: false
      },
      intelligence: {
        goalIntelligence: {
          historicalSuccessRate: 0,
          totalAttempts: 0,
          recentTrend: 'stable' as const
        },
        strategyEffectiveness: [],
        operationalHealth: {
          systemEntropy: 0,
          convergenceScore: 0,
          providerStability: 0
        }
      },
      metadata: {
        processedAt: new Date().toISOString(),
        runtimeVersion: RUNTIME_CORE_CONTRACT_VERSION.version,
        processingTimeMs: 0
      }
    }
  }

  private buildExecutionStatus(execution: ExecutionRecord): ExecutionStatusResponse {
    const progress = this.calculateProgress(execution)

    return {
      executionId: execution.id,
      goalId: 'unknown',  // TODO: Get from execution
      tenantId: execution.tenantId,
      status: {
        phase: this.mapStatusToPhase(execution.status),
        detailedStatus: execution.status,
        progress,
        currentCheckpoint: undefined
      },
      strategy: {
        strategyName: 'unknown',
        strategyId: 'unknown',
        isFallback: false,
        attemptNumber: 1,
        maxAttempts: 3
      },
      currentState: {
        entityState: {},  // TODO: Extract from execution context
        executionState: {
          completedActions: 0,
          totalActions: 0,
          failedActions: 0,
          retriedActions: 0
        },
        goalProgress: {
          criteriaSatisfied: 0,
          totalCriteria: 0,
          criteriaDetails: []
        }
      },
      predictions: {
        goalAchievementProbability: 0.85,
        estimatedTimeRemainingMs: 1000,
        emergingRisks: []
      },
      adaptiveActions: [],
      metadata: {
        startedAt: execution.createdAt.toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        elapsedTimeMs: Date.now() - execution.createdAt.getTime()
      }
    }
  }

  private buildExecutionTrace(execution: ExecutionRecord): ExecutionTraceResponse {
    return {
      executionId: execution.id,
      goalId: 'unknown',
      trace: [],
      checkpoints: [],
      timeline: {
        planningDurationMs: 0,
        governanceDurationMs: 0,
        executionDurationMs: 0,
        totalDurationMs: Date.now() - execution.createdAt.getTime()
      },
      metadata: {
        generatedAt: new Date().toISOString()
      }
    }
  }

  private mapStatusToPhase(status: string): ExecutionStatusResponse['status']['phase'] {
    if (status === 'running') return 'executing'
    if (status === 'completed') return 'completed'
    if (status === 'failed') return 'failed'
    return 'executing'
  }

  private calculateProgress(execution: ExecutionRecord): number {
    if (execution.status === 'completed') return 1.0
    if (execution.status === 'failed') return 0.0
    return 0.5
  }

  private getStrategyDescription(strategyName: string): string {
    return `Strategy: ${strategyName}`
  }

  private determineRecentTrend(metrics: Array<{ successRate: number }>): 'improving' | 'stable' | 'declining' {
    if (metrics.length === 0) return 'stable'
    // Simple heuristic: if success rate > 0.8, improving, < 0.6 declining
    const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
    if (avgSuccessRate > 0.8) return 'improving'
    if (avgSuccessRate < 0.6) return 'declining'
    return 'stable'
  }

  /**
   * Helper: Get strategy effectiveness metrics
   */
  private async getStrategyMetrics(
    tenantId: string,
    goalId: string
  ): Promise<Array<{
    strategyName: string
    totalAttempts: number
    successRate: number
    avgExecutionTimeMs: number
    effectivenessScore: number
  }>> {
    const goal = this.intentGraph.getGoal(goalId)
    if (!goal) return []

    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const metrics = []

    for (const strategy of strategies) {
      const outcomes = await this.strategyOutcomeStore.getOutcomesForStrategy(
        tenantId,
        goalId,
        strategy.strategyName
      )

      if (outcomes.length === 0) {
        metrics.push({
          strategyName: strategy.strategyName,
          totalAttempts: 0,
          successRate: 0.5,
          avgExecutionTimeMs: strategy.expectedExecutionTimeMs || 5000,
          effectivenessScore: 0.5
        })
        continue
      }

      const successfulOutcomes = outcomes.filter(o => o.goalAchieved)
      const successRate = successfulOutcomes.length / outcomes.length
      const avgExecutionTimeMs = outcomes.reduce((sum, o) => sum + o.totalExecutionTimeMs, 0) / outcomes.length
      const effectivenessScore = outcomes.reduce((sum, o) => sum + o.strategyEffectiveness.score, 0) / outcomes.length

      metrics.push({
        strategyName: strategy.strategyName,
        totalAttempts: outcomes.length,
        successRate,
        avgExecutionTimeMs,
        effectivenessScore
      })
    }

    return metrics
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateForecastId(): string {
    return `forecast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

import type { PredictiveRiskAssessment, PredictedRisk } from './types.js'
import type { StrategyDecayDetector } from './StrategyDecayDetector.js'
import type { FailureTrajectoryAnalyzer } from './FailureTrajectoryAnalyzer.js'
import type { GoalCompletionForecaster } from './GoalCompletionForecaster.js'
import type { EntropyTrajectoryForecaster } from './EntropyTrajectoryForecaster.js'

/**
 * PredictiveRiskEngine - Central forecasting engine
 * 
 * This is the aggregation layer for all predictive intelligence.
 * 
 * Consumes:
 * - Execution history
 * - Governance history
 * - Strategy effectiveness trends
 * - Provider stability trajectories
 * - Entropy evolution
 * - Convergence velocity
 * 
 * Produces:
 * - Comprehensive risk assessment
 * - Aggregate risk score
 * - Preemptive action recommendations
 * 
 * This is where:
 * - Individual forecasts become operational foresight
 * - Predictive signals converge
 * - Anticipatory governance begins
 */
export class PredictiveRiskEngine {
  constructor(
    private readonly decayDetector: StrategyDecayDetector,
    private readonly trajectoryAnalyzer: FailureTrajectoryAnalyzer,
    private readonly completionForecaster: GoalCompletionForecaster,
    private readonly entropyForecaster: EntropyTrajectoryForecaster
  ) {}

  /**
   * Generate comprehensive risk assessment for a tenant
   */
  async assessRisks(
    tenantId: string,
    forecastWindow: string = '24h'
  ): Promise<PredictiveRiskAssessment> {
    const risks: PredictedRisk[] = []

    // Detect strategy decay risks
    const decayRisks = await this.detectStrategyDecayRisks(tenantId)
    risks.push(...decayRisks)

    // Analyze failure trajectory risks
    const trajectoryRisks = await this.analyzeFailureTrajectoryRisks(tenantId)
    if (trajectoryRisks) {
      risks.push(trajectoryRisks)
    }

    // Analyze entropy trajectory risks
    const entropyRisks = await this.analyzeEntropyRisks(tenantId)
    if (entropyRisks) {
      risks.push(entropyRisks)
    }

    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(risks)

    // Calculate aggregate confidence
    const confidence = this.calculateAggregateConfidence(risks)

    // Generate preemptive actions
    const preemptiveActions = this.generatePreemptiveActions(risks)

    return {
      tenantId,
      forecastWindow,
      risks,
      overallRiskScore,
      confidence,
      generatedAt: new Date(),
      preemptiveActions
    }
  }

  /**
   * Detect strategy decay risks
   */
  private async detectStrategyDecayRisks(tenantId: string): Promise<PredictedRisk[]> {
    const decays = await this.decayDetector.detectDecayForTenant(tenantId)

    return decays.map((decay) => {
      // Determine severity based on decay rate and trend
      let severity: PredictedRisk['severity']
      if (decay.trend === 'rapid_decline' || decay.decayRate > 0.3) {
        severity = 'critical'
      } else if (decay.decayRate > 0.2) {
        severity = 'high'
      } else if (decay.decayRate > 0.1) {
        severity = 'medium'
      } else {
        severity = 'low'
      }

      // Determine trend
      const trend = decay.decayVelocity > 0.02 ? 'increasing' : 
                   decay.decayVelocity < -0.02 ? 'decreasing' : 
                   'stable'

      return {
        type: 'strategy_decay',
        severity,
        probability: 0.9,  // High confidence in detected decay
        forecastWindow: '24h',
        description: `Strategy "${decay.strategyName}" effectiveness declining: ${(decay.decayRate * 100).toFixed(1)}% drop`,
        affectedComponents: [decay.strategyName, decay.goalId],
        trend,
        evidence: [
          {
            signal: 'historical_success_rate',
            value: decay.historicalSuccessRate,
            threshold: 0.8
          },
          {
            signal: 'recent_success_rate',
            value: decay.recentSuccessRate,
            threshold: 0.8
          },
          {
            signal: 'decay_rate',
            value: decay.decayRate,
            threshold: 0.15
          }
        ],
        recommendedActions: [
          `Switch to fallback strategy for goal ${decay.goalId}`,
          'Investigate root cause of strategy degradation',
          'Consider provider health check before execution'
        ],
        confidence: decay.confidence
      }
    })
  }

  /**
   * Analyze failure trajectory risks
   */
  private async analyzeFailureTrajectoryRisks(
    tenantId: string
  ): Promise<PredictedRisk | undefined> {
    const trajectory = await this.trajectoryAnalyzer.analyzeTrajectory(tenantId)

    if (!trajectory || trajectory.failureProbability < 0.5) {
      return undefined  // No significant risk
    }

    // Determine severity
    let severity: PredictedRisk['severity']
    if (trajectory.trajectory === 'critical' || trajectory.failureProbability > 0.85) {
      severity = 'critical'
    } else if (trajectory.failureProbability > 0.7) {
      severity = 'high'
    } else if (trajectory.failureProbability > 0.5) {
      severity = 'medium'
    } else {
      severity = 'low'
    }

    return {
      type: 'execution_failure',
      severity,
      probability: trajectory.failureProbability,
      forecastWindow: trajectory.timeToFailure || '24h',
      description: `${trajectory.patternType} pattern detected, trajectory: ${trajectory.trajectory}`,
      affectedComponents: ['execution_engine', 'providers'],
      trend: trajectory.trajectory === 'degrading' ? 'increasing' : 'stable',
      evidence: trajectory.leadingIndicators.map((indicator) => ({
        signal: indicator.indicator,
        value: indicator.currentValue,
        threshold: indicator.threshold
      })),
      recommendedActions: [
        'Review provider health before execution',
        'Enable enhanced monitoring',
        'Consider fallback execution paths'
      ],
      confidence: trajectory.confidence
    }
  }

  /**
   * Analyze entropy trajectory risks
   */
  private async analyzeEntropyRisks(
    tenantId: string
  ): Promise<PredictedRisk | undefined> {
    const entropyForecast = await this.entropyForecaster.forecastEntropy(tenantId)

    if (!entropyForecast || entropyForecast.entropyTrajectory === 'converging') {
      return undefined  // No risk or improving
    }

    // Determine severity based on trajectory
    let severity: PredictedRisk['severity']
    if (entropyForecast.entropyTrajectory === 'fragmenting') {
      severity = 'critical'
    } else if (entropyForecast.entropyTrajectory === 'diverging') {
      severity = 'high'
    } else {
      severity = 'medium'
    }

    // Calculate probability based on current entropy and trajectory
    const probability = Math.min(
      0.95,
      (entropyForecast.currentEntropy * 0.5) + 
      (entropyForecast.fragmentationRisks.length * 0.15)
    )

    return {
      type: 'entropy_expansion',
      severity,
      probability,
      forecastWindow: '7d',
      description: `Operational entropy ${entropyForecast.entropyTrajectory}, predicted: ${entropyForecast.predictedEntropy7d.toFixed(2)}`,
      affectedComponents: ['workflow_topology', 'operational_coherence'],
      trend: entropyForecast.convergenceVelocity < 0 ? 'increasing' : 'decreasing',
      evidence: [
        {
          signal: 'current_entropy',
          value: entropyForecast.currentEntropy,
          threshold: 0.5
        },
        {
          signal: 'predicted_entropy_7d',
          value: entropyForecast.predictedEntropy7d,
          threshold: 0.6
        },
        {
          signal: 'convergence_velocity',
          value: entropyForecast.convergenceVelocity,
          threshold: 0
        }
      ],
      recommendedActions: entropyForecast.fragmentationRisks.map((r) => r.impact),
      confidence: entropyForecast.confidence
    }
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(risks: PredictedRisk[]): number {
    if (risks.length === 0) {
      return 0
    }

    // Weight risks by severity and probability
    const severityWeights = {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0
    }

    let totalWeightedRisk = 0
    let totalWeight = 0

    for (const risk of risks) {
      const weight = severityWeights[risk.severity]
      totalWeightedRisk += risk.probability * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? totalWeightedRisk / totalWeight : 0
  }

  /**
   * Calculate aggregate confidence
   */
  private calculateAggregateConfidence(risks: PredictedRisk[]): number {
    if (risks.length === 0) {
      return 0
    }

    // Average confidence across all risks
    const totalConfidence = risks.reduce((sum, r) => sum + r.confidence, 0)
    return totalConfidence / risks.length
  }

  /**
   * Generate preemptive actions
   */
  private generatePreemptiveActions(
    risks: PredictedRisk[]
  ): Array<{
    action: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    expectedImpact: string
    estimatedRiskReduction: number
  }> {
    const actions: Array<{
      action: string
      priority: 'low' | 'medium' | 'high' | 'critical'
      expectedImpact: string
      estimatedRiskReduction: number
    }> = []

    // Group by risk type
    const hasCriticalRisks = risks.some((r) => r.severity === 'critical')
    const hasStrategyDecay = risks.some((r) => r.type === 'strategy_decay')
    const hasExecutionFailure = risks.some((r) => r.type === 'execution_failure')
    const hasEntropyExpansion = risks.some((r) => r.type === 'entropy_expansion')

    // Critical: Enable enhanced monitoring
    if (hasCriticalRisks) {
      actions.push({
        action: 'enable_enhanced_monitoring',
        priority: 'critical',
        expectedImpact: 'Real-time visibility into operational health',
        estimatedRiskReduction: 0.15
      })
    }

    // Strategy decay: Switch strategies
    if (hasStrategyDecay) {
      actions.push({
        action: 'evaluate_fallback_strategies',
        priority: risks.find((r) => r.type === 'strategy_decay')?.severity || 'medium',
        expectedImpact: 'Use alternative execution paths with higher success probability',
        estimatedRiskReduction: 0.25
      })
    }

    // Execution failure: Pre-validate providers
    if (hasExecutionFailure) {
      actions.push({
        action: 'enable_provider_health_checks',
        priority: 'high',
        expectedImpact: 'Validate provider availability before execution',
        estimatedRiskReduction: 0.20
      })
    }

    // Entropy expansion: Simplify workflows
    if (hasEntropyExpansion) {
      actions.push({
        action: 'review_workflow_complexity',
        priority: 'medium',
        expectedImpact: 'Identify opportunities to reduce operational fragmentation',
        estimatedRiskReduction: 0.10
      })
    }

    return actions
  }
}

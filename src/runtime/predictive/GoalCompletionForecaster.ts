import type { GoalCompletionForecast, StrategyDecay } from './types.js'
import type { GoalPlanner } from '../intent/GoalPlanner.js'
import type { StrategyOutcomeStore } from '../intent/StrategyOutcomeStore.js'
import type { StrategyDecayDetector } from './StrategyDecayDetector.js'

/**
 * GoalCompletionForecaster - Forecasts goal completion probability
 * 
 * This predicts:
 * - Probability of successful goal completion
 * - Likely fallback requirements
 * - Expected retries
 * - Expected convergence impact
 * 
 * BEFORE execution begins.
 * 
 * This is the first form of:
 * - proactive execution planning
 * - risk-informed goal pursuit
 * - anticipatory resource allocation
 * 
 * Example output:
 * {
 *   "goal": "obtain_signed_contract",
 *   "predictedSuccessProbability": 0.82,
 *   "riskFactors": [
 *     "provider_instability",
 *     "strategy_decay"
 *   ],
 *   "recommendedPreemptiveAction": [
 *     "switch_primary_provider:docusign"
 *   ]
 * }
 */
export class GoalCompletionForecaster {
  constructor(
    private readonly goalPlanner: GoalPlanner,
    private readonly outcomeStore: StrategyOutcomeStore,
    private readonly decayDetector: StrategyDecayDetector
  ) {}

  /**
   * Forecast goal completion for a specific goal
   */
  async forecastCompletion(
    tenantId: string,
    goalId: string
  ): Promise<GoalCompletionForecast> {
    // Get recommended strategy from planner
    const strategySelection = await this.goalPlanner.selectStrategy(tenantId, goalId)

    // Check for strategy decay
    const decay = await this.decayDetector.detectDecay(
      tenantId,
      goalId,
      strategySelection.selectedStrategy
    )

    // Calculate base success probability
    let predictedSuccessProbability = strategySelection.expectedSuccessProbability

    // Adjust for decay
    if (decay) {
      predictedSuccessProbability = decay.predictedSuccessRate24h
    }

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(strategySelection, decay)

    // Calculate expected outcomes
    const expectedRetries = strategySelection.expectedRetryRate || 0
    const expectedExecutionTimeMs = strategySelection.expectedExecutionTimeMs || 0
    const expectedConvergenceImpact = await this.estimateConvergenceImpact(tenantId, goalId)

    // Calculate fallback probability
    const fallbackRequirementProbability = this.calculateFallbackProbability(
      predictedSuccessProbability,
      riskFactors
    )

    // Generate preemptive recommendations
    const recommendedPreemptiveActions = this.generatePreemptiveActions(
      riskFactors,
      decay,
      strategySelection
    )

    // Calculate confidence
    const confidence = this.calculateConfidence(
      strategySelection.historicalData.timesApplied,
      decay
    )

    return {
      goalId,
      tenantId,
      predictedSuccessProbability,
      riskFactors,
      expectedRetries,
      expectedExecutionTimeMs,
      expectedConvergenceImpact,
      fallbackRequirementProbability,
      recommendedPreemptiveActions,
      confidence,
      forecastedAt: new Date()
    }
  }

  /**
   * Identify risk factors for goal completion
   */
  private identifyRiskFactors(
    strategySelection: any,
    decay: StrategyDecay | undefined
  ): Array<{
    factor: string
    impact: number
    description: string
  }> {
    const riskFactors: Array<{
      factor: string
      impact: number
      description: string
    }> = []

    // Strategy decay risk
    if (decay) {
      const impact = -decay.decayRate  // Negative impact
      riskFactors.push({
        factor: 'strategy_decay',
        impact,
        description: `Strategy effectiveness declining: ${(decay.decayRate * 100).toFixed(1)}% drop`
      })
    }

    // Low confidence risk
    if (strategySelection.confidence < 0.6) {
      riskFactors.push({
        factor: 'low_confidence',
        impact: -0.2,
        description: `Strategy selection confidence is low: ${(strategySelection.confidence * 100).toFixed(0)}%`
      })
    }

    // High retry rate risk
    if (strategySelection.expectedRetryRate > 0.2) {
      riskFactors.push({
        factor: 'high_retry_rate',
        impact: -0.15,
        description: `Expected retry rate is high: ${(strategySelection.expectedRetryRate * 100).toFixed(0)}%`
      })
    }

    // Low historical success rate
    if (strategySelection.expectedSuccessProbability < 0.7) {
      riskFactors.push({
        factor: 'low_historical_success',
        impact: -0.1,
        description: `Historical success rate is low: ${(strategySelection.expectedSuccessProbability * 100).toFixed(0)}%`
      })
    }

    return riskFactors
  }

  /**
   * Estimate convergence impact
   */
  private async estimateConvergenceImpact(
    tenantId: string,
    goalId: string
  ): Promise<number> {
    // Get historical outcomes for this goal
    const outcomes = await this.outcomeStore.getOutcomesForGoal(tenantId, goalId)

    if (outcomes.length === 0) {
      return 0  // Unknown impact
    }

    // Calculate average impact on convergence
    // (This would ideally look at before/after convergence scores)
    // For now, use a simplified estimate based on success rate
    const successRate = outcomes.filter((o: any) => o.goalAchieved).length / outcomes.length

    // Higher success rate = positive convergence impact
    return (successRate - 0.5) * 0.2  // Range: -0.1 to +0.1
  }

  /**
   * Calculate fallback probability
   */
  private calculateFallbackProbability(
    successProbability: number,
    riskFactors: any[]
  ): number {
    // Base fallback probability is inverse of success
    let fallbackProbability = 1 - successProbability

    // Increase if there are risk factors
    const riskImpact = riskFactors.reduce((sum, r) => sum + Math.abs(r.impact), 0)
    fallbackProbability = Math.min(1.0, fallbackProbability + (riskImpact * 0.5))

    return fallbackProbability
  }

  /**
   * Generate preemptive action recommendations
   */
  private generatePreemptiveActions(
    riskFactors: any[],
    decay: StrategyDecay | undefined,
    strategySelection: any
  ): Array<{
    action: string
    expectedImpact: string
    successProbabilityIncrease: number
  }> {
    const actions: Array<{
      action: string
      expectedImpact: string
      successProbabilityIncrease: number
    }> = []

    // If strategy is decaying, recommend fallback
    if (decay && decay.trend === 'rapid_decline') {
      const fallback = strategySelection.fallbackStrategies[0]
      if (fallback) {
        actions.push({
          action: `switch_to_strategy:${fallback.strategy}`,
          expectedImpact: 'Use alternative strategy with higher predicted success',
          successProbabilityIncrease: 0.15
        })
      }
    }

    // If low confidence, recommend additional validation
    if (strategySelection.confidence < 0.6) {
      actions.push({
        action: 'enable_additional_validation',
        expectedImpact: 'Add validation steps to catch early failures',
        successProbabilityIncrease: 0.08
      })
    }

    // If high retry rate expected, recommend preventive measures
    if (strategySelection.expectedRetryRate > 0.2) {
      actions.push({
        action: 'enable_provider_health_check',
        expectedImpact: 'Pre-check provider availability before execution',
        successProbabilityIncrease: 0.12
      })
    }

    return actions
  }

  /**
   * Calculate confidence in forecast
   */
  private calculateConfidence(
    historicalSamples: number,
    decay: StrategyDecay | undefined
  ): number {
    let confidence = 0

    // Base on sample size
    if (historicalSamples < 10) {
      confidence = 0.4
    } else if (historicalSamples < 30) {
      confidence = 0.6
    } else if (historicalSamples < 100) {
      confidence = 0.8
    } else {
      confidence = 0.9
    }

    // Reduce confidence if decay detected (more uncertainty)
    if (decay && decay.trend === 'rapid_decline') {
      confidence = Math.max(0.3, confidence - 0.2)
    } else if (decay) {
      confidence = Math.max(0.4, confidence - 0.1)
    }

    return confidence
  }
}

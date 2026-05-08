import type { StrategySelection, GoalDefinition, StrategyDefinition } from './types.js'
import type { StrategyOutcomeStore } from './StrategyOutcomeStore.js'
import type { IntentGraph } from './IntentGraph.js'
import type { RuntimeMemoryStore } from '../memory/RuntimeMemoryStore.js'

/**
 * GoalPlanner - Converts operational goals into executable strategies
 * 
 * This is the planning layer that answers:
 * "Given a goal, which strategy should we use?"
 * 
 * Planning is informed by:
 * - Historical strategy effectiveness
 * - Provider stability
 * - Entropy metrics
 * - Convergence scores
 * - Runtime memory
 * 
 * This is where the runtime becomes:
 *   goal-oriented rather than workflow-oriented
 */
export class GoalPlanner {
  constructor(
    private readonly intentGraph: IntentGraph,
    private readonly outcomeStore: StrategyOutcomeStore,
    private readonly memoryStore?: RuntimeMemoryStore
  ) {}

  /**
   * Select the best strategy for achieving a goal
   * 
   * This is the core planning function.
   * It analyzes historical data and runtime intelligence
   * to select the most promising strategy.
   */
  async selectStrategy(
    tenantId: string,
    goalId: string
  ): Promise<StrategySelection> {
    const goal = this.intentGraph.getGoal(goalId)
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`)
    }

    if (goal.tenantId !== tenantId) {
      throw new Error(`Goal ${goalId} does not belong to tenant ${tenantId}`)
    }

    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    if (strategies.length === 0) {
      throw new Error(`No strategies available for goal ${goalId}`)
    }

    // Score all available strategies
    const scoredStrategies = await Promise.all(
      strategies.map(strategy => this.scoreStrategy(tenantId, goalId, strategy))
    )

    // Sort by effectiveness score (descending)
    scoredStrategies.sort((a, b) => b.score - a.score)

    // Select best strategy
    const best = scoredStrategies[0]
    
    // Build fallback strategies (remaining strategies, ranked)
    const fallbacks = scoredStrategies.slice(1).map(scored => ({
      strategy: scored.strategy.strategyName,
      confidence: scored.score,
      rationale: scored.rationale
    }))

    // Get historical data for selected strategy
    const outcomes = await this.outcomeStore.getOutcomesForStrategy(
      tenantId,
      goalId,
      best.strategy.strategyName
    )

    const historicalData = this.computeHistoricalData(outcomes)

    return {
      goalId,
      selectedStrategy: best.strategy.strategyName,
      confidence: best.score,
      rationale: best.rationale,
      expectedSuccessProbability: historicalData.successRate,
      expectedExecutionTimeMs: historicalData.averageExecutionTimeMs,
      expectedRetryRate: historicalData.averageRetries,
      fallbackStrategies: fallbacks,
      historicalData
    }
  }

  /**
   * Score a strategy based on historical effectiveness
   */
  private async scoreStrategy(
    tenantId: string,
    goalId: string,
    strategy: StrategyDefinition
  ): Promise<{
    strategy: StrategyDefinition
    score: number
    rationale: string[]
  }> {
    const rationale: string[] = []
    
    // Get historical outcomes for this strategy
    const outcomes = await this.outcomeStore.getOutcomesForStrategy(
      tenantId,
      goalId,
      strategy.strategyName
    )

    if (outcomes.length === 0) {
      // No historical data - use neutral score
      rationale.push(`No historical data for strategy "${strategy.strategyName}"`)
      rationale.push('Using neutral confidence score')
      return {
        strategy,
        score: 0.5,
        rationale
      }
    }

    // Calculate success rate
    const successfulOutcomes = outcomes.filter(o => o.goalAchieved)
    const successRate = successfulOutcomes.length / outcomes.length

    // Calculate average effectiveness
    const avgEffectiveness = outcomes.reduce((sum, o) => {
      return sum + o.strategyEffectiveness.score
    }, 0) / outcomes.length

    // Calculate average execution efficiency
    const avgExecutionEfficiency = outcomes.reduce((sum, o) => {
      return sum + o.strategyEffectiveness.factors.executionEfficiency
    }, 0) / outcomes.length

    // Calculate average retry count
    const avgRetries = outcomes.reduce((sum, o) => {
      return sum + o.retryCount
    }, 0) / outcomes.length

    // Penalize high retry rates
    const retryPenalty = Math.min(avgRetries * 0.1, 0.3)

    // Compute final score
    // Weighted combination of factors
    const score = (
      successRate * 0.5 +           // Success rate is most important
      avgEffectiveness * 0.3 +       // Overall effectiveness
      avgExecutionEfficiency * 0.2 - // Execution efficiency
      retryPenalty                    // Penalty for retries
    )

    // Build rationale
    rationale.push(`Strategy "${strategy.strategyName}" historical performance:`)
    rationale.push(`  Success rate: ${(successRate * 100).toFixed(1)}% (${successfulOutcomes.length}/${outcomes.length})`)
    rationale.push(`  Average effectiveness: ${(avgEffectiveness * 100).toFixed(1)}%`)
    rationale.push(`  Average execution efficiency: ${(avgExecutionEfficiency * 100).toFixed(1)}%`)
    rationale.push(`  Average retries: ${avgRetries.toFixed(1)}`)
    rationale.push(`  Overall score: ${(score * 100).toFixed(1)}%`)

    // Check for declining trend
    const recentOutcomes = outcomes.slice(-10) // Last 10 outcomes
    if (recentOutcomes.length >= 5) {
      const recentSuccessRate = recentOutcomes.filter(o => o.goalAchieved).length / recentOutcomes.length
      if (recentSuccessRate < successRate * 0.8) {
        rationale.push(`  ⚠️  Recent trend: declining (${(recentSuccessRate * 100).toFixed(1)}% vs ${(successRate * 100).toFixed(1)}%)`)
      }
    }

    return {
      strategy,
      score: Math.max(0, Math.min(1, score)), // Clamp to [0, 1]
      rationale
    }
  }

  /**
   * Compute historical data summary
   */
  private computeHistoricalData(outcomes: any[]): {
    timesApplied: number
    successRate: number
    averageExecutionTimeMs: number
    averageRetries: number
  } {
    if (outcomes.length === 0) {
      return {
        timesApplied: 0,
        successRate: 0,
        averageExecutionTimeMs: 0,
        averageRetries: 0
      }
    }

    const successfulOutcomes = outcomes.filter((o: any) => o.goalAchieved)
    const successRate = successfulOutcomes.length / outcomes.length

    const avgExecutionTimeMs = outcomes.reduce((sum: number, o: any) => {
      return sum + o.totalExecutionTimeMs
    }, 0) / outcomes.length

    const avgRetries = outcomes.reduce((sum: number, o: any) => {
      return sum + o.retryCount
    }, 0) / outcomes.length

    return {
      timesApplied: outcomes.length,
      successRate,
      averageExecutionTimeMs: avgExecutionTimeMs,
      averageRetries: avgRetries
    }
  }

  /**
   * Get recommended strategy for a goal (alias for selectStrategy)
   */
  async planForGoal(
    tenantId: string,
    goalId: string
  ): Promise<StrategySelection> {
    return this.selectStrategy(tenantId, goalId)
  }
}

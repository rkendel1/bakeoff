import type { 
  GoalOutcome, 
  StrategyEffectivenessMetrics, 
  GoalCompletionRate 
} from './types.js'
import type { StrategyOutcomeStore } from './StrategyOutcomeStore.js'
import type { IntentGraph } from './IntentGraph.js'

/**
 * GoalOutcomeEvaluator - Measures goal completion success and strategy effectiveness
 * 
 * This is the learning and measurement layer of intent execution.
 * 
 * It answers:
 * - How well are we achieving goals?
 * - Which strategies are most effective?
 * - Where are the failure patterns?
 * - What's trending better or worse?
 * 
 * This is operational intelligence for goal-oriented execution.
 */
export class GoalOutcomeEvaluator {
  // Confidence thresholds (same pattern as StrategyEffectivenessAnalyzer)
  private readonly CONFIDENCE_LOW_THRESHOLD = 5
  private readonly CONFIDENCE_MEDIUM_THRESHOLD = 20
  private readonly CONFIDENCE_GOOD_THRESHOLD = 50

  constructor(
    private readonly outcomeStore: StrategyOutcomeStore,
    private readonly intentGraph: IntentGraph
  ) {}

  /**
   * Evaluate strategy effectiveness for a goal
   * 
   * Computes aggregate metrics showing how well a strategy
   * achieves its goal over time.
   */
  async evaluateStrategyEffectiveness(
    tenantId: string,
    goalId: string,
    strategyName: string
  ): Promise<StrategyEffectivenessMetrics> {
    const outcomes = await this.outcomeStore.getOutcomesForStrategy(
      tenantId,
      goalId,
      strategyName
    )

    if (outcomes.length === 0) {
      return {
        strategyName,
        goalId,
        tenantId,
        totalAttempts: 0,
        successfulAttempts: 0,
        successRate: 0,
        averageExecutionTimeMs: 0,
        averageRetries: 0,
        averageProviderFailures: 0,
        effectivenessScore: 0,
        recentTrend: 'stable',
        confidence: 0,
        computedAt: new Date()
      }
    }

    // Calculate metrics
    const successfulOutcomes = outcomes.filter(o => o.goalAchieved)
    const successRate = successfulOutcomes.length / outcomes.length

    const avgExecutionTime = outcomes.reduce((sum, o) => sum + o.totalExecutionTimeMs, 0) / outcomes.length
    const avgRetries = outcomes.reduce((sum, o) => sum + o.retryCount, 0) / outcomes.length
    const avgProviderFailures = outcomes.reduce((sum, o) => sum + o.providerFailures, 0) / outcomes.length

    // Calculate effectiveness score (weighted combination)
    const avgEffectiveness = outcomes.reduce((sum, o) => {
      return sum + o.strategyEffectiveness.score
    }, 0) / outcomes.length

    // Analyze trend
    const trend = this.analyzeTrend(outcomes)

    // Calculate confidence
    const confidence = this.calculateConfidence(outcomes.length)

    return {
      strategyName,
      goalId,
      tenantId,
      totalAttempts: outcomes.length,
      successfulAttempts: successfulOutcomes.length,
      successRate,
      averageExecutionTimeMs: avgExecutionTime,
      averageRetries: avgRetries,
      averageProviderFailures: avgProviderFailures,
      effectivenessScore: avgEffectiveness,
      recentTrend: trend,
      confidence,
      computedAt: new Date()
    }
  }

  /**
   * Evaluate goal completion rate
   * 
   * Shows how well the runtime is achieving a specific goal
   * across all strategies.
   */
  async evaluateGoalCompletionRate(
    tenantId: string,
    goalId: string
  ): Promise<GoalCompletionRate> {
    const outcomes = await this.outcomeStore.getOutcomesForGoal(tenantId, goalId)

    if (outcomes.length === 0) {
      return {
        goalId,
        tenantId,
        totalAttempts: 0,
        successfulCompletions: 0,
        completionRate: 0,
        strategyPerformance: [],
        trendData: [],
        computedAt: new Date()
      }
    }

    // Calculate overall completion rate
    const successfulCompletions = outcomes.filter(o => o.goalAchieved).length
    const completionRate = successfulCompletions / outcomes.length

    // Break down by strategy
    const strategyMap = new Map<string, {
      attempts: number
      successes: number
      effectivenessSum: number
    }>()

    for (const outcome of outcomes) {
      if (!strategyMap.has(outcome.strategyUsed)) {
        strategyMap.set(outcome.strategyUsed, {
          attempts: 0,
          successes: 0,
          effectivenessSum: 0
        })
      }

      const data = strategyMap.get(outcome.strategyUsed)!
      data.attempts++
      if (outcome.goalAchieved) data.successes++
      data.effectivenessSum += outcome.strategyEffectiveness.score
    }

    const strategyPerformance = Array.from(strategyMap.entries()).map(([strategy, data]) => ({
      strategy,
      attempts: data.attempts,
      successRate: data.successes / data.attempts,
      effectiveness: data.effectivenessSum / data.attempts
    }))

    // Sort by effectiveness
    strategyPerformance.sort((a, b) => b.effectiveness - a.effectiveness)

    // Calculate trend data (by week)
    const trendData = this.calculateTrendData(outcomes)

    return {
      goalId,
      tenantId,
      totalAttempts: outcomes.length,
      successfulCompletions,
      completionRate,
      strategyPerformance,
      trendData,
      computedAt: new Date()
    }
  }

  /**
   * Get all strategy metrics for a tenant
   */
  async getAllStrategyMetrics(tenantId: string): Promise<StrategyEffectivenessMetrics[]> {
    const goals = this.intentGraph.getGoalsForTenant(tenantId)
    const metrics: StrategyEffectivenessMetrics[] = []

    for (const goal of goals) {
      const strategies = this.intentGraph.getStrategiesForGoal(goal.id)

      for (const strategy of strategies) {
        const strategyMetrics = await this.evaluateStrategyEffectiveness(
          tenantId,
          goal.id,
          strategy.strategyName
        )
        metrics.push(strategyMetrics)
      }
    }

    return metrics
  }

  /**
   * Get all goal completion rates for a tenant
   */
  async getAllGoalCompletionRates(tenantId: string): Promise<GoalCompletionRate[]> {
    const goals = this.intentGraph.getGoalsForTenant(tenantId)
    const rates: GoalCompletionRate[] = []

    for (const goal of goals) {
      const rate = await this.evaluateGoalCompletionRate(tenantId, goal.id)
      rates.push(rate)
    }

    return rates
  }

  /**
   * Find most effective strategy for a goal
   */
  async findMostEffectiveStrategy(
    tenantId: string,
    goalId: string
  ): Promise<StrategyEffectivenessMetrics | undefined> {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    if (strategies.length === 0) return undefined

    const metrics = await Promise.all(
      strategies.map(s => 
        this.evaluateStrategyEffectiveness(tenantId, goalId, s.strategyName)
      )
    )

    // Filter to strategies with meaningful sample size
    const qualified = metrics.filter(m => m.totalAttempts >= this.CONFIDENCE_LOW_THRESHOLD)
    
    if (qualified.length === 0) {
      // No qualified strategies, return best of what we have
      return metrics.reduce((best, current) => 
        current.effectivenessScore > best.effectivenessScore ? current : best
      )
    }

    // Return most effective qualified strategy
    return qualified.reduce((best, current) => 
      current.effectivenessScore > best.effectivenessScore ? current : best
    )
  }

  /**
   * Find declining strategies (for alerting)
   */
  async findDecliningStrategies(tenantId: string): Promise<StrategyEffectivenessMetrics[]> {
    const metrics = await this.getAllStrategyMetrics(tenantId)
    return metrics.filter(m => 
      m.recentTrend === 'declining' && 
      m.totalAttempts >= this.CONFIDENCE_LOW_THRESHOLD
    )
  }

  /**
   * Analyze trend from outcomes
   */
  private analyzeTrend(outcomes: GoalOutcome[]): 'improving' | 'stable' | 'declining' {
    if (outcomes.length < 10) return 'stable'

    // Compare recent outcomes to older outcomes
    const recentCount = Math.min(10, Math.floor(outcomes.length / 3))
    const recent = outcomes.slice(0, recentCount)
    const older = outcomes.slice(recentCount, recentCount * 2)

    if (older.length < 5) return 'stable'

    const recentSuccess = recent.filter(o => o.goalAchieved).length / recent.length
    const olderSuccess = older.filter(o => o.goalAchieved).length / older.length

    const delta = recentSuccess - olderSuccess

    if (delta > 0.15) return 'improving'
    if (delta < -0.15) return 'declining'
    return 'stable'
  }

  /**
   * Calculate confidence based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < this.CONFIDENCE_LOW_THRESHOLD) return 0.3
    if (sampleSize < this.CONFIDENCE_MEDIUM_THRESHOLD) return 0.6
    if (sampleSize < this.CONFIDENCE_GOOD_THRESHOLD) return 0.8
    return 0.95
  }

  /**
   * Calculate trend data by time period
   */
  private calculateTrendData(outcomes: GoalOutcome[]): Array<{
    period: string
    completionRate: number
    totalAttempts: number
  }> {
    // Group by week
    const weekMap = new Map<string, {
      successes: number
      total: number
    }>()

    for (const outcome of outcomes) {
      const week = this.getWeekKey(outcome.completedAt)
      
      if (!weekMap.has(week)) {
        weekMap.set(week, { successes: 0, total: 0 })
      }

      const data = weekMap.get(week)!
      data.total++
      if (outcome.goalAchieved) data.successes++
    }

    // Convert to array and sort by week
    const trendData = Array.from(weekMap.entries())
      .map(([period, data]) => ({
        period,
        completionRate: data.successes / data.total,
        totalAttempts: data.total
      }))
      .sort((a, b) => a.period.localeCompare(b.period))

    // Return last 12 weeks
    return trendData.slice(-12)
  }

  /**
   * Get week key for grouping (YYYY-WW)
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear()
    const weekNum = this.getWeekNumber(date)
    return `${year}-W${weekNum.toString().padStart(2, '0')}`
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }
}

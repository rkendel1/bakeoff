import type { StrategyDecay } from './types.js'
import type { StrategyOutcomeStore } from '../intent/StrategyOutcomeStore.js'
import type { GoalOutcome } from '../intent/types.js'

/**
 * StrategyDecayDetector - Detects when strategies lose effectiveness over time
 * 
 * This is foundational because:
 * - Runtime memory alone is insufficient
 * - We need temporal trend awareness
 * - Strategies that worked historically can degrade
 * 
 * Key insight:
 * Current system asks: "Which strategy worked best?"
 * This system asks: "Which strategy is likely to fail soon?"
 * 
 * This is trajectory awareness.
 */
export class StrategyDecayDetector {
  // Time windows for analysis
  private readonly HISTORICAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000  // 30 days
  private readonly RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000       // 7 days
  
  // Thresholds
  private readonly MIN_SAMPLES_FOR_DETECTION = 10
  private readonly DECAY_THRESHOLD = 0.15  // 15% drop is significant
  private readonly RAPID_DECAY_THRESHOLD = 0.25  // 25% drop is rapid

  constructor(
    private readonly outcomeStore: StrategyOutcomeStore
  ) {}

  /**
   * Detect strategy decay for a specific strategy
   */
  async detectDecay(
    tenantId: string,
    goalId: string,
    strategyName: string
  ): Promise<StrategyDecay | undefined> {
    // Get all outcomes for this strategy
    const outcomes = await this.outcomeStore.getOutcomesForStrategy(
      tenantId,
      goalId,
      strategyName
    )

    if (outcomes.length < this.MIN_SAMPLES_FOR_DETECTION) {
      return undefined  // Not enough data
    }

    // Separate historical and recent outcomes
    const now = Date.now()
    const recentCutoff = new Date(now - this.RECENT_WINDOW_MS)
    const historicalCutoff = new Date(now - this.HISTORICAL_WINDOW_MS)

    const recentOutcomes = outcomes.filter((o) => o.completedAt >= recentCutoff)
    const historicalOutcomes = outcomes.filter(
      (o) => o.completedAt >= historicalCutoff && o.completedAt < recentCutoff
    )

    // Need sufficient data in both windows
    if (recentOutcomes.length < 5 || historicalOutcomes.length < 5) {
      return undefined
    }

    // Calculate success rates
    const historicalSuccessRate = this.calculateSuccessRate(historicalOutcomes)
    const recentSuccessRate = this.calculateSuccessRate(recentOutcomes)

    // Calculate decay
    const decayRate = historicalSuccessRate - recentSuccessRate

    // Only report if significant decay
    if (decayRate < this.DECAY_THRESHOLD) {
      return undefined  // No significant decay
    }

    // Calculate decay velocity (rate of change)
    const decayVelocity = this.calculateDecayVelocity(outcomes)

    // Determine trend
    const trend = this.determineTrend(decayRate, decayVelocity)

    // Build data points for evidence
    const dataPoints = this.buildDataPoints(outcomes)

    // Forecast future performance
    const predictedSuccessRate24h = Math.max(
      0,
      recentSuccessRate - (decayVelocity * 1)  // 1 day
    )
    const predictedSuccessRate7d = Math.max(
      0,
      recentSuccessRate - (decayVelocity * 7)  // 7 days
    )

    // Calculate confidence
    const confidence = this.calculateConfidence(outcomes.length, decayRate)

    return {
      tenantId,
      strategyName,
      goalId,
      historicalSuccessRate,
      recentSuccessRate,
      decayRate,
      decayVelocity,
      trend,
      dataPoints,
      predictedSuccessRate24h,
      predictedSuccessRate7d,
      confidence,
      detectedAt: new Date()
    }
  }

  /**
   * Detect decay across all strategies for a goal
   */
  async detectDecayForGoal(
    tenantId: string,
    goalId: string
  ): Promise<StrategyDecay[]> {
    // Get all outcomes for this goal
    const allOutcomes = await this.outcomeStore.getOutcomesForGoal(tenantId, goalId)

    // Group by strategy
    const byStrategy = new Map<string, GoalOutcome[]>()
    for (const outcome of allOutcomes) {
      const existing = byStrategy.get(outcome.strategyUsed) || []
      existing.push(outcome)
      byStrategy.set(outcome.strategyUsed, existing)
    }

    // Detect decay for each strategy
    const decays: StrategyDecay[] = []
    for (const [strategyName] of byStrategy) {
      const decay = await this.detectDecay(tenantId, goalId, strategyName)
      if (decay) {
        decays.push(decay)
      }
    }

    // Sort by severity (highest decay rate first)
    decays.sort((a, b) => b.decayRate - a.decayRate)

    return decays
  }

  /**
   * Detect decay across all goals for a tenant
   */
  async detectDecayForTenant(tenantId: string): Promise<StrategyDecay[]> {
    const allOutcomes = await this.outcomeStore.getOutcomesForTenant(tenantId)

    // Group by goal and strategy
    const byGoalAndStrategy = new Map<string, Map<string, GoalOutcome[]>>()
    for (const outcome of allOutcomes) {
      let byStrategy = byGoalAndStrategy.get(outcome.goalId)
      if (!byStrategy) {
        byStrategy = new Map()
        byGoalAndStrategy.set(outcome.goalId, byStrategy)
      }

      const existing = byStrategy.get(outcome.strategyUsed) || []
      existing.push(outcome)
      byStrategy.set(outcome.strategyUsed, existing)
    }

    // Detect decay for each goal/strategy combination
    const decays: StrategyDecay[] = []
    for (const [goalId, byStrategy] of byGoalAndStrategy) {
      for (const [strategyName] of byStrategy) {
        const decay = await this.detectDecay(tenantId, goalId, strategyName)
        if (decay) {
          decays.push(decay)
        }
      }
    }

    // Sort by severity
    decays.sort((a, b) => b.decayRate - a.decayRate)

    return decays
  }

  /**
   * Calculate success rate from outcomes
   */
  private calculateSuccessRate(outcomes: GoalOutcome[]): number {
    if (outcomes.length === 0) return 0
    const successful = outcomes.filter((o) => o.goalAchieved).length
    return successful / outcomes.length
  }

  /**
   * Calculate decay velocity (rate of change per day)
   */
  private calculateDecayVelocity(outcomes: GoalOutcome[]): number {
    if (outcomes.length < 2) return 0

    // Sort by completion date
    const sorted = [...outcomes].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    )

    // Use sliding window to calculate velocity
    const windowSize = Math.max(5, Math.floor(sorted.length / 4))
    const windows: number[] = []

    for (let i = 0; i <= sorted.length - windowSize; i++) {
      const window = sorted.slice(i, i + windowSize)
      const successRate = this.calculateSuccessRate(window)
      windows.push(successRate)
    }

    if (windows.length < 2) return 0

    // Calculate average change between windows
    let totalChange = 0
    for (let i = 1; i < windows.length; i++) {
      totalChange += windows[i] - windows[i - 1]
    }

    const avgChange = totalChange / (windows.length - 1)

    // Convert to per-day rate
    const timeSpanDays = (sorted[sorted.length - 1].completedAt.getTime() - sorted[0].completedAt.getTime()) / (24 * 60 * 60 * 1000)
    const velocityPerDay = timeSpanDays > 0 ? avgChange / (timeSpanDays / windows.length) : 0

    return -velocityPerDay  // Negative velocity means declining
  }

  /**
   * Determine decay trend
   */
  private determineTrend(
    decayRate: number,
    decayVelocity: number
  ): 'rapid_decline' | 'gradual_decline' | 'stable' | 'improving' {
    if (decayRate >= this.RAPID_DECAY_THRESHOLD) {
      return 'rapid_decline'
    } else if (decayRate >= this.DECAY_THRESHOLD) {
      if (decayVelocity > 0.01) {
        return 'rapid_decline'
      } else {
        return 'gradual_decline'
      }
    } else if (decayRate < 0) {
      return 'improving'
    } else {
      return 'stable'
    }
  }

  /**
   * Build data points for visualization
   */
  private buildDataPoints(outcomes: GoalOutcome[]): Array<{
    timestamp: Date
    successRate: number
    sampleSize: number
  }> {
    // Sort by completion date
    const sorted = [...outcomes].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    )

    // Create weekly buckets
    const buckets = new Map<number, GoalOutcome[]>()
    const weekMs = 7 * 24 * 60 * 60 * 1000

    for (const outcome of sorted) {
      const weekBucket = Math.floor(outcome.completedAt.getTime() / weekMs)
      const existing = buckets.get(weekBucket) || []
      existing.push(outcome)
      buckets.set(weekBucket, existing)
    }

    // Convert to data points
    const dataPoints: Array<{
      timestamp: Date
      successRate: number
      sampleSize: number
    }> = []

    for (const [weekBucket, outcomes] of buckets) {
      dataPoints.push({
        timestamp: new Date(weekBucket * weekMs),
        successRate: this.calculateSuccessRate(outcomes),
        sampleSize: outcomes.length
      })
    }

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return dataPoints
  }

  /**
   * Calculate confidence in decay detection
   */
  private calculateConfidence(sampleSize: number, decayRate: number): number {
    // Base confidence on sample size
    let confidence = 0

    if (sampleSize < 10) {
      confidence = 0.3
    } else if (sampleSize < 30) {
      confidence = 0.6
    } else if (sampleSize < 100) {
      confidence = 0.8
    } else {
      confidence = 0.95
    }

    // Increase confidence for more significant decay
    if (decayRate > this.RAPID_DECAY_THRESHOLD) {
      confidence = Math.min(1.0, confidence + 0.1)
    }

    return confidence
  }
}

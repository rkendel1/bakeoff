import type { ForecastOutcome } from './types.js'

/**
 * ForecastOutcomeStore - Persistence for forecast outcomes
 * 
 * This store maintains:
 * - All forecast outcomes (predictions + actuals)
 * - Historical error data
 * - Accuracy trends
 * 
 * This is the foundation for:
 * - Calibration learning
 * - Drift detection
 * - Self-correction
 */
export class ForecastOutcomeStore {
  private outcomes: Map<string, ForecastOutcome> = new Map()
  private tenantIndex: Map<string, string[]> = new Map()
  private typeIndex: Map<string, string[]> = new Map()

  /**
   * Record a forecast outcome
   */
  async record(outcome: ForecastOutcome): Promise<void> {
    this.outcomes.set(outcome.forecastId, outcome)

    // Index by tenant
    const tenantOutcomes = this.tenantIndex.get(outcome.tenantId) || []
    tenantOutcomes.push(outcome.forecastId)
    this.tenantIndex.set(outcome.tenantId, tenantOutcomes)

    // Index by type
    const typeOutcomes = this.typeIndex.get(outcome.forecastType) || []
    typeOutcomes.push(outcome.forecastId)
    this.typeIndex.set(outcome.forecastType, typeOutcomes)
  }

  /**
   * Get outcome by forecast ID
   */
  async getById(forecastId: string): Promise<ForecastOutcome | undefined> {
    return this.outcomes.get(forecastId)
  }

  /**
   * Get outcomes for a tenant
   */
  async getByTenant(tenantId: string, limit?: number): Promise<ForecastOutcome[]> {
    const outcomeIds = this.tenantIndex.get(tenantId) || []
    let outcomes = outcomeIds
      .map((id) => this.outcomes.get(id))
      .filter((o): o is ForecastOutcome => o !== undefined)

    // Sort by most recent
    outcomes.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())

    if (limit) {
      outcomes = outcomes.slice(0, limit)
    }

    return outcomes
  }

  /**
   * Get outcomes by forecast type
   */
  async getByType(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType'],
    limit?: number
  ): Promise<ForecastOutcome[]> {
    const outcomes = await this.getByTenant(tenantId)
    let filtered = outcomes.filter((o) => o.forecastType === forecastType)

    if (limit) {
      filtered = filtered.slice(0, limit)
    }

    return filtered
  }

  /**
   * Get recent outcomes (for trend analysis)
   */
  async getRecent(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType'],
    days: number = 7
  ): Promise<ForecastOutcome[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const outcomes = await this.getByType(tenantId, forecastType)

    return outcomes.filter((o) => o.recordedAt >= cutoff)
  }

  /**
   * Calculate average error for a forecast type
   */
  async getAverageError(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType']
  ): Promise<number> {
    const outcomes = await this.getByType(tenantId, forecastType)

    if (outcomes.length === 0) {
      return 0
    }

    const totalError = outcomes.reduce(
      (sum, o) => sum + o.errorMetrics.probabilityError,
      0
    )

    return totalError / outcomes.length
  }

  /**
   * Get error trend (comparing periods)
   */
  async getErrorTrend(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType']
  ): Promise<'improving' | 'stable' | 'declining'> {
    const outcomes = await this.getByType(tenantId, forecastType)

    if (outcomes.length < 20) {
      return 'stable'
    }

    // Sort by time
    const sorted = [...outcomes].sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
    )

    const mid = Math.floor(sorted.length / 2)
    const firstHalf = sorted.slice(0, mid)
    const secondHalf = sorted.slice(mid)

    const firstError =
      firstHalf.reduce((sum, o) => sum + o.errorMetrics.probabilityError, 0) /
      firstHalf.length

    const secondError =
      secondHalf.reduce((sum, o) => sum + o.errorMetrics.probabilityError, 0) /
      secondHalf.length

    const diff = firstError - secondError // positive = improving (error decreased)

    if (diff > 0.05) {
      return 'improving'
    } else if (diff < -0.05) {
      return 'declining'
    } else {
      return 'stable'
    }
  }

  /**
   * Get all outcomes (for comprehensive analysis)
   */
  async getAll(tenantId: string): Promise<ForecastOutcome[]> {
    return this.getByTenant(tenantId)
  }
}

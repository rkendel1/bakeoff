import type { RuntimeForecast, ForecastAccuracyMetrics } from './types.js'

/**
 * RuntimeForecastStore - Persistent storage for forecasts and accuracy tracking
 * 
 * This store maintains:
 * - All forecasts generated
 * - Actual outcomes vs predictions
 * - Prediction accuracy metrics
 * - Forecast quality trends
 * 
 * This is critical because:
 * - Runtime must learn forecasting quality
 * - Confidence calibration depends on historical accuracy
 * - Prediction models improve through outcome tracking
 */
export class RuntimeForecastStore {
  private forecasts: Map<string, RuntimeForecast> = new Map()
  private tenantIndex: Map<string, string[]> = new Map()
  private typeIndex: Map<string, string[]> = new Map()

  /**
   * Store a forecast
   */
  async store(forecast: RuntimeForecast): Promise<void> {
    this.forecasts.set(forecast.id, forecast)

    // Index by tenant
    const tenantForecasts = this.tenantIndex.get(forecast.tenantId) || []
    tenantForecasts.push(forecast.id)
    this.tenantIndex.set(forecast.tenantId, tenantForecasts)

    // Index by type
    const typeForecasts = this.typeIndex.get(forecast.forecastType) || []
    typeForecasts.push(forecast.id)
    this.typeIndex.set(forecast.forecastType, typeForecasts)
  }

  /**
   * Get forecast by ID
   */
  async getById(id: string): Promise<RuntimeForecast | undefined> {
    return this.forecasts.get(id)
  }

  /**
   * Get forecasts for a tenant
   */
  async getByTenant(tenantId: string, limit?: number): Promise<RuntimeForecast[]> {
    const forecastIds = this.tenantIndex.get(tenantId) || []
    let forecasts = forecastIds
      .map((id) => this.forecasts.get(id))
      .filter((f): f is RuntimeForecast => f !== undefined)

    // Sort by most recent
    forecasts.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())

    if (limit) {
      forecasts = forecasts.slice(0, limit)
    }

    return forecasts
  }

  /**
   * Get forecasts by type for a tenant
   */
  async getByType(
    tenantId: string,
    forecastType: RuntimeForecast['forecastType'],
    limit?: number
  ): Promise<RuntimeForecast[]> {
    const forecasts = await this.getByTenant(tenantId)
    let filtered = forecasts.filter((f) => f.forecastType === forecastType)

    if (limit) {
      filtered = filtered.slice(0, limit)
    }

    return filtered
  }

  /**
   * Update forecast with actual outcome
   */
  async recordOutcome(
    forecastId: string,
    outcome: {
      occurred: boolean
      accuracy: number
      actualData?: unknown
    }
  ): Promise<void> {
    const forecast = this.forecasts.get(forecastId)
    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`)
    }

    forecast.actualOutcome = {
      ...outcome,
      verifiedAt: new Date()
    }

    this.forecasts.set(forecastId, forecast)
  }

  /**
   * Calculate accuracy metrics for a tenant and forecast type
   */
  async calculateAccuracyMetrics(
    tenantId: string,
    forecastType: RuntimeForecast['forecastType']
  ): Promise<ForecastAccuracyMetrics> {
    const forecasts = await this.getByType(tenantId, forecastType)
    const verified = forecasts.filter((f) => f.actualOutcome !== undefined)

    const totalForecasts = forecasts.length
    const verifiedForecasts = verified.length

    // Calculate average accuracy
    const averageAccuracy = verifiedForecasts > 0
      ? verified.reduce((sum, f) => sum + (f.actualOutcome!.accuracy), 0) / verifiedForecasts
      : 0

    // Calculate accuracy by confidence level
    const accuracyByConfidence = this.calculateAccuracyByConfidence(verified)

    // Calculate trend (compare first half vs second half)
    const accuracyTrend = this.calculateAccuracyTrend(verified)

    return {
      forecastType,
      tenantId,
      totalForecasts,
      verifiedForecasts,
      averageAccuracy,
      accuracyByConfidence,
      accuracyTrend,
      computedAt: new Date()
    }
  }

  /**
   * Calculate accuracy by confidence level
   */
  private calculateAccuracyByConfidence(
    verified: RuntimeForecast[]
  ): Array<{
    confidenceRange: string
    accuracy: number
    sampleSize: number
  }> {
    const ranges = [
      { min: 0, max: 0.3, label: '0-30%' },
      { min: 0.3, max: 0.6, label: '30-60%' },
      { min: 0.6, max: 0.8, label: '60-80%' },
      { min: 0.8, max: 1.0, label: '80-100%' }
    ]

    return ranges.map((range) => {
      const inRange = verified.filter(
        (f) => f.confidence >= range.min && (range.max === 1.0 ? f.confidence <= range.max : f.confidence < range.max)
      )

      const accuracy = inRange.length > 0
        ? inRange.reduce((sum, f) => sum + (f.actualOutcome!.accuracy), 0) / inRange.length
        : 0

      return {
        confidenceRange: range.label,
        accuracy,
        sampleSize: inRange.length
      }
    })
  }

  /**
   * Calculate accuracy trend
   */
  private calculateAccuracyTrend(
    verified: RuntimeForecast[]
  ): 'improving' | 'stable' | 'declining' {
    if (verified.length < 10) {
      return 'stable' // Not enough data
    }

    // Sort by generation date
    const sorted = [...verified].sort(
      (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
    )

    const mid = Math.floor(sorted.length / 2)
    const firstHalf = sorted.slice(0, mid)
    const secondHalf = sorted.slice(mid)

    const firstHalfAccuracy = firstHalf.reduce(
      (sum, f) => sum + (f.actualOutcome!.accuracy), 0
    ) / firstHalf.length

    const secondHalfAccuracy = secondHalf.reduce(
      (sum, f) => sum + (f.actualOutcome!.accuracy), 0
    ) / secondHalf.length

    const diff = secondHalfAccuracy - firstHalfAccuracy

    if (diff > 0.05) {
      return 'improving'
    } else if (diff < -0.05) {
      return 'declining'
    } else {
      return 'stable'
    }
  }

  /**
   * Get recent forecasts (all types)
   */
  async getRecent(tenantId: string, limit: number = 10): Promise<RuntimeForecast[]> {
    return this.getByTenant(tenantId, limit)
  }

  /**
   * Get unverified forecasts (forecasts without outcomes)
   */
  async getUnverified(tenantId: string): Promise<RuntimeForecast[]> {
    const forecasts = await this.getByTenant(tenantId)
    return forecasts.filter((f) => f.actualOutcome === undefined)
  }

  /**
   * Get all accuracy metrics for a tenant
   */
  async getAllAccuracyMetrics(tenantId: string): Promise<ForecastAccuracyMetrics[]> {
    const types: RuntimeForecast['forecastType'][] = [
      'risk_assessment',
      'strategy_decay',
      'failure_trajectory',
      'goal_completion',
      'entropy_trajectory'
    ]

    return Promise.all(
      types.map((type) => this.calculateAccuracyMetrics(tenantId, type))
    )
  }
}

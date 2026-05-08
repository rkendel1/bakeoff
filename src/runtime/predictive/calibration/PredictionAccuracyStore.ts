import type { AccuracyMetrics } from './types.js'

/**
 * PredictionAccuracyStore - Persistence for accuracy metrics
 * 
 * This store maintains:
 * - Computed accuracy metrics over time
 * - Historical accuracy trends
 * - Model performance comparison
 * 
 * This enables:
 * - Long-term accuracy tracking
 * - Performance regression detection
 * - Model comparison
 */
export class PredictionAccuracyStore {
  private metrics: Map<string, AccuracyMetrics[]> = new Map()

  /**
   * Store accuracy metrics
   */
  async store(metrics: AccuracyMetrics): Promise<void> {
    const key = `${metrics.tenantId}:${metrics.modelType}`
    const existing = this.metrics.get(key) || []
    existing.push(metrics)
    this.metrics.set(key, existing)
  }

  /**
   * Get latest metrics for a model
   */
  async getLatest(tenantId: string, modelType: AccuracyMetrics['modelType']): Promise<AccuracyMetrics | undefined> {
    const key = `${tenantId}:${modelType}`
    const metrics = this.metrics.get(key) || []

    if (metrics.length === 0) {
      return undefined
    }

    // Sort by most recent and return latest
    const sorted = [...metrics].sort(
      (a, b) => b.computedAt.getTime() - a.computedAt.getTime()
    )

    return sorted[0]
  }

  /**
   * Get historical metrics
   */
  async getHistory(
    tenantId: string,
    modelType: AccuracyMetrics['modelType'],
    limit?: number
  ): Promise<AccuracyMetrics[]> {
    const key = `${tenantId}:${modelType}`
    let metrics = this.metrics.get(key) || []

    // Sort by most recent
    metrics = [...metrics].sort(
      (a, b) => b.computedAt.getTime() - a.computedAt.getTime()
    )

    if (limit) {
      metrics = metrics.slice(0, limit)
    }

    return metrics
  }

  /**
   * Get all metrics for a tenant
   */
  async getAllForTenant(tenantId: string): Promise<AccuracyMetrics[]> {
    const allMetrics: AccuracyMetrics[] = []

    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        allMetrics.push(...metrics)
      }
    }

    // Sort by most recent
    return allMetrics.sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime())
  }

  /**
   * Get accuracy trend for a model
   */
  async getAccuracyTrend(
    tenantId: string,
    modelType: AccuracyMetrics['modelType'],
    periods: number = 10
  ): Promise<Array<{ timestamp: Date; accuracy: number }>> {
    const history = await this.getHistory(tenantId, modelType, periods)

    return history
      .sort((a, b) => a.computedAt.getTime() - b.computedAt.getTime())
      .map((m) => ({
        timestamp: m.computedAt,
        accuracy: m.overallAccuracy
      }))
  }

  /**
   * Compare models by accuracy
   */
  async compareModels(tenantId: string): Promise<Array<{
    modelType: string
    accuracy: number
    bias: string
    sampleSize: number
  }>> {
    const modelTypes: AccuracyMetrics['modelType'][] = [
      'risk_engine',
      'entropy_forecaster',
      'decay_detector',
      'failure_analyzer',
      'goal_forecaster'
    ]

    const comparisons: Array<{
      modelType: string
      accuracy: number
      bias: string
      sampleSize: number
    }> = []

    for (const modelType of modelTypes) {
      const latest = await this.getLatest(tenantId, modelType)

      if (latest) {
        comparisons.push({
          modelType: latest.modelType,
          accuracy: latest.overallAccuracy,
          bias: latest.bias,
          sampleSize: latest.sampleSize
        })
      }
    }

    // Sort by accuracy descending
    return comparisons.sort((a, b) => b.accuracy - a.accuracy)
  }
}

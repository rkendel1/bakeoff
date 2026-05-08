import type { CalibrationStore } from './CalibrationStore.js'
import type { PredictionAccuracyStore } from './PredictionAccuracyStore.js'
import type { AccuracyMetrics } from './types.js'

/**
 * AdaptiveConfidenceScaler - Adjusts confidence scores per subsystem
 * 
 * This scaler adjusts:
 * - Strategy decay confidence
 * - Risk engine confidence
 * - Goal forecasting confidence
 * - Entropy prediction confidence
 * 
 * Key insight:
 * Not all predictions are equally reliable.
 * 
 * If entropy forecaster has 76% historical accuracy,
 * its confidence should be scaled to reflect that.
 * 
 * This prevents:
 * - Overconfident bad predictions
 * - Treating all models equally
 * 
 * This enables:
 * - Accuracy-weighted decision making
 * - Model-specific trust levels
 * - Dynamic confidence adjustment
 */
export class AdaptiveConfidenceScaler {
  constructor(
    private readonly calibrationStore: CalibrationStore,
    private readonly accuracyStore: PredictionAccuracyStore
  ) {}

  /**
   * Get adjusted confidence for a model
   */
  async getAdjustedConfidence(
    tenantId: string,
    modelType: AccuracyMetrics['modelType'],
    baseConfidence: number
  ): Promise<{
    adjustedConfidence: number
    scaleFactor: number
    rationale: string
  }> {
    // Get calibration state
    const state = await this.calibrationStore.getState(tenantId, modelType)

    if (!state) {
      // No calibration yet, use base confidence
      return {
        adjustedConfidence: baseConfidence,
        scaleFactor: 1.0,
        rationale: 'No calibration data available'
      }
    }

    // Get recent accuracy
    const latestMetrics = await this.accuracyStore.getLatest(tenantId, modelType)

    if (!latestMetrics || latestMetrics.sampleSize < 10) {
      // Not enough data, use slight conservative scaling
      const scaleFactor = 0.9
      return {
        adjustedConfidence: baseConfidence * scaleFactor,
        scaleFactor,
        rationale: 'Insufficient historical data, applying conservative scaling'
      }
    }

    // Calculate scale factor based on historical accuracy
    const accuracyBasedScale = latestMetrics.overallAccuracy

    // Adjust for bias
    let biasAdjustment = 1.0
    if (latestMetrics.bias === 'overconfident') {
      // Reduce confidence more aggressively for overconfident models
      biasAdjustment = 0.85
    } else if (latestMetrics.bias === 'underconfident') {
      // Slightly boost confidence for underconfident models
      biasAdjustment = 1.05
    }

    // Combine factors
    const scaleFactor = accuracyBasedScale * biasAdjustment * state.confidenceScaleFactor

    // Clamp to reasonable range [0.3, 1.0]
    const clampedScale = Math.max(0.3, Math.min(1.0, scaleFactor))

    const adjustedConfidence = baseConfidence * clampedScale

    return {
      adjustedConfidence: Math.max(0, Math.min(1, adjustedConfidence)),
      scaleFactor: clampedScale,
      rationale: this.buildRationale(latestMetrics, clampedScale, biasAdjustment)
    }
  }

  /**
   * Get confidence scaling factors for all models
   */
  async getAllConfidenceScalings(tenantId: string): Promise<{
    [modelType: string]: {
      scaleFactor: number
      accuracy: number
      bias: string
    }
  }> {
    const modelTypes: AccuracyMetrics['modelType'][] = [
      'risk_engine',
      'entropy_forecaster',
      'decay_detector',
      'failure_analyzer',
      'goal_forecaster'
    ]

    const scalings: {
      [modelType: string]: {
        scaleFactor: number
        accuracy: number
        bias: string
      }
    } = {}

    for (const modelType of modelTypes) {
      const result = await this.getAdjustedConfidence(tenantId, modelType, 1.0)
      const metrics = await this.accuracyStore.getLatest(tenantId, modelType)

      scalings[modelType] = {
        scaleFactor: result.scaleFactor,
        accuracy: metrics?.overallAccuracy || 0.5,
        bias: metrics?.bias || 'calibrated'
      }
    }

    return scalings
  }

  /**
   * Apply confidence scaling to a prediction
   */
  async scalePredictionConfidence<T extends { confidence: number }>(
    tenantId: string,
    modelType: AccuracyMetrics['modelType'],
    prediction: T
  ): Promise<T & { originalConfidence: number; scalingApplied: boolean }> {
    const result = await this.getAdjustedConfidence(
      tenantId,
      modelType,
      prediction.confidence
    )

    return {
      ...prediction,
      originalConfidence: prediction.confidence,
      confidence: result.adjustedConfidence,
      scalingApplied: result.scaleFactor !== 1.0
    }
  }

  /**
   * Update confidence scale factor based on new accuracy data
   */
  async updateScaleFactor(
    tenantId: string,
    modelType: string,
    newAccuracy: number
  ): Promise<void> {
    let state = await this.calibrationStore.getState(tenantId, modelType)

    if (!state) {
      state = await this.calibrationStore.initializeState(tenantId, modelType)
    }

    // Calculate new scale factor based on accuracy
    // Use exponential moving average for smooth adjustment
    const alpha = 0.3 // Smoothing factor
    const newScale = newAccuracy
    const updatedScale = alpha * newScale + (1 - alpha) * state.confidenceScaleFactor

    state.confidenceScaleFactor = Math.max(0.3, Math.min(1.0, updatedScale))

    await this.calibrationStore.saveState(state)
  }

  /**
   * Build rationale for confidence adjustment
   */
  private buildRationale(
    metrics: AccuracyMetrics,
    scaleFactor: number,
    biasAdjustment: number
  ): string {
    const parts: string[] = []

    parts.push(`Historical accuracy: ${(metrics.overallAccuracy * 100).toFixed(1)}%`)

    if (metrics.bias === 'overconfident') {
      parts.push('Model tends to be overconfident, reducing confidence')
    } else if (metrics.bias === 'underconfident') {
      parts.push('Model tends to be underconfident, slightly increasing confidence')
    }

    if (biasAdjustment !== 1.0) {
      parts.push(`Bias adjustment: ${(biasAdjustment * 100).toFixed(0)}%`)
    }

    parts.push(`Final scale factor: ${(scaleFactor * 100).toFixed(0)}%`)

    if (metrics.sampleSize < 20) {
      parts.push(`Limited sample size (${metrics.sampleSize}), conservative scaling`)
    }

    return parts.join('. ')
  }

  /**
   * Get confidence recommendations for a tenant
   */
  async getConfidenceRecommendations(tenantId: string): Promise<Array<{
    modelType: string
    currentScale: number
    recommendedScale: number
    reason: string
  }>> {
    const modelTypes: AccuracyMetrics['modelType'][] = [
      'risk_engine',
      'entropy_forecaster',
      'decay_detector',
      'failure_analyzer',
      'goal_forecaster'
    ]

    const recommendations: Array<{
      modelType: string
      currentScale: number
      recommendedScale: number
      reason: string
    }> = []

    for (const modelType of modelTypes) {
      const state = await this.calibrationStore.getState(tenantId, modelType)
      const metrics = await this.accuracyStore.getLatest(tenantId, modelType)

      if (!metrics || metrics.sampleSize < 10) {
        continue
      }

      const currentScale = state?.confidenceScaleFactor || 1.0
      const recommendedScale = metrics.overallAccuracy

      // Only recommend if significant difference
      if (Math.abs(currentScale - recommendedScale) > 0.1) {
        recommendations.push({
          modelType,
          currentScale,
          recommendedScale,
          reason: `Accuracy is ${(metrics.overallAccuracy * 100).toFixed(0)}%, but scale factor is ${(currentScale * 100).toFixed(0)}%`
        })
      }
    }

    return recommendations
  }
}

import type { DriftDetectionResult } from './types.js'
import type { ForecastOutcomeStore } from './ForecastOutcomeStore.js'
import type { PredictionAccuracyStore } from './PredictionAccuracyStore.js'
import type { AccuracyMetrics } from './types.js'

/**
 * PredictionDriftDetector - Detects when forecasts stop matching reality
 * 
 * This detector identifies:
 * - Accuracy decline over time
 * - Systematic bias shifts
 * - Distribution changes
 * - Model degradation
 * 
 * Key insight:
 * Models drift when:
 * - System behavior changes
 * - Tenant patterns evolve
 * - Provider behavior shifts
 * - Operational context transforms
 * 
 * This is critical for:
 * - Multi-tenant generalization stability
 * - Long-term prediction reliability
 * - Automated recalibration triggers
 */
export class PredictionDriftDetector {
  // Thresholds for drift detection
  private readonly ACCURACY_DECLINE_THRESHOLD = 0.1 // 10% decline
  private readonly BIAS_SHIFT_THRESHOLD = 0.15
  private readonly DRIFT_CRITICAL_THRESHOLD = 0.2

  constructor(
    private readonly outcomeStore: ForecastOutcomeStore,
    private readonly accuracyStore: PredictionAccuracyStore
  ) {}

  /**
   * Detect drift for a specific model
   */
  async detectDrift(
    tenantId: string,
    modelType: AccuracyMetrics['modelType']
  ): Promise<DriftDetectionResult> {
    // Get historical accuracy trend
    const accuracyHistory = await this.accuracyStore.getAccuracyTrend(
      tenantId,
      modelType,
      20
    )

    if (accuracyHistory.length < 5) {
      // Not enough data
      return this.createNoDriftResult(tenantId, modelType, accuracyHistory)
    }

    // Analyze accuracy trend
    const accuracyDrift = this.analyzeAccuracyTrend(accuracyHistory)

    // Analyze bias shift
    const biasShift = await this.analyzeBiasShift(tenantId, modelType)

    // Determine dominant drift type
    const driftType = this.determineDriftType(accuracyDrift, biasShift)

    // Calculate overall drift magnitude
    const driftMagnitude = Math.max(accuracyDrift.magnitude, biasShift.magnitude)

    // Determine if drift is significant
    const driftDetected = driftMagnitude > this.ACCURACY_DECLINE_THRESHOLD

    // Recommend action
    const { action, urgency } = this.determineAction(driftMagnitude, driftType)

    return {
      tenantId,
      modelType,
      driftDetected,
      driftMagnitude,
      driftType,
      factors: [
        {
          factor: 'accuracy_trend',
          contribution: accuracyDrift.magnitude,
          description: `Accuracy ${accuracyDrift.trend}: ${(accuracyDrift.magnitude * 100).toFixed(1)}% change`
        },
        {
          factor: 'bias_shift',
          contribution: biasShift.magnitude,
          description: `Bias shift: ${(biasShift.magnitude * 100).toFixed(1)}%`
        }
      ],
      historicalAccuracy: accuracyHistory,
      recommendedAction: action,
      urgency,
      confidence: this.calculateDriftConfidence(accuracyHistory.length),
      detectedAt: new Date()
    }
  }

  /**
   * Detect drift across all models for a tenant
   */
  async detectAllDrift(tenantId: string): Promise<DriftDetectionResult[]> {
    const modelTypes: AccuracyMetrics['modelType'][] = [
      'risk_engine',
      'entropy_forecaster',
      'decay_detector',
      'failure_analyzer',
      'goal_forecaster'
    ]

    return Promise.all(
      modelTypes.map((modelType) => this.detectDrift(tenantId, modelType))
    )
  }

  /**
   * Identify models needing recalibration
   */
  async identifyModelsNeedingRecalibration(tenantId: string): Promise<Array<{
    modelType: string
    driftMagnitude: number
    urgency: string
  }>> {
    const driftResults = await this.detectAllDrift(tenantId)

    return driftResults
      .filter((r) => r.driftDetected && r.recommendedAction === 'recalibrate')
      .map((r) => ({
        modelType: r.modelType,
        driftMagnitude: r.driftMagnitude,
        urgency: r.urgency
      }))
      .sort((a, b) => b.driftMagnitude - a.driftMagnitude)
  }

  /**
   * Analyze accuracy trend over time
   */
  private analyzeAccuracyTrend(history: Array<{ timestamp: Date; accuracy: number }>): {
    trend: 'declining' | 'improving' | 'stable'
    magnitude: number
  } {
    if (history.length < 2) {
      return { trend: 'stable', magnitude: 0 }
    }

    // Compare first half vs second half
    const mid = Math.floor(history.length / 2)
    const firstHalf = history.slice(0, mid)
    const secondHalf = history.slice(mid)

    const firstAvg = firstHalf.reduce((sum, h) => sum + h.accuracy, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, h) => sum + h.accuracy, 0) / secondHalf.length

    const change = secondAvg - firstAvg

    if (change < -this.ACCURACY_DECLINE_THRESHOLD) {
      return { trend: 'declining', magnitude: Math.abs(change) }
    } else if (change > this.ACCURACY_DECLINE_THRESHOLD) {
      return { trend: 'improving', magnitude: Math.abs(change) }
    } else {
      return { trend: 'stable', magnitude: Math.abs(change) }
    }
  }

  /**
   * Analyze bias shift over time
   */
  private async analyzeBiasShift(
    tenantId: string,
    modelType: AccuracyMetrics['modelType']
  ): Promise<{
    magnitude: number
    direction: 'more_overconfident' | 'more_underconfident' | 'stable'
  }> {
    const metricsHistory = await this.accuracyStore.getHistory(tenantId, modelType, 10)

    if (metricsHistory.length < 2) {
      return { magnitude: 0, direction: 'stable' }
    }

    // Compare first and last bias scores
    const first = metricsHistory[metricsHistory.length - 1]
    const last = metricsHistory[0]

    const biasChange = last.biasScore - first.biasScore

    if (Math.abs(biasChange) < this.BIAS_SHIFT_THRESHOLD) {
      return { magnitude: Math.abs(biasChange), direction: 'stable' }
    }

    if (biasChange > 0) {
      return { magnitude: Math.abs(biasChange), direction: 'more_overconfident' }
    } else {
      return { magnitude: Math.abs(biasChange), direction: 'more_underconfident' }
    }
  }

  /**
   * Determine drift type
   */
  private determineDriftType(
    accuracyDrift: { trend: string; magnitude: number },
    biasShift: { magnitude: number; direction: string }
  ): DriftDetectionResult['driftType'] {
    // Prioritize by magnitude
    if (accuracyDrift.magnitude > biasShift.magnitude) {
      if (accuracyDrift.trend === 'declining') {
        return 'accuracy_decline'
      }
    }

    if (biasShift.magnitude > this.BIAS_SHIFT_THRESHOLD) {
      return 'bias_shift'
    }

    if (accuracyDrift.trend === 'declining') {
      return 'accuracy_decline'
    }

    return 'stable'
  }

  /**
   * Determine recommended action and urgency
   */
  private determineAction(
    driftMagnitude: number,
    driftType: DriftDetectionResult['driftType']
  ): {
    action: DriftDetectionResult['recommendedAction']
    urgency: DriftDetectionResult['urgency']
  } {
    if (driftMagnitude > this.DRIFT_CRITICAL_THRESHOLD) {
      return { action: 'recalibrate', urgency: 'critical' }
    }

    if (driftMagnitude > this.ACCURACY_DECLINE_THRESHOLD) {
      return { action: 'recalibrate', urgency: 'high' }
    }

    if (driftType !== 'stable') {
      return { action: 'monitor', urgency: 'medium' }
    }

    return { action: 'no_action', urgency: 'low' }
  }

  /**
   * Calculate confidence in drift detection
   */
  private calculateDriftConfidence(sampleSize: number): number {
    if (sampleSize < 5) return 0.4
    if (sampleSize < 10) return 0.6
    if (sampleSize < 20) return 0.8
    return 0.95
  }

  /**
   * Create no-drift result when insufficient data
   */
  private createNoDriftResult(
    tenantId: string,
    modelType: string,
    history: Array<{ timestamp: Date; accuracy: number }>
  ): DriftDetectionResult {
    return {
      tenantId,
      modelType,
      driftDetected: false,
      driftMagnitude: 0,
      driftType: 'stable',
      factors: [],
      historicalAccuracy: history,
      recommendedAction: 'no_action',
      urgency: 'low',
      confidence: 0.3,
      detectedAt: new Date()
    }
  }
}

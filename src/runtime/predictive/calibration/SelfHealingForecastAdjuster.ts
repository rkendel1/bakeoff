import type { SelfHealingAdjustment } from './types.js'
import type { CalibrationStore } from './CalibrationStore.js'
import type { PredictionDriftDetector } from './PredictionDriftDetector.js'
import type { PredictionAccuracyStore } from './PredictionAccuracyStore.js'
import type { AccuracyMetrics } from './types.js'

/**
 * SelfHealingForecastAdjuster - Automatically adjusts system parameters
 * 
 * This adjuster automatically modifies:
 * - Risk thresholds
 * - Decay sensitivity
 * - Entropy baselines
 * - Convergence expectations
 * 
 * Based on observed drift and accuracy.
 * 
 * Key insight:
 * Manual tuning doesn't scale.
 * Self-healing systems automatically correct themselves.
 * 
 * This enables:
 * - Autonomous parameter optimization
 * - Drift-responsive tuning
 * - Zero-operator recalibration
 * 
 * This is the difference between:
 * - Predictive system (static parameters)
 * - Self-correcting system (dynamic parameters)
 */
export class SelfHealingForecastAdjuster {
  private adjustmentHistory: Map<string, SelfHealingAdjustment[]> = new Map()

  constructor(
    private readonly calibrationStore: CalibrationStore,
    private readonly driftDetector: PredictionDriftDetector,
    private readonly accuracyStore: PredictionAccuracyStore
  ) {}

  /**
   * Perform automatic adjustment for a model
   */
  async performAutomaticAdjustment(
    tenantId: string,
    modelType: string
  ): Promise<SelfHealingAdjustment[]> {
    const adjustments: SelfHealingAdjustment[] = []

    // Get current state
    let state = await this.calibrationStore.getState(tenantId, modelType)
    if (!state) {
      state = await this.calibrationStore.initializeState(tenantId, modelType)
    }

    // Get latest metrics
    const metrics = await this.accuracyStore.getLatest(tenantId, modelType as AccuracyMetrics['modelType'])

    if (!metrics || metrics.sampleSize < 10) {
      // Not enough data for adjustment
      return []
    }

    // Check for overconfidence → reduce risk sensitivity
    if (metrics.bias === 'overconfident' && metrics.biasScore > 0.15) {
      const adjustment = await this.adjustRiskSensitivity(
        tenantId,
        modelType,
        state.riskSensitivity,
        0.85,
        'Overconfident predictions detected',
        metrics
      )
      adjustments.push(adjustment)
    }

    // Check for underconfidence → increase risk sensitivity
    if (metrics.bias === 'underconfident' && metrics.biasScore < -0.15) {
      const adjustment = await this.adjustRiskSensitivity(
        tenantId,
        modelType,
        state.riskSensitivity,
        1.1,
        'Underconfident predictions detected',
        metrics
      )
      adjustments.push(adjustment)
    }

    // Check for entropy forecasting errors → adjust baseline
    if (modelType === 'entropy_forecaster' && metrics.calibrationError > 0.2) {
      const adjustment = await this.adjustEntropyBaseline(
        tenantId,
        state.entropyBaseline,
        metrics.calibrationError,
        metrics
      )
      adjustments.push(adjustment)
    }

    // Check for decay detection errors → adjust sensitivity
    if (modelType === 'decay_detector' && metrics.calibrationError > 0.15) {
      const adjustment = await this.adjustDecaySensitivity(
        tenantId,
        state.decaySensitivity,
        metrics.calibrationError,
        metrics
      )
      adjustments.push(adjustment)
    }

    // Store adjustments
    for (const adjustment of adjustments) {
      await this.recordAdjustment(adjustment)
    }

    return adjustments
  }

  /**
   * Perform adjustments for all models with drift
   */
  async performAutomaticAdjustmentForAllModels(tenantId: string): Promise<SelfHealingAdjustment[]> {
    // Identify models needing adjustment
    const modelsNeedingRecalibration = await this.driftDetector.identifyModelsNeedingRecalibration(tenantId)

    const allAdjustments: SelfHealingAdjustment[] = []

    for (const { modelType } of modelsNeedingRecalibration) {
      const adjustments = await this.performAutomaticAdjustment(tenantId, modelType)
      allAdjustments.push(...adjustments)
    }

    return allAdjustments
  }

  /**
   * Adjust risk sensitivity
   */
  private async adjustRiskSensitivity(
    tenantId: string,
    modelType: string,
    currentValue: number,
    adjustmentFactor: number,
    trigger: string,
    metrics: AccuracyMetrics
  ): Promise<SelfHealingAdjustment> {
    const newValue = currentValue * adjustmentFactor

    // Clamp to reasonable range [0.5, 1.5]
    const clampedValue = Math.max(0.5, Math.min(1.5, newValue))

    // Update state
    const state = await this.calibrationStore.getState(tenantId, modelType)
    if (state) {
      state.riskSensitivity = clampedValue
      await this.calibrationStore.saveState(state)
    }

    const adjustment: SelfHealingAdjustment = {
      tenantId,
      adjustmentType: 'sensitivity',
      target: 'risk_sensitivity',
      previousValue: currentValue,
      newValue: clampedValue,
      trigger,
      evidence: [
        {
          metric: 'bias_score',
          value: metrics.biasScore,
          threshold: 0.15
        },
        {
          metric: 'calibration_error',
          value: metrics.calibrationError,
          threshold: 0.2
        }
      ],
      expectedAccuracyImprovement: 0.05,
      estimatedRiskReduction: 0.1,
      appliedAt: new Date(),
      automatic: true,
      confidence: metrics.confidence
    }

    return adjustment
  }

  /**
   * Adjust entropy baseline
   */
  private async adjustEntropyBaseline(
    tenantId: string,
    currentValue: number,
    calibrationError: number,
    metrics: AccuracyMetrics
  ): Promise<SelfHealingAdjustment> {
    // Adjust baseline based on calibration error direction
    const adjustmentAmount = calibrationError * 0.1
    const newValue = currentValue + adjustmentAmount

    // Clamp to [0, 1]
    const clampedValue = Math.max(0, Math.min(1, newValue))

    // Update state
    const state = await this.calibrationStore.getState(tenantId, 'entropy_forecaster')
    if (state) {
      state.entropyBaseline = clampedValue
      await this.calibrationStore.saveState(state)
    }

    const adjustment: SelfHealingAdjustment = {
      tenantId,
      adjustmentType: 'baseline',
      target: 'entropy_baseline',
      previousValue: currentValue,
      newValue: clampedValue,
      trigger: 'High entropy forecasting error detected',
      evidence: [
        {
          metric: 'calibration_error',
          value: calibrationError,
          threshold: 0.2
        }
      ],
      expectedAccuracyImprovement: 0.08,
      estimatedRiskReduction: 0.05,
      appliedAt: new Date(),
      automatic: true,
      confidence: metrics.confidence
    }

    return adjustment
  }

  /**
   * Adjust decay sensitivity
   */
  private async adjustDecaySensitivity(
    tenantId: string,
    currentValue: number,
    calibrationError: number,
    metrics: AccuracyMetrics
  ): Promise<SelfHealingAdjustment> {
    // Reduce sensitivity if error is high (less sensitive = fewer false positives)
    const adjustmentFactor = 1 - (calibrationError * 0.2)
    const newValue = currentValue * adjustmentFactor

    // Clamp to [0.5, 1.5]
    const clampedValue = Math.max(0.5, Math.min(1.5, newValue))

    // Update state
    const state = await this.calibrationStore.getState(tenantId, 'decay_detector')
    if (state) {
      state.decaySensitivity = clampedValue
      await this.calibrationStore.saveState(state)
    }

    const adjustment: SelfHealingAdjustment = {
      tenantId,
      adjustmentType: 'sensitivity',
      target: 'decay_sensitivity',
      previousValue: currentValue,
      newValue: clampedValue,
      trigger: 'High decay detection error detected',
      evidence: [
        {
          metric: 'calibration_error',
          value: calibrationError,
          threshold: 0.15
        }
      ],
      expectedAccuracyImprovement: 0.06,
      estimatedRiskReduction: 0.04,
      appliedAt: new Date(),
      automatic: true,
      confidence: metrics.confidence
    }

    return adjustment
  }

  /**
   * Adjust convergence expectation
   */
  async adjustConvergenceExpectation(
    tenantId: string,
    modelType: string,
    observedConvergence: number
  ): Promise<SelfHealingAdjustment> {
    const state = await this.calibrationStore.getState(tenantId, modelType)
    if (!state) {
      throw new Error('Calibration state not found')
    }

    const currentValue = state.convergenceExpectation

    // Use exponential moving average
    const alpha = 0.2
    const newValue = alpha * observedConvergence + (1 - alpha) * currentValue

    // Clamp to [0, 1]
    const clampedValue = Math.max(0, Math.min(1, newValue))

    state.convergenceExpectation = clampedValue
    await this.calibrationStore.saveState(state)

    const adjustment: SelfHealingAdjustment = {
      tenantId,
      adjustmentType: 'threshold',
      target: 'convergence_expectation',
      previousValue: currentValue,
      newValue: clampedValue,
      trigger: 'Observed convergence differs from expectation',
      evidence: [
        {
          metric: 'observed_convergence',
          value: observedConvergence,
          threshold: currentValue
        }
      ],
      expectedAccuracyImprovement: 0.03,
      estimatedRiskReduction: 0.02,
      appliedAt: new Date(),
      automatic: true,
      confidence: 0.8
    }

    await this.recordAdjustment(adjustment)
    return adjustment
  }

  /**
   * Record adjustment in history
   */
  private async recordAdjustment(adjustment: SelfHealingAdjustment): Promise<void> {
    const key = `${adjustment.tenantId}:${adjustment.target}`
    const history = this.adjustmentHistory.get(key) || []
    history.push(adjustment)
    this.adjustmentHistory.set(key, history)
  }

  /**
   * Get adjustment history
   */
  async getAdjustmentHistory(
    tenantId: string,
    limit?: number
  ): Promise<SelfHealingAdjustment[]> {
    const allAdjustments: SelfHealingAdjustment[] = []

    for (const [key, history] of this.adjustmentHistory.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        allAdjustments.push(...history)
      }
    }

    // Sort by most recent
    allAdjustments.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime())

    if (limit) {
      return allAdjustments.slice(0, limit)
    }

    return allAdjustments
  }

  /**
   * Get recent adjustments summary
   */
  async getRecentAdjustmentsSummary(tenantId: string): Promise<{
    totalAdjustments: number
    byType: { [type: string]: number }
    averageImpact: number
  }> {
    const recent = await this.getAdjustmentHistory(tenantId, 50)

    const byType: { [type: string]: number } = {}
    let totalImpact = 0

    for (const adj of recent) {
      byType[adj.adjustmentType] = (byType[adj.adjustmentType] || 0) + 1
      totalImpact += adj.expectedAccuracyImprovement
    }

    return {
      totalAdjustments: recent.length,
      byType,
      averageImpact: recent.length > 0 ? totalImpact / recent.length : 0
    }
  }
}

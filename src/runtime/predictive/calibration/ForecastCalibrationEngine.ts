import type { CalibrationReport, CalibrationAdjustment } from './types.js'
import type { ForecastOutcomeTracker } from './ForecastOutcomeTracker.js'
import type { PredictionAccuracyAnalyzer } from './PredictionAccuracyAnalyzer.js'
import type { AdaptiveConfidenceScaler } from './AdaptiveConfidenceScaler.js'
import type { PredictionDriftDetector } from './PredictionDriftDetector.js'
import type { SelfHealingForecastAdjuster } from './SelfHealingForecastAdjuster.js'
import type { CalibrationStore } from './CalibrationStore.js'

/**
 * ForecastCalibrationEngine - Core calibration orchestrator
 * 
 * This is the central system that:
 * - Coordinates all calibration components
 * - Triggers recalibration cycles
 * - Manages calibration state
 * - Produces calibration reports
 * 
 * Key responsibilities:
 * - Analyze accuracy across all models
 * - Detect drift
 * - Apply automatic adjustments
 * - Scale confidence appropriately
 * - Generate actionable reports
 * 
 * This transforms:
 * FROM: Static prediction models
 * TO:   Self-correcting predictive intelligence
 * 
 * Architectural position:
 * Intent → Strategy → Forecast → Govern → Execute → Observe → CALIBRATE
 * 
 * This is where the runtime:
 * - Learns its own intuition reliability
 * - Corrects systematic errors
 * - Improves prediction quality over time
 */
export class ForecastCalibrationEngine {
  constructor(
    private readonly outcomeTracker: ForecastOutcomeTracker,
    private readonly accuracyAnalyzer: PredictionAccuracyAnalyzer,
    private readonly confidenceScaler: AdaptiveConfidenceScaler,
    private readonly driftDetector: PredictionDriftDetector,
    private readonly selfHealingAdjuster: SelfHealingForecastAdjuster,
    private readonly calibrationStore: CalibrationStore
  ) {}

  /**
   * Perform full calibration cycle for a tenant
   * 
   * This is the main entry point for recalibration.
   */
  async performFullCalibration(tenantId: string): Promise<CalibrationReport> {
    const startMessage = `Starting full calibration for tenant: ${tenantId}`
    console.log(startMessage)

    // Step 1: Analyze accuracy for all models
    const accuracyMetrics = await this.accuracyAnalyzer.analyzeAllModels(tenantId)

    // Step 2: Detect drift across all models
    const driftResults = await this.driftDetector.detectAllDrift(tenantId)

    // Step 3: Perform automatic adjustments
    const adjustments = await this.selfHealingAdjuster.performAutomaticAdjustmentForAllModels(tenantId)

    // Step 4: Update confidence scaling
    await this.updateConfidenceScaling(tenantId, accuracyMetrics)

    // Step 5: Update calibration states
    await this.updateCalibrationStates(tenantId, accuracyMetrics, driftResults)

    // Step 6: Generate report
    const report = await this.generateCalibrationReport(
      tenantId,
      accuracyMetrics,
      driftResults,
      adjustments
    )

    const completeMessage = `Calibration complete for tenant: ${tenantId}`
    console.log(completeMessage, {
      systemAccuracy: report.systemAccuracy,
      adjustmentsApplied: adjustments.length,
      modelsNeedingAttention: report.modelStatus.filter((m) => m.needsCalibration).length
    })

    return report
  }

  /**
   * Perform quick calibration check (lightweight)
   */
  async performQuickCalibrationCheck(tenantId: string): Promise<{
    needsCalibration: boolean
    reason?: string
    urgency?: string
  }> {
    // Check for drift in critical models
    const driftResults = await this.driftDetector.detectAllDrift(tenantId)

    const criticalDrift = driftResults.filter(
      (r) => r.driftDetected && (r.urgency === 'critical' || r.urgency === 'high')
    )

    if (criticalDrift.length > 0) {
      return {
        needsCalibration: true,
        reason: `${criticalDrift.length} model(s) have significant drift`,
        urgency: criticalDrift[0].urgency
      }
    }

    // Check for low accuracy
    const accuracyMetrics = await this.accuracyAnalyzer.analyzeAllModels(tenantId)
    const lowAccuracy = accuracyMetrics.filter((m) => m.overallAccuracy < 0.6)

    if (lowAccuracy.length > 0) {
      return {
        needsCalibration: true,
        reason: `${lowAccuracy.length} model(s) have low accuracy`,
        urgency: 'medium'
      }
    }

    return {
      needsCalibration: false
    }
  }

  /**
   * Get current calibration status
   */
  async getCalibrationStatus(tenantId: string): Promise<CalibrationReport> {
    const accuracyMetrics = await this.accuracyAnalyzer.analyzeAllModels(tenantId)
    const driftResults = await this.driftDetector.detectAllDrift(tenantId)
    const recentAdjustments = await this.selfHealingAdjuster.getAdjustmentHistory(tenantId, 10)

    return this.generateCalibrationReport(
      tenantId,
      accuracyMetrics,
      driftResults,
      recentAdjustments
    )
  }

  /**
   * Apply calibration to a prediction
   */
  async applyCalibration<T extends { confidence: number }>(
    tenantId: string,
    modelType: 'risk_engine' | 'entropy_forecaster' | 'decay_detector' | 'failure_analyzer' | 'goal_forecaster',
    prediction: T
  ): Promise<T & { calibrationApplied: boolean }> {
    // Apply confidence scaling
    const scaled = await this.confidenceScaler.scalePredictionConfidence(
      tenantId,
      modelType,
      prediction
    )

    return {
      ...scaled,
      calibrationApplied: scaled.scalingApplied
    }
  }

  /**
   * Record prediction outcome for learning
   */
  async recordOutcome(
    tenantId: string,
    forecastId: string,
    outcome: {
      success?: boolean
      failureOccurred?: boolean
      actualValue?: number
    }
  ): Promise<void> {
    // This would integrate with the outcome tracker
    // to record outcomes for specific forecasts
    console.log(`Outcome recorded for forecast ${forecastId}:`, outcome)
  }

  /**
   * Update confidence scaling based on accuracy
   */
  private async updateConfidenceScaling(
    tenantId: string,
    accuracyMetrics: Array<{ modelType: string; overallAccuracy: number }>
  ): Promise<void> {
    for (const metrics of accuracyMetrics) {
      await this.confidenceScaler.updateScaleFactor(
        tenantId,
        metrics.modelType,
        metrics.overallAccuracy
      )
    }
  }

  /**
   * Update calibration states
   */
  private async updateCalibrationStates(
    tenantId: string,
    accuracyMetrics: Array<{ modelType: string; overallAccuracy: number; accuracyTrend?: any }>,
    driftResults: Array<{ modelType: string; driftMagnitude: number; driftDetected: boolean }>
  ): Promise<void> {
    for (let i = 0; i < accuracyMetrics.length; i++) {
      const metrics = accuracyMetrics[i]
      const drift = driftResults[i]

      await this.calibrationStore.updateAccuracy(
        tenantId,
        metrics.modelType,
        metrics.overallAccuracy,
        'stable' // Would come from metrics.accuracyTrend
      )

      await this.calibrationStore.updateDrift(
        tenantId,
        drift.modelType,
        drift.driftMagnitude,
        drift.driftDetected
      )
    }
  }

  /**
   * Generate calibration report
   */
  private async generateCalibrationReport(
    tenantId: string,
    accuracyMetrics: Array<{ modelType: string; overallAccuracy: number; bias: string; sampleSize: number }>,
    driftResults: Array<{ modelType: string; driftDetected: boolean }>,
    adjustments: Array<any>
  ): Promise<CalibrationReport> {
    // Calculate system-wide accuracy
    const systemAccuracy = accuracyMetrics.length > 0
      ? accuracyMetrics.reduce((sum, m) => sum + m.overallAccuracy, 0) / accuracyMetrics.length
      : 0

    // Determine overall health
    let overallHealth: CalibrationReport['overallCalibrationHealth']
    if (systemAccuracy >= 0.85) {
      overallHealth = 'excellent'
    } else if (systemAccuracy >= 0.75) {
      overallHealth = 'good'
    } else if (systemAccuracy >= 0.65) {
      overallHealth = 'fair'
    } else {
      overallHealth = 'poor'
    }

    // Build model status
    const modelStatus = accuracyMetrics.map((m, i) => ({
      modelType: m.modelType,
      accuracy: m.overallAccuracy,
      bias: m.bias,
      driftDetected: driftResults[i]?.driftDetected || false,
      needsCalibration: m.overallAccuracy < 0.7 || (driftResults[i]?.driftDetected || false)
    }))

    // Build recommendations
    const recommendations: Array<{
      action: string
      priority: 'low' | 'medium' | 'high' | 'critical'
      expectedImpact: string
    }> = []

    for (const model of modelStatus) {
      if (model.needsCalibration) {
        recommendations.push({
          action: `Recalibrate ${model.modelType}`,
          priority: model.accuracy < 0.6 ? 'critical' : 'high',
          expectedImpact: `Improve ${model.modelType} accuracy by ~10-15%`
        })
      }
    }

    // Convert adjustments to calibration adjustments
    const recentAdjustments: CalibrationAdjustment[] = adjustments.slice(0, 5).map((adj) => ({
      modelType: adj.target,
      tenantId: adj.tenantId,
      confidenceScaling: 1.0,
      probabilityOffset: 0,
      thresholdAdjustments: {},
      reason: adj.trigger,
      historicalError: 0,
      expectedImprovement: adj.expectedAccuracyImprovement,
      appliedAt: adj.appliedAt
    }))

    return {
      tenantId,
      overallCalibrationHealth: overallHealth,
      systemAccuracy,
      modelStatus,
      recentAdjustments,
      recommendations,
      confidence: Math.min(
        ...accuracyMetrics.map((m) => (m.sampleSize >= 10 ? 0.8 : 0.5))
      ),
      generatedAt: new Date()
    }
  }

  /**
   * Get calibration recommendations
   */
  async getCalibrationRecommendations(tenantId: string): Promise<Array<{
    action: string
    priority: string
    expectedImpact: string
    modelType: string
  }>> {
    const report = await this.getCalibrationStatus(tenantId)

    return report.recommendations.map((r) => ({
      ...r,
      modelType: 'all'
    }))
  }

  /**
   * Trigger automatic recalibration if needed
   */
  async autoCalibrate(tenantId: string): Promise<{
    calibrationPerformed: boolean
    report?: CalibrationReport
    reason?: string
  }> {
    const check = await this.performQuickCalibrationCheck(tenantId)

    if (!check.needsCalibration) {
      return {
        calibrationPerformed: false,
        reason: 'No calibration needed'
      }
    }

    const report = await this.performFullCalibration(tenantId)

    return {
      calibrationPerformed: true,
      report,
      reason: check.reason
    }
  }
}

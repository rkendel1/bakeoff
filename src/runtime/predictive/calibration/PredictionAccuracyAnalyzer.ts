import type { AccuracyMetrics, ForecastOutcome } from './types.js'
import type { ForecastOutcomeStore } from './ForecastOutcomeStore.js'
import type { PredictionAccuracyStore } from './PredictionAccuracyStore.js'

/**
 * PredictionAccuracyAnalyzer - Computes prediction accuracy metrics
 * 
 * This analyzer computes:
 * - Brier score (probability accuracy)
 * - Calibration drift
 * - Overconfidence / underconfidence bias
 * - Per-component accuracy
 * 
 * Key insights:
 * - Brier score measures probability forecast accuracy
 * - Calibration error measures systematic bias
 * - Overconfidence = predictions too confident
 * - Underconfidence = predictions too uncertain
 * 
 * This produces the foundation for:
 * - Model adjustment decisions
 * - Confidence scaling
 * - Drift detection
 */
export class PredictionAccuracyAnalyzer {
  constructor(
    private readonly outcomeStore: ForecastOutcomeStore,
    private readonly accuracyStore: PredictionAccuracyStore
  ) {}

  /**
   * Analyze accuracy for risk engine
   */
  async analyzeRiskEngineAccuracy(tenantId: string): Promise<AccuracyMetrics> {
    const outcomes = await this.outcomeStore.getByType(tenantId, 'risk_assessment', 100)

    if (outcomes.length === 0) {
      return this.createDefaultMetrics('risk_engine', tenantId)
    }

    const brierScore = this.calculateBrierScore(outcomes)
    const overallAccuracy = 1 - brierScore // Convert to accuracy (0-1, higher = better)
    const biasResult = this.detectBias(outcomes)
    const calibrationError = this.calculateCalibrationError(outcomes)

    const metrics: AccuracyMetrics = {
      modelType: 'risk_engine',
      tenantId,
      overallAccuracy,
      brierScore,
      bias: biasResult.bias,
      biasScore: biasResult.score,
      calibrationError,
      sampleSize: outcomes.length,
      evaluationPeriod: {
        start: outcomes[outcomes.length - 1].recordedAt,
        end: outcomes[0].recordedAt
      },
      confidence: this.calculateConfidence(outcomes.length),
      computedAt: new Date()
    }

    await this.accuracyStore.store(metrics)
    return metrics
  }

  /**
   * Analyze accuracy for entropy forecaster
   */
  async analyzeEntropyForecasterAccuracy(tenantId: string): Promise<AccuracyMetrics> {
    const outcomes = await this.outcomeStore.getByType(tenantId, 'entropy_trajectory', 100)

    if (outcomes.length === 0) {
      return this.createDefaultMetrics('entropy_forecaster', tenantId)
    }

    const brierScore = this.calculateBrierScore(outcomes)
    const overallAccuracy = 1 - brierScore
    const biasResult = this.detectBias(outcomes)
    const calibrationError = this.calculateCalibrationError(outcomes)

    const metrics: AccuracyMetrics = {
      modelType: 'entropy_forecaster',
      tenantId,
      overallAccuracy,
      brierScore,
      bias: biasResult.bias,
      biasScore: biasResult.score,
      calibrationError,
      sampleSize: outcomes.length,
      evaluationPeriod: {
        start: outcomes[outcomes.length - 1].recordedAt,
        end: outcomes[0].recordedAt
      },
      confidence: this.calculateConfidence(outcomes.length),
      computedAt: new Date()
    }

    await this.accuracyStore.store(metrics)
    return metrics
  }

  /**
   * Analyze accuracy for decay detector
   */
  async analyzeDecayDetectorAccuracy(tenantId: string): Promise<AccuracyMetrics> {
    const outcomes = await this.outcomeStore.getByType(tenantId, 'strategy_decay', 100)

    if (outcomes.length === 0) {
      return this.createDefaultMetrics('decay_detector', tenantId)
    }

    const brierScore = this.calculateBrierScore(outcomes)
    const overallAccuracy = 1 - brierScore
    const biasResult = this.detectBias(outcomes)
    const calibrationError = this.calculateCalibrationError(outcomes)

    const metrics: AccuracyMetrics = {
      modelType: 'decay_detector',
      tenantId,
      overallAccuracy,
      brierScore,
      bias: biasResult.bias,
      biasScore: biasResult.score,
      calibrationError,
      sampleSize: outcomes.length,
      evaluationPeriod: {
        start: outcomes[outcomes.length - 1].recordedAt,
        end: outcomes[0].recordedAt
      },
      confidence: this.calculateConfidence(outcomes.length),
      computedAt: new Date()
    }

    await this.accuracyStore.store(metrics)
    return metrics
  }

  /**
   * Analyze accuracy for failure analyzer
   */
  async analyzeFailureAnalyzerAccuracy(tenantId: string): Promise<AccuracyMetrics> {
    const outcomes = await this.outcomeStore.getByType(tenantId, 'failure_trajectory', 100)

    if (outcomes.length === 0) {
      return this.createDefaultMetrics('failure_analyzer', tenantId)
    }

    const brierScore = this.calculateBrierScore(outcomes)
    const overallAccuracy = 1 - brierScore
    const biasResult = this.detectBias(outcomes)
    const calibrationError = this.calculateCalibrationError(outcomes)

    const metrics: AccuracyMetrics = {
      modelType: 'failure_analyzer',
      tenantId,
      overallAccuracy,
      brierScore,
      bias: biasResult.bias,
      biasScore: biasResult.score,
      calibrationError,
      sampleSize: outcomes.length,
      evaluationPeriod: {
        start: outcomes[outcomes.length - 1].recordedAt,
        end: outcomes[0].recordedAt
      },
      confidence: this.calculateConfidence(outcomes.length),
      computedAt: new Date()
    }

    await this.accuracyStore.store(metrics)
    return metrics
  }

  /**
   * Analyze accuracy for goal forecaster
   */
  async analyzeGoalForecasterAccuracy(tenantId: string): Promise<AccuracyMetrics> {
    const outcomes = await this.outcomeStore.getByType(tenantId, 'goal_completion', 100)

    if (outcomes.length === 0) {
      return this.createDefaultMetrics('goal_forecaster', tenantId)
    }

    const brierScore = this.calculateBrierScore(outcomes)
    const overallAccuracy = 1 - brierScore
    const biasResult = this.detectBias(outcomes)
    const calibrationError = this.calculateCalibrationError(outcomes)

    const metrics: AccuracyMetrics = {
      modelType: 'goal_forecaster',
      tenantId,
      overallAccuracy,
      brierScore,
      bias: biasResult.bias,
      biasScore: biasResult.score,
      calibrationError,
      sampleSize: outcomes.length,
      evaluationPeriod: {
        start: outcomes[outcomes.length - 1].recordedAt,
        end: outcomes[0].recordedAt
      },
      confidence: this.calculateConfidence(outcomes.length),
      computedAt: new Date()
    }

    await this.accuracyStore.store(metrics)
    return metrics
  }

  /**
   * Analyze all models for a tenant
   */
  async analyzeAllModels(tenantId: string): Promise<AccuracyMetrics[]> {
    return Promise.all([
      this.analyzeRiskEngineAccuracy(tenantId),
      this.analyzeEntropyForecasterAccuracy(tenantId),
      this.analyzeDecayDetectorAccuracy(tenantId),
      this.analyzeFailureAnalyzerAccuracy(tenantId),
      this.analyzeGoalForecasterAccuracy(tenantId)
    ])
  }

  /**
   * Calculate Brier score (lower is better, 0 = perfect)
   * 
   * Brier score measures the accuracy of probabilistic predictions
   * Score = (1/N) * Σ(predicted_probability - actual_outcome)^2
   */
  private calculateBrierScore(outcomes: ForecastOutcome[]): number {
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
   * Detect prediction bias (overconfident, underconfident, calibrated)
   */
  private detectBias(outcomes: ForecastOutcome[]): {
    bias: 'overconfident' | 'underconfident' | 'calibrated'
    score: number
  } {
    if (outcomes.length === 0) {
      return { bias: 'calibrated', score: 0 }
    }

    // Calculate average predicted vs actual
    let totalPredicted = 0
    let totalActual = 0
    let count = 0

    for (const outcome of outcomes) {
      // Extract probability predictions
      if (outcome.predicted.failureProbability !== undefined && 
          outcome.actual.failureOccurred !== undefined) {
        totalPredicted += outcome.predicted.failureProbability
        totalActual += outcome.actual.failureOccurred ? 1 : 0
        count++
      } else if (outcome.predicted.successProbability !== undefined && 
                 outcome.actual.success !== undefined) {
        totalPredicted += outcome.predicted.successProbability
        totalActual += outcome.actual.success ? 1 : 0
        count++
      }
    }

    if (count === 0) {
      return { bias: 'calibrated', score: 0 }
    }

    const avgPredicted = totalPredicted / count
    const avgActual = totalActual / count
    const biasScore = avgPredicted - avgActual

    // Overconfident = predicting higher probabilities than reality
    // Underconfident = predicting lower probabilities than reality
    if (biasScore > 0.1) {
      return { bias: 'overconfident', score: biasScore }
    } else if (biasScore < -0.1) {
      return { bias: 'underconfident', score: biasScore }
    } else {
      return { bias: 'calibrated', score: biasScore }
    }
  }

  /**
   * Calculate calibration error (mean absolute error)
   */
  private calculateCalibrationError(outcomes: ForecastOutcome[]): number {
    if (outcomes.length === 0) {
      return 0
    }

    const totalDrift = outcomes.reduce(
      (sum, o) => sum + o.errorMetrics.calibrationDrift,
      0
    )

    return totalDrift / outcomes.length
  }

  /**
   * Calculate confidence in metrics based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < 5) return 0.3
    if (sampleSize < 20) return 0.6
    if (sampleSize < 50) return 0.8
    return 0.95
  }

  /**
   * Create default metrics for models with no data
   */
  private createDefaultMetrics(
    modelType: AccuracyMetrics['modelType'],
    tenantId: string
  ): AccuracyMetrics {
    return {
      modelType,
      tenantId,
      overallAccuracy: 0.5,
      brierScore: 0.25,
      bias: 'calibrated',
      biasScore: 0,
      calibrationError: 0,
      sampleSize: 0,
      evaluationPeriod: {
        start: new Date(),
        end: new Date()
      },
      confidence: 0,
      computedAt: new Date()
    }
  }

  /**
   * Identify weakest performing model
   */
  async identifyWeakestModel(tenantId: string): Promise<{
    modelType: string
    accuracy: number
    needsImprovement: boolean
  } | undefined> {
    const allMetrics = await this.analyzeAllModels(tenantId)

    // Sort by accuracy ascending
    const sorted = allMetrics.sort((a, b) => a.overallAccuracy - b.overallAccuracy)

    if (sorted.length === 0) {
      return undefined
    }

    const weakest = sorted[0]

    return {
      modelType: weakest.modelType,
      accuracy: weakest.overallAccuracy,
      needsImprovement: weakest.overallAccuracy < 0.7
    }
  }
}

/**
 * Forecast Calibration Types
 * 
 * This layer introduces:
 * - Prediction outcome tracking
 * - Accuracy measurement
 * - Model calibration
 * - Self-correction
 * 
 * Architectural shift:
 * FROM: predict → assume correctness
 * TO:   predict → observe → correct → improve
 */

/**
 * ForecastOutcome - Links prediction to actual result
 */
export type ForecastOutcome = {
  forecastId: string
  tenantId: string
  forecastType: 'risk_assessment' | 'strategy_decay' | 'failure_trajectory' | 'goal_completion' | 'entropy_trajectory'
  
  // Predicted values
  predicted: {
    failureProbability?: number
    successProbability?: number
    entropyIncrease?: number
    decayRate?: number
    riskScore?: number
    [key: string]: number | undefined
  }
  
  // Actual outcomes
  actual: {
    failureOccurred?: boolean
    success?: boolean
    entropyChange?: number
    decayObserved?: number
    actualRiskLevel?: number
    [key: string]: boolean | number | undefined
  }
  
  // Error metrics
  errorMetrics: {
    probabilityError: number        // Brier score component
    calibrationDrift: number        // How far off the prediction was
    absoluteError?: number          // For continuous predictions
  }
  
  // Metadata
  recordedAt: Date
  forecastGeneratedAt: Date
  outcomeObservedAt: Date
}

/**
 * AccuracyMetrics - Computed accuracy for a prediction model
 */
export type AccuracyMetrics = {
  modelType: 'risk_engine' | 'entropy_forecaster' | 'decay_detector' | 'failure_analyzer' | 'goal_forecaster'
  tenantId: string
  
  // Overall accuracy
  overallAccuracy: number  // 0-1
  brierScore: number       // Lower is better (0 = perfect)
  
  // Bias detection
  bias: 'overconfident' | 'underconfident' | 'calibrated'
  biasScore: number        // Positive = overconfident, negative = underconfident
  
  // Calibration quality
  calibrationError: number  // Mean calibration error
  
  // Component-specific accuracy
  componentAccuracy?: {
    [component: string]: number
  }
  
  // Sample information
  sampleSize: number
  evaluationPeriod: {
    start: Date
    end: Date
  }
  
  // Confidence
  confidence: number  // 0-1
  
  // Computed at
  computedAt: Date
}

/**
 * CalibrationAdjustment - Adjustment factors for a prediction model
 */
export type CalibrationAdjustment = {
  modelType: string
  tenantId: string
  
  // Adjustment factors
  confidenceScaling: number      // Multiply confidence by this
  probabilityOffset: number      // Add this to probabilities
  thresholdAdjustments: {
    [threshold: string]: number  // Adjust specific thresholds
  }
  
  // Rationale
  reason: string
  historicalError: number
  expectedImprovement: number
  
  // Metadata
  appliedAt: Date
  effectiveUntil?: Date
}

/**
 * ModelCalibrationState - Current calibration state for a model
 */
export type ModelCalibrationState = {
  modelType: string
  tenantId: string
  
  // Current calibration parameters
  confidenceScaleFactor: number   // Current confidence scaling (1.0 = no adjustment)
  riskSensitivity: number         // Risk threshold sensitivity
  decaySensitivity: number        // Decay detection sensitivity
  entropyBaseline: number         // Entropy baseline adjustment
  convergenceExpectation: number  // Convergence threshold adjustment
  
  // Historical performance
  recentAccuracy: number
  accuracyTrend: 'improving' | 'stable' | 'declining'
  
  // Drift detection
  driftMagnitude: number          // How much model has drifted
  driftDetected: boolean
  
  // Last calibration
  lastCalibratedAt: Date
  calibrationCount: number
  
  // Next calibration
  nextCalibrationDue?: Date
}

/**
 * DriftDetectionResult - Detection of prediction drift
 */
export type DriftDetectionResult = {
  tenantId: string
  modelType: string
  
  // Drift status
  driftDetected: boolean
  driftMagnitude: number          // 0-1, higher = more drift
  driftType: 'accuracy_decline' | 'bias_shift' | 'distribution_change' | 'stable'
  
  // Contributing factors
  factors: Array<{
    factor: string
    contribution: number
    description: string
  }>
  
  // Trend analysis
  historicalAccuracy: Array<{
    timestamp: Date
    accuracy: number
  }>
  
  // Recommendation
  recommendedAction: 'recalibrate' | 'monitor' | 'no_action'
  urgency: 'low' | 'medium' | 'high' | 'critical'
  
  // Confidence
  confidence: number  // 0-1
  
  // Computed at
  detectedAt: Date
}

/**
 * CalibrationReport - Summary of calibration status
 */
export type CalibrationReport = {
  tenantId: string
  
  // Overall status
  overallCalibrationHealth: 'excellent' | 'good' | 'fair' | 'poor'
  systemAccuracy: number  // Aggregate accuracy
  
  // Per-model status
  modelStatus: Array<{
    modelType: string
    accuracy: number
    bias: string
    driftDetected: boolean
    needsCalibration: boolean
  }>
  
  // Recent adjustments
  recentAdjustments: CalibrationAdjustment[]
  
  // Recommendations
  recommendations: Array<{
    action: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    expectedImpact: string
  }>
  
  // Confidence in report
  confidence: number  // 0-1
  
  // Generated at
  generatedAt: Date
}

/**
 * SelfHealingAdjustment - Automatic system adjustment
 */
export type SelfHealingAdjustment = {
  tenantId: string
  adjustmentType: 'threshold' | 'sensitivity' | 'baseline' | 'confidence'
  
  // What changed
  target: string                 // Which parameter was adjusted
  previousValue: number
  newValue: number
  
  // Why it changed
  trigger: string               // What triggered the adjustment
  evidence: Array<{
    metric: string
    value: number
    threshold: number
  }>
  
  // Expected impact
  expectedAccuracyImprovement: number
  estimatedRiskReduction: number
  
  // Metadata
  appliedAt: Date
  automatic: boolean            // Was this automatic or manual
  confidence: number            // Confidence in adjustment
}

/**
 * Decision-Time Calibration Types
 * 
 * This layer introduces real-time calibration injection at decision-time.
 * 
 * Architectural shift:
 * FROM: predict → execute → calibrate (later)
 * TO:   predict → calibrate → execute
 * 
 * This transforms calibration from:
 * - retrospective model tuning
 * TO:
 * - real-time decision correction
 */

import type { PredictiveRiskAssessment } from '../types.js'
import type { ExecutionPlan } from '../../policy/types.js'
import type { StrategySelection } from '../../intent/types.js'

/**
 * CalibrationContext - Live correction context for decision-time
 * 
 * This is the "lens" through which decisions are made.
 */
export type CalibrationContext = {
  tenantId: string
  
  // Prediction accuracy state
  predictionAccuracy: {
    riskEngine: number              // 0-1, current accuracy
    entropyForecaster: number
    decayDetector: number
    failureAnalyzer: number
    goalForecaster: number
  }
  
  // Bias corrections
  biasAdjustments: {
    riskEngine: number              // Offset to apply to risk scores
    entropyModel: number            // Offset for entropy predictions
    decayModel: number              // Offset for decay predictions
  }
  
  // Drift state
  driftState: {
    riskEngineDrift: number         // 0-1, magnitude of drift
    strategyDrift: number
    providerDrift: number
    criticalDrift: boolean          // Any critical drift detected?
  }
  
  // Strategy preferences (learned from history)
  strategyPreferences: {
    [strategyName: string]: number  // Weight multiplier (1.0 = neutral)
  }
  
  // Provider reliability bias
  providerReliabilityBias: {
    [provider: string]: number      // Weight multiplier (1.0 = neutral)
  }
  
  // Confidence scaling factors
  confidenceScaling: {
    riskEngine: number              // Multiply risk confidence by this
    strategySelection: number       // Multiply strategy confidence by this
  }
  
  // Context metadata
  generatedAt: Date
  validUntil: Date
  confidence: number                // 0-1, confidence in this context
}

/**
 * DecisionAdjustment - Adjustment applied at decision-time
 */
export type DecisionAdjustment = {
  tenantId: string
  adjustmentType: 'risk_adjustment' | 'strategy_swap' | 'provider_reroute' | 'threshold_shift' | 'confidence_scaling'
  
  // What changed
  originalValue: number | string
  adjustedValue: number | string
  
  // Why it changed
  reason: string
  calibrationFactor: number         // The correction factor applied
  
  // Evidence
  evidence: Array<{
    signal: string
    value: number
    threshold?: number
  }>
  
  // Impact
  expectedImpact: string
  riskReduction?: number            // Expected risk reduction
  successProbabilityIncrease?: number
  
  // Metadata
  appliedAt: Date
  confidence: number                // 0-1
}

/**
 * CalibratedRiskAssessment - Risk assessment with calibration applied
 */
export type CalibratedRiskAssessment = {
  // Original assessment
  originalAssessment: PredictiveRiskAssessment
  
  // Calibrated values
  calibratedRiskScore: number       // Adjusted overall risk score
  calibratedConfidence: number      // Adjusted confidence
  
  // Adjustments made
  adjustments: DecisionAdjustment[]
  
  // Calibration metadata
  calibrationApplied: boolean
  calibrationContext: CalibrationContext
  
  // Timestamp
  assessedAt: Date
}

/**
 * StrategyBias - Learned bias for a strategy
 */
export type StrategyBias = {
  strategyName: string
  goalId: string
  tenantId: string
  
  // Bias metrics
  historicalSuccessRate: number     // Actual historical success
  predictedSuccessRate: number      // What models predict
  biasMagnitude: number             // Difference (actual - predicted)
  
  // Trend
  recentPerformance: 'improving' | 'stable' | 'declining'
  decayDetected: boolean
  
  // Adjustment
  biasWeight: number                // Weight multiplier for this strategy
  recommendAvoid: boolean           // Should we avoid this strategy?
  recommendPrefer: boolean          // Should we prefer this strategy?
  
  // Evidence
  sampleSize: number
  lastUpdated: Date
  confidence: number                // 0-1
}

/**
 * PlanRewriteRecord - Audit record of plan modification
 */
export type PlanRewriteRecord = {
  id: string
  tenantId: string
  
  // Original plan
  originalPlan: {
    strategy: string
    provider?: string
    riskScore: number
    expectedSuccess: number
  }
  
  // Rewritten plan
  rewrittenPlan: {
    strategy: string
    provider?: string
    riskScore: number
    expectedSuccess: number
  }
  
  // Why rewritten
  rewriteReason: string
  calibrationFactors: Array<{
    factor: string
    value: number
    impact: string
  }>
  
  // Outcome (filled in later)
  actualOutcome?: {
    executed: boolean
    success: boolean
    rewriteWasCorrect: boolean      // Did the rewrite improve outcome?
    verifiedAt: Date
  }
  
  // Metadata
  rewrittenAt: Date
  confidence: number                // 0-1
}

/**
 * DecisionTimeCalibration - Complete calibration state at decision-time
 */
export type DecisionTimeCalibration = {
  tenantId: string
  
  // Context
  context: CalibrationContext
  
  // Risk calibration
  riskCalibration: {
    originalRisk: number
    calibratedRisk: number
    adjustment: number
    reason: string
  }
  
  // Strategy calibration
  strategyCalibration: {
    originalStrategy: string
    recommendedStrategy: string
    swapped: boolean
    reason: string
    confidenceIncrease: number
  }
  
  // Provider calibration
  providerCalibration?: {
    originalProvider: string
    recommendedProvider: string
    rerouted: boolean
    reason: string
  }
  
  // Aggregate impact
  aggregateImpact: {
    riskReduction: number
    successProbabilityIncrease: number
    expectedImprovement: string
  }
  
  // Metadata
  calibratedAt: Date
  confidence: number                // 0-1
}

/**
 * DecisionEvaluationResult - Result of full decision-time pipeline
 */
export type DecisionEvaluationResult = {
  tenantId: string
  goalId?: string
  
  // Pipeline stages
  stages: {
    forecast: PredictiveRiskAssessment
    calibration: DecisionTimeCalibration
    finalDecision: {
      shouldProceed: boolean
      recommendedStrategy: string
      recommendedProvider?: string
      confidence: number
    }
  }
  
  // Summary
  summary: {
    calibrationApplied: boolean
    decisionsModified: number
    riskReduction: number
    expectedSuccessIncrease: number
  }
  
  // Recommendations
  recommendations: string[]
  
  // Metadata
  evaluatedAt: Date
  processingTimeMs: number
}

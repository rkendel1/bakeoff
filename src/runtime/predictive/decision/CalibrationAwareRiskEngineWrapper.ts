import type { PredictiveRiskAssessment, PredictedRisk } from '../types.js'
import type { PredictiveRiskEngine } from '../PredictiveRiskEngine.js'
import type { CalibrationContext, CalibratedRiskAssessment, DecisionAdjustment } from './types.js'

/**
 * CalibrationAwareRiskEngineWrapper - Wraps PredictiveRiskEngine with calibration
 * 
 * This wraps the existing PredictiveRiskEngine and injects:
 * - Calibration-adjusted confidence weights
 * - Bias correction factors
 * - Drift compensation
 * 
 * Key insight:
 * Raw risk assessment = model's opinion
 * Calibrated risk assessment = model's opinion + learned correction
 * 
 * This transforms:
 * FROM: "Model says risk is 0.82"
 * TO:   "Model says 0.82, but it tends to overestimate by 0.14, so real risk is ~0.68"
 */
export class CalibrationAwareRiskEngineWrapper {
  // Risk adjustment limits
  private readonly MAX_RISK_ADJUSTMENT = 0.3   // Max ±0.3 adjustment
  private readonly MIN_CONFIDENCE = 0.3        // Minimum confidence threshold
  
  constructor(
    private readonly riskEngine: PredictiveRiskEngine
  ) {}
  
  /**
   * Assess risks with calibration applied
   * 
   * This is the main entry point.
   */
  async assessRisksWithCalibration(
    tenantId: string,
    context: CalibrationContext,
    forecastWindow: string = '24h'
  ): Promise<CalibratedRiskAssessment> {
    const startTime = Date.now()
    
    // Get original risk assessment
    const originalAssessment = await this.riskEngine.assessRisks(tenantId, forecastWindow)
    
    // Apply calibration adjustments
    const adjustments: DecisionAdjustment[] = []
    
    // 1. Adjust overall risk score
    const riskAdjustment = this.calculateRiskAdjustment(
      originalAssessment.overallRiskScore,
      context
    )
    
    if (riskAdjustment.adjusted) {
      adjustments.push({
        tenantId,
        adjustmentType: 'risk_adjustment',
        originalValue: originalAssessment.overallRiskScore,
        adjustedValue: riskAdjustment.adjustedRisk,
        reason: riskAdjustment.reason,
        calibrationFactor: riskAdjustment.adjustmentFactor,
        evidence: riskAdjustment.evidence,
        expectedImpact: `Risk score adjusted by ${(riskAdjustment.adjustmentFactor * 100).toFixed(0)}%`,
        riskReduction: riskAdjustment.adjustmentFactor > 0
          ? -riskAdjustment.adjustmentFactor
          : riskAdjustment.adjustmentFactor,
        appliedAt: new Date(),
        confidence: context.confidence
      })
    }
    
    // 2. Adjust confidence
    const confidenceAdjustment = this.calculateConfidenceAdjustment(
      originalAssessment.confidence,
      context
    )
    
    if (confidenceAdjustment.adjusted) {
      adjustments.push({
        tenantId,
        adjustmentType: 'confidence_scaling',
        originalValue: originalAssessment.confidence,
        adjustedValue: confidenceAdjustment.adjustedConfidence,
        reason: confidenceAdjustment.reason,
        calibrationFactor: confidenceAdjustment.scalingFactor,
        evidence: confidenceAdjustment.evidence,
        expectedImpact: `Confidence scaled by ${(confidenceAdjustment.scalingFactor * 100).toFixed(0)}%`,
        appliedAt: new Date(),
        confidence: context.confidence
      })
    }
    
    // 3. Adjust individual risk predictions
    // (Could enhance further by adjusting individual risk probabilities)
    
    const calibratedRiskScore = riskAdjustment.adjusted
      ? riskAdjustment.adjustedRisk
      : originalAssessment.overallRiskScore
    
    const calibratedConfidence = confidenceAdjustment.adjusted
      ? confidenceAdjustment.adjustedConfidence
      : originalAssessment.confidence
    
    return {
      originalAssessment,
      calibratedRiskScore,
      calibratedConfidence,
      adjustments,
      calibrationApplied: adjustments.length > 0,
      calibrationContext: context,
      assessedAt: new Date()
    }
  }
  
  /**
   * Calculate risk adjustment
   */
  private calculateRiskAdjustment(
    originalRisk: number,
    context: CalibrationContext
  ): {
    adjusted: boolean
    adjustedRisk: number
    adjustmentFactor: number
    reason: string
    evidence: Array<{ signal: string; value: number; threshold?: number }>
  } {
    const evidence: Array<{ signal: string; value: number; threshold?: number }> = []
    
    // Start with bias adjustment
    let adjustment = context.biasAdjustments.riskEngine
    
    evidence.push({
      signal: 'risk_engine_bias',
      value: context.biasAdjustments.riskEngine,
      threshold: 0.1
    })
    
    // Factor in drift
    if (context.driftState.riskEngineDrift > 0.2) {
      // High drift → reduce confidence in predictions
      // This translates to dampening extreme predictions
      const driftFactor = context.driftState.riskEngineDrift * 0.5
      
      if (originalRisk > 0.7) {
        // High risk predictions should be reduced
        adjustment -= driftFactor * 0.3
      } else if (originalRisk < 0.3) {
        // Low risk predictions should be increased
        adjustment += driftFactor * 0.2
      }
      
      evidence.push({
        signal: 'risk_engine_drift',
        value: context.driftState.riskEngineDrift,
        threshold: 0.2
      })
    }
    
    // Factor in accuracy
    if (context.predictionAccuracy.riskEngine < 0.7) {
      // Low accuracy → be more conservative (increase risk estimates)
      adjustment += (0.7 - context.predictionAccuracy.riskEngine) * 0.5
      
      evidence.push({
        signal: 'risk_engine_accuracy',
        value: context.predictionAccuracy.riskEngine,
        threshold: 0.7
      })
    }
    
    // Clamp adjustment
    adjustment = Math.max(-this.MAX_RISK_ADJUSTMENT, Math.min(this.MAX_RISK_ADJUSTMENT, adjustment))
    
    // Apply adjustment
    const adjustedRisk = Math.max(0, Math.min(1, originalRisk + adjustment))
    
    // Determine if adjustment is significant
    const significant = Math.abs(adjustment) > 0.05
    
    // Generate reason
    let reason = 'No significant calibration adjustment needed'
    if (significant) {
      if (adjustment < 0) {
        reason = `Risk reduced by ${Math.abs(adjustment).toFixed(2)} due to historical overestimation bias`
      } else {
        reason = `Risk increased by ${adjustment.toFixed(2)} due to low model accuracy and drift`
      }
    }
    
    return {
      adjusted: significant,
      adjustedRisk,
      adjustmentFactor: adjustment,
      reason,
      evidence
    }
  }
  
  /**
   * Calculate confidence adjustment
   */
  private calculateConfidenceAdjustment(
    originalConfidence: number,
    context: CalibrationContext
  ): {
    adjusted: boolean
    adjustedConfidence: number
    scalingFactor: number
    reason: string
    evidence: Array<{ signal: string; value: number; threshold?: number }>
  } {
    const evidence: Array<{ signal: string; value: number; threshold?: number }> = []
    
    // Get scaling factor from context
    let scalingFactor = context.confidenceScaling.riskEngine
    
    evidence.push({
      signal: 'confidence_scaling',
      value: scalingFactor,
      threshold: 0.9
    })
    
    // Factor in drift
    if (context.driftState.criticalDrift) {
      scalingFactor *= 0.8  // Reduce confidence significantly
      
      evidence.push({
        signal: 'critical_drift_detected',
        value: 1,
        threshold: 1
      })
    }
    
    // Apply scaling
    const adjustedConfidence = Math.max(
      this.MIN_CONFIDENCE,
      Math.min(1, originalConfidence * scalingFactor)
    )
    
    // Determine if adjustment is significant
    const significant = Math.abs(adjustedConfidence - originalConfidence) > 0.1
    
    // Generate reason
    let reason = 'No significant confidence adjustment needed'
    if (significant) {
      if (adjustedConfidence < originalConfidence) {
        reason = `Confidence reduced due to model drift and low historical accuracy`
      } else {
        reason = `Confidence increased due to high model accuracy`
      }
    }
    
    return {
      adjusted: significant,
      adjustedConfidence,
      scalingFactor,
      reason,
      evidence
    }
  }
  
  /**
   * Get the underlying risk engine (for direct access if needed)
   */
  getUnderlyingEngine(): PredictiveRiskEngine {
    return this.riskEngine
  }
}

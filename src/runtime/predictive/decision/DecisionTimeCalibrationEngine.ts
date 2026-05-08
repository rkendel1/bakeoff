import type {
  CalibrationContext,
  DecisionTimeCalibration,
  DecisionEvaluationResult,
  CalibratedRiskAssessment
} from './types.js'
import type { StrategySelection } from '../../intent/types.js'
import type { RealTimeCalibrationContextBuilder } from './RealTimeCalibrationContextBuilder.js'
import type { CalibrationAwareRiskEngineWrapper } from './CalibrationAwareRiskEngineWrapper.js'
import type { StrategyBiasInjector } from './StrategyBiasInjector.js'
import type { DecisionCalibrationStore } from './DecisionCalibrationStore.js'

/**
 * DecisionTimeCalibrationEngine - Core decision-time calibration orchestrator
 * 
 * This is the heart of PR-017.
 * 
 * It adjusts:
 * - Risk thresholds
 * - Strategy selection weights
 * - Provider choice bias
 * - Entropy sensitivity
 * - Convergence tolerance
 * 
 * BEFORE execution happens.
 * 
 * Architectural insight:
 * This is where prediction stops being informational and becomes causal.
 * 
 * The calibration engine:
 * 1. Builds real-time calibration context
 * 2. Applies calibration to risk assessment
 * 3. Applies learned biases to strategy selection
 * 4. Produces adjusted decision
 * 
 * This transforms:
 * FROM: observe reality → learn
 * TO:   observe reality → learn → shape future reality
 */
export class DecisionTimeCalibrationEngine {
  // Calibration thresholds
  private readonly SIGNIFICANT_RISK_CHANGE = 0.1
  private readonly SIGNIFICANT_CONFIDENCE_CHANGE = 0.15
  
  constructor(
    private readonly contextBuilder: RealTimeCalibrationContextBuilder,
    private readonly calibratedRiskEngine: CalibrationAwareRiskEngineWrapper,
    private readonly biasInjector: StrategyBiasInjector,
    private readonly calibrationStore: DecisionCalibrationStore
  ) {}
  
  /**
   * Perform full decision-time calibration
   * 
   * This is the main entry point for the decision-time pipeline.
   */
  async performDecisionTimeCalibration(
    tenantId: string,
    goalId: string,
    strategySelection: StrategySelection
  ): Promise<DecisionTimeCalibration> {
    const startTime = Date.now()
    
    // 1. Build calibration context
    const context = await this.contextBuilder.buildContext(tenantId)
    
    // 2. Get calibrated risk assessment
    const calibratedRisk = await this.calibratedRiskEngine.assessRisksWithCalibration(
      tenantId,
      context
    )
    
    // 3. Apply strategy bias
    const biasedStrategy = await this.biasInjector.applyBias(
      tenantId,
      goalId,
      strategySelection,
      context
    )
    
    // 4. Construct calibration result
    const calibration: DecisionTimeCalibration = {
      tenantId,
      context,
      riskCalibration: {
        originalRisk: calibratedRisk.originalAssessment.overallRiskScore,
        calibratedRisk: calibratedRisk.calibratedRiskScore,
        adjustment: calibratedRisk.calibratedRiskScore - calibratedRisk.originalAssessment.overallRiskScore,
        reason: this.summarizeRiskAdjustments(calibratedRisk)
      },
      strategyCalibration: {
        originalStrategy: strategySelection.selectedStrategy,
        recommendedStrategy: biasedStrategy.adjustedSelection.selectedStrategy,
        swapped: biasedStrategy.adjustedSelection.selectedStrategy !== strategySelection.selectedStrategy,
        reason: this.summarizeStrategyAdjustments(biasedStrategy),
        confidenceIncrease: biasedStrategy.adjustedSelection.confidence - strategySelection.confidence
      },
      aggregateImpact: {
        riskReduction: this.calculateRiskReduction(calibratedRisk),
        successProbabilityIncrease: this.calculateSuccessIncrease(biasedStrategy),
        expectedImprovement: this.describeExpectedImprovement(calibratedRisk, biasedStrategy)
      },
      calibratedAt: new Date(),
      confidence: this.calculateOverallConfidence(context, calibratedRisk, biasedStrategy)
    }
    
    // 5. Store calibration
    await this.calibrationStore.recordCalibration(calibration)
    
    return calibration
  }
  
  /**
   * Evaluate full decision pipeline
   * 
   * This runs: forecast → calibration → decision
   */
  async evaluateDecisionPipeline(
    tenantId: string,
    goalId?: string
  ): Promise<DecisionEvaluationResult> {
    const startTime = Date.now()
    
    // 1. Build calibration context
    const context = await this.contextBuilder.buildContext(tenantId)
    
    // 2. Get calibrated risk assessment
    const calibratedRisk = await this.calibratedRiskEngine.assessRisksWithCalibration(
      tenantId,
      context
    )
    
    // 3. Determine if execution should proceed
    const shouldProceed = this.shouldProceedWithExecution(calibratedRisk)
    
    // 4. Get strategy recommendation (if goalId provided)
    let recommendedStrategy = 'auto_select'
    let strategyConfidence = 0.8
    
    if (goalId) {
      // Would normally call GoalPlanner here, but we'll use placeholder
      // In real implementation, this would call:
      // const selection = await this.goalPlanner.selectStrategy(tenantId, goalId)
      // const biasedSelection = await this.biasInjector.applyBias(tenantId, goalId, selection, context)
      // recommendedStrategy = biasedSelection.adjustedSelection.selectedStrategy
      // strategyConfidence = biasedSelection.adjustedSelection.confidence
    }
    
    // 5. Construct dummy calibration for evaluation
    const dummyCalibration: DecisionTimeCalibration = {
      tenantId,
      context,
      riskCalibration: {
        originalRisk: calibratedRisk.originalAssessment.overallRiskScore,
        calibratedRisk: calibratedRisk.calibratedRiskScore,
        adjustment: calibratedRisk.calibratedRiskScore - calibratedRisk.originalAssessment.overallRiskScore,
        reason: this.summarizeRiskAdjustments(calibratedRisk)
      },
      strategyCalibration: {
        originalStrategy: recommendedStrategy,
        recommendedStrategy,
        swapped: false,
        reason: 'No strategy adjustment (evaluation mode)',
        confidenceIncrease: 0
      },
      aggregateImpact: {
        riskReduction: this.calculateRiskReduction(calibratedRisk),
        successProbabilityIncrease: 0,
        expectedImprovement: 'Risk calibration applied'
      },
      calibratedAt: new Date(),
      confidence: context.confidence
    }
    
    const processingTimeMs = Date.now() - startTime
    
    return {
      tenantId,
      goalId,
      stages: {
        forecast: calibratedRisk.originalAssessment,
        calibration: dummyCalibration,
        finalDecision: {
          shouldProceed,
          recommendedStrategy,
          confidence: strategyConfidence
        }
      },
      summary: {
        calibrationApplied: calibratedRisk.calibrationApplied,
        decisionsModified: calibratedRisk.adjustments.length,
        riskReduction: this.calculateRiskReduction(calibratedRisk),
        expectedSuccessIncrease: 0
      },
      recommendations: this.generateRecommendations(calibratedRisk),
      evaluatedAt: new Date(),
      processingTimeMs
    }
  }
  
  /**
   * Determine if execution should proceed
   */
  private shouldProceedWithExecution(calibratedRisk: CalibratedRiskAssessment): boolean {
    // Use calibrated risk score for decision
    const riskScore = calibratedRisk.calibratedRiskScore
    
    // Safe if risk < 0.5
    if (riskScore < 0.5) {
      return true
    }
    
    // Risky but acceptable if risk < 0.7 and confidence is high
    if (riskScore < 0.7 && calibratedRisk.calibratedConfidence > 0.7) {
      return true
    }
    
    // Unsafe if risk >= 0.8
    if (riskScore >= 0.8) {
      return false
    }
    
    // Default to proceed with caution
    return true
  }
  
  /**
   * Summarize risk adjustments
   */
  private summarizeRiskAdjustments(calibratedRisk: CalibratedRiskAssessment): string {
    if (!calibratedRisk.calibrationApplied || calibratedRisk.adjustments.length === 0) {
      return 'No calibration adjustment applied'
    }
    
    const reasons = calibratedRisk.adjustments.map(adj => adj.reason)
    return reasons.join('; ')
  }
  
  /**
   * Summarize strategy adjustments
   */
  private summarizeStrategyAdjustments(biasedStrategy: {
    adjustedSelection: StrategySelection
    biasApplied: boolean
    adjustments: Array<{
      strategy: string
      originalConfidence: number
      adjustedConfidence: number
      reason: string
    }>
  }): string {
    if (!biasedStrategy.biasApplied || biasedStrategy.adjustments.length === 0) {
      return 'No bias adjustment applied'
    }
    
    const reasons = biasedStrategy.adjustments.map(adj => adj.reason)
    return reasons.join('; ')
  }
  
  /**
   * Calculate risk reduction from calibration
   */
  private calculateRiskReduction(calibratedRisk: CalibratedRiskAssessment): number {
    return calibratedRisk.originalAssessment.overallRiskScore - calibratedRisk.calibratedRiskScore
  }
  
  /**
   * Calculate success increase from strategy adjustment
   */
  private calculateSuccessIncrease(biasedStrategy: {
    adjustedSelection: StrategySelection
    biasApplied: boolean
    adjustments: Array<{
      strategy: string
      originalConfidence: number
      adjustedConfidence: number
      reason: string
    }>
  }): number {
    if (!biasedStrategy.biasApplied || biasedStrategy.adjustments.length === 0) {
      return 0
    }
    
    // Estimate success increase from confidence change
    const adjustment = biasedStrategy.adjustments[0]
    return adjustment.adjustedConfidence - adjustment.originalConfidence
  }
  
  /**
   * Describe expected improvement
   */
  private describeExpectedImprovement(
    calibratedRisk: CalibratedRiskAssessment,
    biasedStrategy: {
      adjustedSelection: StrategySelection
      biasApplied: boolean
      adjustments: Array<any>
    }
  ): string {
    const improvements: string[] = []
    
    if (calibratedRisk.calibrationApplied) {
      const riskReduction = this.calculateRiskReduction(calibratedRisk)
      if (riskReduction > 0) {
        improvements.push(`Risk reduced by ${(riskReduction * 100).toFixed(0)}%`)
      } else if (riskReduction < 0) {
        improvements.push(`Risk increased by ${(Math.abs(riskReduction) * 100).toFixed(0)}% (conservative adjustment)`)
      }
    }
    
    if (biasedStrategy.biasApplied) {
      improvements.push('Strategy selection adjusted based on learned bias')
    }
    
    return improvements.length > 0
      ? improvements.join('; ')
      : 'No significant improvement expected'
  }
  
  /**
   * Calculate overall confidence in calibration
   */
  private calculateOverallConfidence(
    context: CalibrationContext,
    calibratedRisk: CalibratedRiskAssessment,
    biasedStrategy: {
      adjustedSelection: StrategySelection
      biasApplied: boolean
      adjustments: Array<any>
    }
  ): number {
    // Combine context confidence with calibration confidence
    return (context.confidence * 0.6) + (calibratedRisk.calibratedConfidence * 0.4)
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(calibratedRisk: CalibratedRiskAssessment): string[] {
    const recommendations: string[] = []
    
    if (calibratedRisk.calibratedRiskScore > 0.7) {
      recommendations.push('High risk detected even after calibration - consider delaying execution')
    }
    
    if (calibratedRisk.calibrationContext.driftState.criticalDrift) {
      recommendations.push('Critical model drift detected - review recent execution patterns')
    }
    
    if (calibratedRisk.calibratedConfidence < 0.5) {
      recommendations.push('Low confidence in risk assessment - gather more execution data')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Execution appears safe to proceed')
    }
    
    return recommendations
  }
}

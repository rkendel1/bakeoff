import type { PredictiveGovernanceRecommendation } from './types.js'
import type { PredictiveRiskEngine } from './PredictiveRiskEngine.js'
import type { RuntimePolicyEngine } from '../policy/RuntimePolicyEngine.js'

/**
 * PredictiveGovernanceEngine - Governance enhanced with forecasting
 * 
 * This transforms governance from:
 * "Is execution currently safe?"
 * to:
 * "Will this execution likely become unsafe soon?"
 * 
 * This is the beginning of:
 * - Proactive governance
 * - Anticipatory execution control
 * - Risk-informed operational decisions
 * 
 * Architecture:
 * Current governance: reactive (respond to current state)
 * Predictive governance: anticipatory (respond to predicted state)
 * 
 * This is a fundamental shift in runtime cognition.
 */
export class PredictiveGovernanceEngine {
  // Risk thresholds for governance
  private readonly SAFE_RISK_THRESHOLD = 0.3
  private readonly RISKY_RISK_THRESHOLD = 0.6
  private readonly UNSAFE_RISK_THRESHOLD = 0.8

  constructor(
    private readonly riskEngine: PredictiveRiskEngine,
    private readonly policyEngine: RuntimePolicyEngine
  ) {}

  /**
   * Generate predictive governance recommendations
   */
  async generateRecommendations(
    tenantId: string
  ): Promise<PredictiveGovernanceRecommendation> {
    // Get risk assessment
    const riskAssessment = await this.riskEngine.assessRisks(tenantId)

    // Determine execution safety
    const executionRiskScore = riskAssessment.overallRiskScore
    const predictedExecutionSafety = this.determineSafety(executionRiskScore)

    // Generate governance recommendations
    const recommendations = this.generateGovernanceRecommendations(
      riskAssessment,
      predictedExecutionSafety
    )

    return {
      tenantId,
      currentRisks: riskAssessment.risks,
      recommendations,
      predictedExecutionSafety,
      executionRiskScore,
      confidence: riskAssessment.confidence,
      generatedAt: new Date()
    }
  }

  /**
   * Evaluate if execution should proceed given predicted risks
   */
  async shouldProceedWithExecution(
    tenantId: string
  ): Promise<{
    shouldProceed: boolean
    reasoning: string[]
    requiredActions: string[]
  }> {
    const recommendation = await this.generateRecommendations(tenantId)

    // Decision logic
    if (recommendation.predictedExecutionSafety === 'safe') {
      return {
        shouldProceed: true,
        reasoning: ['Predicted execution safety is acceptable'],
        requiredActions: []
      }
    } else if (recommendation.predictedExecutionSafety === 'risky') {
      // Proceed with caution and mitigations
      const preventiveActions = recommendation.recommendations
        .filter((r) => r.type === 'preventive')
        .map((r) => r.action)

      return {
        shouldProceed: true,
        reasoning: [
          'Predicted execution has risks but can proceed with mitigations',
          `Risk score: ${recommendation.executionRiskScore.toFixed(2)}`
        ],
        requiredActions: preventiveActions
      }
    } else {
      // Unsafe: should not proceed without addressing risks
      const criticalActions = recommendation.recommendations
        .filter((r) => r.priority === 'critical' || r.priority === 'high')
        .map((r) => r.action)

      return {
        shouldProceed: false,
        reasoning: [
          'Predicted execution safety is UNSAFE',
          `Risk score: ${recommendation.executionRiskScore.toFixed(2)}`,
          'Critical risks must be addressed before execution'
        ],
        requiredActions: criticalActions
      }
    }
  }

  /**
   * Determine execution safety level
   */
  private determineSafety(
    riskScore: number
  ): 'safe' | 'risky' | 'unsafe' {
    if (riskScore < this.SAFE_RISK_THRESHOLD) {
      return 'safe'
    } else if (riskScore < this.UNSAFE_RISK_THRESHOLD) {
      return 'risky'
    } else {
      return 'unsafe'
    }
  }

  /**
   * Generate governance recommendations
   */
  private generateGovernanceRecommendations(
    riskAssessment: any,
    predictedSafety: 'safe' | 'risky' | 'unsafe'
  ): Array<{
    type: 'preventive' | 'adaptive' | 'recovery'
    action: string
    rationale: string[]
    expectedImpact: string
    priority: 'low' | 'medium' | 'high' | 'critical'
  }> {
    const recommendations: Array<{
      type: 'preventive' | 'adaptive' | 'recovery'
      action: string
      rationale: string[]
      expectedImpact: string
      priority: 'low' | 'medium' | 'high' | 'critical'
    }> = []

    // Preventive actions (before execution)
    for (const action of riskAssessment.preemptiveActions) {
      recommendations.push({
        type: 'preventive',
        action: action.action,
        rationale: [
          `Predicted risk reduction: ${(action.estimatedRiskReduction * 100).toFixed(0)}%`,
          action.expectedImpact
        ],
        expectedImpact: action.expectedImpact,
        priority: action.priority
      })
    }

    // Adaptive actions (during execution)
    if (predictedSafety === 'risky' || predictedSafety === 'unsafe') {
      recommendations.push({
        type: 'adaptive',
        action: 'enable_real_time_risk_monitoring',
        rationale: [
          'Continuously monitor execution against predicted risks',
          'Enable dynamic adaptation if risks materialize'
        ],
        expectedImpact: 'Real-time risk detection and mitigation',
        priority: predictedSafety === 'unsafe' ? 'critical' : 'high'
      })
    }

    // Recovery actions (if execution fails)
    if (riskAssessment.risks.some((r: any) => r.type === 'execution_failure')) {
      recommendations.push({
        type: 'recovery',
        action: 'enable_enhanced_fallback_mechanisms',
        rationale: [
          'High probability of execution failure detected',
          'Prepare fallback execution paths'
        ],
        expectedImpact: 'Faster recovery from predicted failures',
        priority: 'high'
      })
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    )

    return recommendations
  }

  /**
   * Get execution confidence given predicted risks
   */
  async getExecutionConfidence(tenantId: string): Promise<number> {
    const riskAssessment = await this.riskEngine.assessRisks(tenantId)
    
    // Execution confidence is inverse of risk
    // But weighted by assessment confidence
    const baseConfidence = 1 - riskAssessment.overallRiskScore
    const weightedConfidence = baseConfidence * riskAssessment.confidence

    return weightedConfidence
  }
}

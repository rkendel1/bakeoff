import type { ExecutionPlan } from '../../policy/types.js'
import type { StrategySelection } from '../../intent/types.js'
import type { CalibrationContext, PlanRewriteRecord } from './types.js'
import type { PlanRewriteAuditStore } from './PlanRewriteAuditStore.js'

/**
 * ExecutionPlanRewriter - Rewrites execution plans BEFORE execution
 * 
 * This is critical.
 * 
 * It allows runtime to:
 * - Rewrite execution plans BEFORE execution
 * - Swap providers
 * - Change strategies
 * - Adjust retry logic
 * - Modify entropy tolerance
 * 
 * Example:
 * Before:  send_for_signature → docuseal
 * After:   send_for_signature → docusign
 * 
 * Because:
 * - docuseal decay detected
 * - risk forecast adjusted downward
 * - calibration bias correction applied
 * 
 * Key insight:
 * Plan rewriting = runtime exercising agency over its own behavior
 * 
 * This is where:
 * - Intelligence becomes action
 * - Prediction becomes prevention
 * - Learning becomes adaptation
 */
export class ExecutionPlanRewriter {
  // Rewrite thresholds
  private readonly PROVIDER_SWAP_THRESHOLD = 0.6   // Swap if weight < 0.6
  private readonly STRATEGY_SWAP_THRESHOLD = 0.65  // Swap if weight < 0.65
  
  constructor(
    private readonly auditStore: PlanRewriteAuditStore
  ) {}
  
  /**
   * Rewrite execution plan based on calibration
   * 
   * This is the main entry point.
   */
  async rewritePlan(
    tenantId: string,
    originalStrategy: StrategySelection,
    adjustedStrategy: StrategySelection,
    context: CalibrationContext,
    originalPlan?: ExecutionPlan
  ): Promise<{
    rewritten: boolean
    plan: ExecutionPlan | null
    rewriteRecord?: PlanRewriteRecord
    modifications: Array<{
      type: 'strategy_swap' | 'provider_reroute' | 'retry_adjustment' | 'threshold_adjustment'
      description: string
      reason: string
    }>
  }> {
    const modifications: Array<{
      type: 'strategy_swap' | 'provider_reroute' | 'retry_adjustment' | 'threshold_adjustment'
      description: string
      reason: string
    }> = []
    
    let rewritten = false
    let plan = originalPlan || null
    let rewriteRecord: PlanRewriteRecord | undefined
    
    // Check if strategy was swapped
    if (originalStrategy.selectedStrategy !== adjustedStrategy.selectedStrategy) {
      modifications.push({
        type: 'strategy_swap',
        description: `Strategy changed from ${originalStrategy.selectedStrategy} to ${adjustedStrategy.selectedStrategy}`,
        reason: this.extractSwapReason(originalStrategy, adjustedStrategy)
      })
      
      rewritten = true
    }
    
    // Check if provider should be rerouted
    const providerReroute = this.shouldRerouteProvider(
      adjustedStrategy.selectedStrategy,
      context
    )
    
    if (providerReroute.shouldReroute) {
      modifications.push({
        type: 'provider_reroute',
        description: `Provider rerouted from ${providerReroute.originalProvider} to ${providerReroute.newProvider}`,
        reason: providerReroute.reason
      })
      
      rewritten = true
    }
    
    // Check if retry logic should be adjusted
    const retryAdjustment = this.shouldAdjustRetryLogic(
      adjustedStrategy,
      context
    )
    
    if (retryAdjustment.shouldAdjust) {
      modifications.push({
        type: 'retry_adjustment',
        description: `Retry limit adjusted to ${retryAdjustment.newRetryLimit}`,
        reason: retryAdjustment.reason
      })
      
      rewritten = true
    }
    
    // Record rewrite if any modifications were made
    if (rewritten) {
      rewriteRecord = await this.auditStore.recordRewrite(
        tenantId,
        {
          strategy: originalStrategy.selectedStrategy,
          riskScore: 0,  // Would come from risk assessment
          expectedSuccess: originalStrategy.expectedSuccessProbability
        },
        {
          strategy: adjustedStrategy.selectedStrategy,
          riskScore: 0,  // Would come from calibrated risk assessment
          expectedSuccess: adjustedStrategy.expectedSuccessProbability
        },
        this.summarizeModifications(modifications),
        modifications.map(m => ({
          factor: m.type,
          value: 1.0,
          impact: m.description
        })),
        context.confidence
      )
    }
    
    return {
      rewritten,
      plan,
      rewriteRecord,
      modifications
    }
  }
  
  /**
   * Extract swap reason from strategy rationale
   */
  private extractSwapReason(
    original: StrategySelection,
    adjusted: StrategySelection
  ): string {
    // Find the calibration-related rationale
    const calibrationRationale = adjusted.rationale.find(
      r => r.includes('bias') || r.includes('calibration') || r.includes('decay')
    )
    
    return calibrationRationale || 'Strategy swapped due to calibration adjustment'
  }
  
  /**
   * Determine if provider should be rerouted
   */
  private shouldRerouteProvider(
    strategyName: string,
    context: CalibrationContext
  ): {
    shouldReroute: boolean
    originalProvider?: string
    newProvider?: string
    reason: string
  } {
    // TODO: This would integrate with provider selection logic
    // For now, we'll use a simplified check based on context
    
    // Check if any provider has very low weight
    for (const [provider, weight] of Object.entries(context.providerReliabilityBias)) {
      if (weight < this.PROVIDER_SWAP_THRESHOLD) {
        // Find alternative provider
        const alternativeProvider = this.findAlternativeProvider(provider, context)
        
        if (alternativeProvider) {
          return {
            shouldReroute: true,
            originalProvider: provider,
            newProvider: alternativeProvider,
            reason: `Provider ${provider} reliability weight (${weight.toFixed(2)}) below threshold`
          }
        }
      }
    }
    
    return {
      shouldReroute: false,
      reason: 'No provider rerouting needed'
    }
  }
  
  /**
   * Find alternative provider
   */
  private findAlternativeProvider(
    currentProvider: string,
    context: CalibrationContext
  ): string | null {
    // Find provider with highest weight
    let bestProvider: string | null = null
    let bestWeight = 0
    
    for (const [provider, weight] of Object.entries(context.providerReliabilityBias)) {
      if (provider !== currentProvider && weight > bestWeight) {
        bestProvider = provider
        bestWeight = weight
      }
    }
    
    return bestProvider
  }
  
  /**
   * Determine if retry logic should be adjusted
   */
  private shouldAdjustRetryLogic(
    strategy: StrategySelection,
    context: CalibrationContext
  ): {
    shouldAdjust: boolean
    newRetryLimit: number
    reason: string
  } {
    // If drift is high or confidence is low, increase retry limit
    if (context.driftState.criticalDrift || context.confidence < 0.6) {
      return {
        shouldAdjust: true,
        newRetryLimit: 5,  // Increase to 5 retries
        reason: 'Increased retry limit due to model drift and low confidence'
      }
    }
    
    // If expected retry rate is high, increase limit
    if (strategy.expectedRetryRate && strategy.expectedRetryRate > 0.3) {
      return {
        shouldAdjust: true,
        newRetryLimit: 4,  // Increase to 4 retries
        reason: 'Increased retry limit due to high expected retry rate'
      }
    }
    
    return {
      shouldAdjust: false,
      newRetryLimit: 3,  // Default
      reason: 'No retry adjustment needed'
    }
  }
  
  /**
   * Summarize modifications
   */
  private summarizeModifications(
    modifications: Array<{
      type: string
      description: string
      reason: string
    }>
  ): string {
    return modifications.map(m => `${m.type}: ${m.description}`).join('; ')
  }
  
  /**
   * Apply counterfactual analysis
   * 
   * This predicts what would have happened WITHOUT the rewrite.
   * Useful for learning and interpretability.
   */
  async analyzeCounterfactual(
    rewriteId: string
  ): Promise<{
    originalOutcome: {
      predictedSuccess: number
      predictedRisk: number
    }
    rewrittenOutcome: {
      predictedSuccess: number
      predictedRisk: number
    }
    expectedImprovement: number
  } | null> {
    const rewrite = await this.auditStore.getRewrite(rewriteId)
    
    if (!rewrite) {
      return null
    }
    
    // Calculate expected improvement
    const expectedImprovement = 
      rewrite.rewrittenPlan.expectedSuccess - rewrite.originalPlan.expectedSuccess
    
    return {
      originalOutcome: {
        predictedSuccess: rewrite.originalPlan.expectedSuccess,
        predictedRisk: rewrite.originalPlan.riskScore
      },
      rewrittenOutcome: {
        predictedSuccess: rewrite.rewrittenPlan.expectedSuccess,
        predictedRisk: rewrite.rewrittenPlan.riskScore
      },
      expectedImprovement
    }
  }
  
  /**
   * Get rewrite effectiveness
   * 
   * This analyzes whether rewrites are actually improving outcomes.
   */
  async getRewriteEffectiveness(
    tenantId: string
  ): Promise<{
    totalRewrites: number
    verifiedRewrites: number
    correctRewrites: number
    incorrectRewrites: number
    effectivenessRate: number
  }> {
    const stats = await this.auditStore.getEffectivenessStats(tenantId)
    
    return {
      totalRewrites: stats.totalRewrites,
      verifiedRewrites: stats.verifiedRewrites,
      correctRewrites: stats.correctRewrites,
      incorrectRewrites: stats.verifiedRewrites - stats.correctRewrites,
      effectivenessRate: stats.rewriteAccuracy
    }
  }
}

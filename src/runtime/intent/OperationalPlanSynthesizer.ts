import type { AdaptiveExecutionPlan, StrategyDefinition, GoalDefinition } from './types.js'
import type { ExecutionPlan } from '../policy/types.js'
import type { IntentGraph } from './IntentGraph.js'
import type { StrategyGraph } from './StrategyGraph.js'
import type { GoalOutcomeEvaluator } from './GoalOutcomeEvaluator.js'
import type { TenantModel } from '../../models/tenant-model.js'

/**
 * OperationalPlanSynthesizer - Generates adaptive execution plans dynamically
 * 
 * This is the planning synthesis layer.
 * 
 * Instead of static transition chains, the runtime can now:
 * - Synthesize recovery plans
 * - Generate alternate strategies
 * - Substitute providers dynamically
 * - Create fallback execution paths
 * 
 * This is adaptive operational planning.
 */
export class OperationalPlanSynthesizer {
  constructor(
    private readonly intentGraph: IntentGraph,
    private readonly strategyGraph: StrategyGraph,
    private readonly outcomeEvaluator: GoalOutcomeEvaluator
  ) {}

  /**
   * Synthesize an adaptive execution plan for a goal
   * 
   * This generates a complete plan including:
   * - Primary execution strategy
   * - Recovery plans for failures
   * - Provider substitutions
   * - Predicted success probability
   */
  async synthesizePlan(
    tenantId: string,
    goalId: string,
    strategyName: string,
    model: TenantModel
  ): Promise<AdaptiveExecutionPlan> {
    const goal = this.intentGraph.getGoal(goalId)
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`)
    }

    const strategy = this.intentGraph.findStrategyByName(goalId, strategyName)
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found for goal ${goalId}`)
    }

    // Check strategy compatibility with model
    const compatibility = this.strategyGraph.isStrategyCompatible(strategy, model)
    if (!compatibility.compatible) {
      throw new Error(
        `Strategy ${strategyName} incompatible with model. ` +
        `Missing transitions: ${compatibility.missingTransitions.length}, ` +
        `Missing actions: ${compatibility.missingActions.length}`
      )
    }

    // Build primary execution plan
    const primaryPlan = this.buildPrimaryPlan(strategy)

    // Synthesize recovery plans
    const recoveryPlans = await this.synthesizeRecoveryPlans(
      tenantId,
      goalId,
      strategy,
      model
    )

    // Calculate predicted success probability
    const metrics = await this.outcomeEvaluator.evaluateStrategyEffectiveness(
      tenantId,
      goalId,
      strategyName
    )

    return {
      goalId,
      primaryStrategy: strategyName,
      primaryPlan,
      recoveryPlans,
      canReroute: this.canRerouteProviders(strategy),
      canSubstituteProviders: this.hasProviderAlternatives(strategy),
      canModifyTransitions: false, // For now - future enhancement
      predictedSuccessProbability: metrics.successRate,
      predictedExecutionTimeMs: metrics.averageExecutionTimeMs
    }
  }

  /**
   * Build primary execution plan from strategy
   */
  private buildPrimaryPlan(strategy: StrategyDefinition): ExecutionPlan {
    return {
      actions: strategy.requiredProviders.map(rp => ({
        name: rp.action,
        provider: rp.provider
      })),
      transition: strategy.requiredTransitions[0] // Use first transition
    }
  }

  /**
   * Synthesize recovery plans for failure scenarios
   */
  private async synthesizeRecoveryPlans(
    tenantId: string,
    goalId: string,
    primaryStrategy: StrategyDefinition,
    model: TenantModel
  ): Promise<AdaptiveExecutionPlan['recoveryPlans']> {
    const recoveryPlans: AdaptiveExecutionPlan['recoveryPlans'] = []

    // Recovery for provider failures
    if (this.hasProviderAlternatives(primaryStrategy)) {
      const altPlan = this.buildProviderFailoverPlan(primaryStrategy)
      const altMetrics = await this.estimatePlanEffectiveness(
        tenantId,
        goalId,
        altPlan
      )

      recoveryPlans.push({
        trigger: 'provider_failure',
        strategy: `${primaryStrategy.strategyName}_provider_failover`,
        plan: altPlan,
        confidence: altMetrics.confidence
      })
    }

    // Recovery for fallback strategy
    if (primaryStrategy.fallbackStrategy) {
      const fallbackStrategy = this.intentGraph.findStrategyByName(
        goalId,
        primaryStrategy.fallbackStrategy
      )

      if (fallbackStrategy) {
        const compatibility = this.strategyGraph.isStrategyCompatible(fallbackStrategy, model)
        
        if (compatibility.compatible) {
          const fallbackPlan = this.buildPrimaryPlan(fallbackStrategy)
          const fallbackMetrics = await this.outcomeEvaluator.evaluateStrategyEffectiveness(
            tenantId,
            goalId,
            fallbackStrategy.strategyName
          )

          recoveryPlans.push({
            trigger: 'convergence_failure',
            strategy: fallbackStrategy.strategyName,
            plan: fallbackPlan,
            confidence: fallbackMetrics.successRate
          })
        }
      }
    }

    // Recovery for timeout (manual intervention)
    if (primaryStrategy.recoveryActions && primaryStrategy.recoveryActions.length > 0) {
      recoveryPlans.push({
        trigger: 'timeout',
        strategy: `${primaryStrategy.strategyName}_manual_recovery`,
        plan: {
          actions: primaryStrategy.recoveryActions.map(action => ({
            name: action,
            provider: 'manual'
          })),
          transition: primaryStrategy.requiredTransitions[0]
        },
        confidence: 0.6 // Lower confidence for manual recovery
      })
    }

    return recoveryPlans
  }

  /**
   * Build provider failover plan
   */
  private buildProviderFailoverPlan(strategy: StrategyDefinition): ExecutionPlan {
    return {
      actions: strategy.requiredProviders.map(rp => ({
        name: rp.action,
        provider: rp.alternateProviders?.[0] || rp.provider // Use first alternate or fallback to primary
      })),
      transition: strategy.requiredTransitions[0]
    }
  }

  /**
   * Estimate plan effectiveness
   */
  private async estimatePlanEffectiveness(
    tenantId: string,
    goalId: string,
    plan: ExecutionPlan
  ): Promise<{
    confidence: number
  }> {
    // For alternate provider plans, use a slightly lower confidence
    // since alternates are typically less proven
    return {
      confidence: 0.7
    }
  }

  /**
   * Check if strategy can reroute providers
   */
  private canRerouteProviders(strategy: StrategyDefinition): boolean {
    return strategy.requiredProviders.some(rp => 
      rp.alternateProviders && rp.alternateProviders.length > 0
    )
  }

  /**
   * Check if strategy has provider alternatives
   */
  private hasProviderAlternatives(strategy: StrategyDefinition): boolean {
    return strategy.requiredProviders.some(rp => 
      rp.alternateProviders && rp.alternateProviders.length > 0
    )
  }

  /**
   * Synthesize alternate plans for comparison
   * 
   * Returns multiple possible execution plans ranked by predicted effectiveness.
   */
  async synthesizeAlternatePlans(
    tenantId: string,
    goalId: string,
    model: TenantModel,
    count: number = 3
  ): Promise<AdaptiveExecutionPlan[]> {
    const strategies = this.strategyGraph.findCompatibleStrategies(goalId, model)
    
    if (strategies.length === 0) {
      throw new Error(`No compatible strategies found for goal ${goalId}`)
    }

    // Synthesize plans for all strategies
    const plans = await Promise.all(
      strategies.map(strategy => 
        this.synthesizePlan(tenantId, goalId, strategy.strategyName, model)
      )
    )

    // Sort by predicted success probability
    plans.sort((a, b) => b.predictedSuccessProbability - a.predictedSuccessProbability)

    // Return top N plans
    return plans.slice(0, count)
  }

  /**
   * Suggest plan improvements
   * 
   * Analyzes a plan and suggests improvements based on historical data.
   */
  async suggestPlanImprovements(
    tenantId: string,
    goalId: string,
    plan: AdaptiveExecutionPlan
  ): Promise<Array<{
    type: 'provider_swap' | 'add_recovery' | 'add_monitoring'
    description: string
    expectedImprovement: number
  }>> {
    const suggestions: Array<{
      type: 'provider_swap' | 'add_recovery' | 'add_monitoring'
      description: string
      expectedImprovement: number
    }> = []

    // Suggest provider swaps if better alternatives exist
    const strategy = this.intentGraph.findStrategyByName(goalId, plan.primaryStrategy)
    if (strategy) {
      for (const reqProvider of strategy.requiredProviders) {
        if (reqProvider.alternateProviders && reqProvider.alternateProviders.length > 0) {
          suggestions.push({
            type: 'provider_swap',
            description: `Consider alternate provider for ${reqProvider.action}`,
            expectedImprovement: 0.05
          })
        }
      }
    }

    // Suggest adding recovery plans if missing
    if (plan.recoveryPlans.length === 0) {
      suggestions.push({
        type: 'add_recovery',
        description: 'Add recovery plans for failure scenarios',
        expectedImprovement: 0.15
      })
    }

    // Suggest monitoring for low-confidence plans
    if (plan.predictedSuccessProbability < 0.7) {
      suggestions.push({
        type: 'add_monitoring',
        description: 'Add enhanced monitoring for low-confidence execution',
        expectedImprovement: 0.1
      })
    }

    return suggestions
  }
}

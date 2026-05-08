import type { PolicyEvaluationContext, PolicyDecision } from '../policy/types.js'
import type { IntentAwareGovernanceDecision, GoalDefinition } from './types.js'
import type { IntentGraph } from './IntentGraph.js'
import type { GoalOutcomeEvaluator } from './GoalOutcomeEvaluator.js'
import { RuntimePolicyEngine } from '../policy/RuntimePolicyEngine.js'

/**
 * IntentAwareGovernanceEngine - Enhanced governance using operational goals
 * 
 * This is the evolution from:
 *   "Is this safe?"
 * to:
 *   "Does this improve likelihood of goal completion?"
 * 
 * Governance decisions now consider:
 * - Operational goals
 * - Goal success criteria
 * - Historical strategy effectiveness
 * - Goal completion probability
 * 
 * This is goal-oriented governance.
 */
export class IntentAwareGovernanceEngine {
  constructor(
    private readonly policyEngine: RuntimePolicyEngine,
    private readonly intentGraph: IntentGraph,
    private readonly outcomeEvaluator: GoalOutcomeEvaluator
  ) {}

  /**
   * Evaluate governance with goal context
   * 
   * This enhances standard policy evaluation with:
   * - Goal completion likelihood
   * - Strategy effectiveness data
   * - Alternative suggestions
   */
  async evaluateWithGoalContext(
    context: PolicyEvaluationContext,
    goalId?: string
  ): Promise<IntentAwareGovernanceDecision> {
    // Standard policy evaluation
    const policyDecision = await this.policyEngine.evaluate(context)

    // If no goal context, return standard decision
    if (!goalId) {
      return {
        policyDecision,
        goalImpact: {
          likelyToAchieveGoal: true,
          goalCompletionProbability: 0.5,
          reasoning: ['No goal context provided - using standard policy evaluation']
        }
      }
    }

    // Get goal
    const goal = this.intentGraph.getGoal(goalId)
    if (!goal) {
      return {
        policyDecision,
        goalImpact: {
          likelyToAchieveGoal: true,
          goalCompletionProbability: 0.5,
          reasoning: [`Goal ${goalId} not found`]
        }
      }
    }

    // Analyze goal completion likelihood
    const goalImpact = await this.analyzeGoalImpact(
      context,
      goal,
      policyDecision
    )

    // Generate alternatives if decision blocks execution
    let suggestedAlternatives
    if (!policyDecision.allowed) {
      suggestedAlternatives = await this.suggestAlternatives(
        context,
        goal,
        policyDecision
      )
    }

    return {
      policyDecision,
      goalImpact,
      suggestedAlternatives
    }
  }

  /**
   * Analyze how a policy decision impacts goal completion
   */
  private async analyzeGoalImpact(
    context: PolicyEvaluationContext,
    goal: GoalDefinition,
    policyDecision: PolicyDecision
  ): Promise<{
    likelyToAchieveGoal: boolean
    goalCompletionProbability: number
    reasoning: string[]
  }> {
    const reasoning: string[] = []

    // If execution is blocked, goal cannot be achieved
    if (!policyDecision.allowed) {
      reasoning.push('❌ Execution blocked by policy - goal cannot be achieved')
      return {
        likelyToAchieveGoal: false,
        goalCompletionProbability: 0,
        reasoning
      }
    }

    // Get historical completion rate for this goal
    const completionRate = await this.outcomeEvaluator.evaluateGoalCompletionRate(
      context.tenantId,
      goal.id
    )

    reasoning.push(`📊 Historical goal completion rate: ${(completionRate.completionRate * 100).toFixed(1)}%`)

    // Analyze policy modifications
    if (policyDecision.modifiedExecutionPlan) {
      reasoning.push('🔧 Policy modified execution plan - may impact success probability')
      
      // If plan was modified adaptively, this may improve probability
      if (policyDecision.enforcementActions?.some(a => a.type === 'provider_reroute')) {
        reasoning.push('✅ Provider rerouted to more stable option')
        
        // Boost probability slightly for adaptive improvements
        return {
          likelyToAchieveGoal: true,
          goalCompletionProbability: Math.min(1, completionRate.completionRate * 1.1),
          reasoning
        }
      }
    }

    // Check warnings
    if (policyDecision.warnings && policyDecision.warnings.length > 0) {
      const highSeverityWarnings = policyDecision.warnings.filter(w => w.severity === 'high')
      if (highSeverityWarnings.length > 0) {
        reasoning.push(`⚠️  ${highSeverityWarnings.length} high-severity warnings - may reduce success probability`)
        
        return {
          likelyToAchieveGoal: completionRate.completionRate > 0.5,
          goalCompletionProbability: completionRate.completionRate * 0.9,
          reasoning
        }
      }
    }

    // Standard case - use historical completion rate
    return {
      likelyToAchieveGoal: completionRate.completionRate > 0.5,
      goalCompletionProbability: completionRate.completionRate,
      reasoning
    }
  }

  /**
   * Suggest alternatives when execution is blocked
   */
  private async suggestAlternatives(
    context: PolicyEvaluationContext,
    goal: GoalDefinition,
    policyDecision: PolicyDecision
  ): Promise<Array<{
    modification: string
    expectedImpact: string
    improvedProbability: number
  }>> {
    const alternatives: Array<{
      modification: string
      expectedImpact: string
      improvedProbability: number
    }> = []

    // If blocked by provider stability, suggest alternate providers
    if (policyDecision.warnings?.some(w => w.rule === 'provider_stability')) {
      alternatives.push({
        modification: 'Reroute to alternate provider',
        expectedImpact: 'Use more stable provider for critical actions',
        improvedProbability: 0.8
      })
    }

    // If blocked by high entropy, suggest path simplification
    if (policyDecision.warnings?.some(w => w.rule === 'entropy_limit')) {
      alternatives.push({
        modification: 'Simplify execution path',
        expectedImpact: 'Reduce operational complexity to meet entropy limits',
        improvedProbability: 0.7
      })
    }

    // If blocked by low convergence, suggest canonical path
    if (policyDecision.warnings?.some(w => w.rule === 'minimum_convergence')) {
      alternatives.push({
        modification: 'Use canonical execution path',
        expectedImpact: 'Follow proven operational pattern',
        improvedProbability: 0.85
      })
    }

    return alternatives
  }

  /**
   * Recommend best strategy for goal based on governance constraints
   */
  async recommendStrategyForGoal(
    tenantId: string,
    goalId: string,
    context: PolicyEvaluationContext
  ): Promise<{
    recommendedStrategy: string
    reasoning: string[]
    expectedSuccessProbability: number
  }> {
    const goal = this.intentGraph.getGoal(goalId)
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`)
    }

    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    if (strategies.length === 0) {
      throw new Error(`No strategies available for goal ${goalId}`)
    }

    // Score each strategy considering governance
    const scoredStrategies = await Promise.all(
      strategies.map(async (strategy) => {
        const metrics = await this.outcomeEvaluator.evaluateStrategyEffectiveness(
          tenantId,
          goalId,
          strategy.strategyName
        )

        return {
          strategy: strategy.strategyName,
          score: metrics.effectivenessScore,
          successRate: metrics.successRate,
          confidence: metrics.confidence
        }
      })
    )

    // Sort by score
    scoredStrategies.sort((a, b) => b.score - a.score)

    const best = scoredStrategies[0]

    return {
      recommendedStrategy: best.strategy,
      reasoning: [
        `Best strategy based on historical effectiveness`,
        `Success rate: ${(best.successRate * 100).toFixed(1)}%`,
        `Confidence: ${(best.confidence * 100).toFixed(1)}%`
      ],
      expectedSuccessProbability: best.successRate
    }
  }

  /**
   * Get the underlying policy engine
   */
  getPolicyEngine(): RuntimePolicyEngine {
    return this.policyEngine
  }
}

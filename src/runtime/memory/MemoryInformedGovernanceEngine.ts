import type { 
  PolicyEvaluationContext, 
  PolicyDecision,
  EnforcementAction 
} from '../policy/types.js'
import { RuntimeMemoryStore } from './RuntimeMemoryStore.js'
import { StrategyEffectivenessAnalyzer } from './StrategyEffectivenessAnalyzer.js'
import { RuntimePolicyEngine } from '../policy/RuntimePolicyEngine.js'

/**
 * MemoryInformedGovernanceEngine - Experience-informed governance
 * 
 * This is the architectural evolution from:
 *   policy-driven governance
 * to:
 *   experience-informed adaptive governance
 * 
 * The runtime now answers:
 * "When provider instability occurs, which adaptive strategy 
 *  historically produces the best operational outcome?"
 * 
 * This is massive because:
 * - Governance becomes experiential
 * - Runtime becomes history-informed
 * - Adaptation becomes learned rather than static
 */
export class MemoryInformedGovernanceEngine {
  private readonly analyzer: StrategyEffectivenessAnalyzer

  constructor(
    private readonly policyEngine: RuntimePolicyEngine,
    private readonly memoryStore: RuntimeMemoryStore
  ) {
    this.analyzer = new StrategyEffectivenessAnalyzer(memoryStore)
  }

  /**
   * Evaluate governance with learned strategies
   * 
   * This enhances standard policy evaluation with:
   * - Historical effectiveness data
   * - Learned strategy preferences
   * - Experience-based confidence
   * 
   * The decision includes both:
   * - Policy-driven actions
   * - Memory-informed recommendations
   */
  async evaluateWithMemory(
    context: PolicyEvaluationContext
  ): Promise<PolicyDecision & {
    memoryInformed?: {
      recommendedStrategy?: string
      effectiveness?: number
      confidence?: number
      historicalSuccessRate?: number
      rationale: string[]
    }
  }> {
    // First, get standard policy decision
    const policyDecision = await this.policyEngine.evaluate(context)

    // Determine trigger type from context
    const triggerType = this.detectTriggerType(context)
    
    if (!triggerType) {
      // No relevant trigger, return standard decision
      return policyDecision
    }

    // Get learned strategy recommendation
    const recommendation = await this.analyzer.recommendStrategy(
      context.tenantId,
      triggerType
    )

    if (!recommendation) {
      // No historical data yet, return standard decision
      return {
        ...policyDecision,
        memoryInformed: {
          rationale: ['No historical data available for this trigger type']
        }
      }
    }

    // Check if learned strategy has high confidence and effectiveness
    if (recommendation.confidence > 0.7 && recommendation.effectivenessScore > 0.5) {
      // Enhance rationale with learned insights
      const enhancedRationale = [
        ...policyDecision.rationale,
        `[LEARNED] Historically, ${recommendation.strategy} has ${(recommendation.effectivenessScore * 100).toFixed(0)}% effectiveness`,
        `[LEARNED] Applied ${recommendation.historicalData.timesApplied} times with ${(recommendation.historicalData.successRate * 100).toFixed(0)}% success rate`,
        `[LEARNED] Average retry reduction: ${(recommendation.historicalData.avgRetryReduction * 100).toFixed(0)}%`
      ]

      // If the learned strategy differs from policy decision, add a recommendation
      const suggestedAction = this.extractStrategyFromRecommendation(recommendation.strategy)
      const policyAction = this.extractStrategyFromDecision(policyDecision)

      if (suggestedAction && suggestedAction !== policyAction) {
        enhancedRationale.push(
          `[LEARNED] Consider ${suggestedAction} based on historical success`
        )
      }

      return {
        ...policyDecision,
        rationale: enhancedRationale,
        memoryInformed: {
          recommendedStrategy: recommendation.strategy,
          effectiveness: recommendation.effectivenessScore,
          confidence: recommendation.confidence,
          historicalSuccessRate: recommendation.historicalData.successRate,
          rationale: [
            `Learned from ${recommendation.historicalData.timesApplied} historical executions`,
            `Effectiveness score: ${(recommendation.effectivenessScore * 100).toFixed(0)}%`,
            `Confidence level: ${(recommendation.confidence * 100).toFixed(0)}%`
          ]
        }
      }
    } else if (recommendation.confidence < 0.5) {
      // Low confidence - still learning
      return {
        ...policyDecision,
        memoryInformed: {
          rationale: [
            `Still learning optimal strategy for ${triggerType}`,
            `Only ${recommendation.historicalData.timesApplied} historical executions available`,
            `Need more data to reach high confidence`
          ]
        }
      }
    } else {
      // Moderate data - include as context
      return {
        ...policyDecision,
        memoryInformed: {
          recommendedStrategy: recommendation.strategy,
          effectiveness: recommendation.effectivenessScore,
          confidence: recommendation.confidence,
          historicalSuccessRate: recommendation.historicalData.successRate,
          rationale: [
            `Moderate confidence (${(recommendation.confidence * 100).toFixed(0)}%) from ${recommendation.historicalData.timesApplied} executions`
          ]
        }
      }
    }
  }

  /**
   * Detect trigger type from evaluation context
   */
  private detectTriggerType(
    context: PolicyEvaluationContext
  ): 'provider_instability' | 'high_entropy' | 'low_convergence' | 'canonical_drift' | null {
    // Check provider stability
    if (context.providerStability) {
      for (const [, stability] of context.providerStability) {
        if (stability < 0.5) {
          return 'provider_instability'
        }
      }
    }

    // Check entropy
    if (context.entropy !== undefined && context.entropy > 0.7) {
      return 'high_entropy'
    }

    // Check convergence
    if (context.convergenceScore !== undefined && context.convergenceScore < 0.5) {
      return 'low_convergence'
    }

    // Check canonical confidence
    if (context.canonicalConfidence !== undefined && context.canonicalConfidence < 0.6) {
      return 'canonical_drift'
    }

    return null
  }

  /**
   * Extract strategy action from recommendation string
   */
  private extractStrategyFromRecommendation(strategy: string): string | null {
    // Parse strategy like "reroute:provider_a->provider_b"
    const match = strategy.match(/^(\w+):/)
    return match ? match[1] : null
  }

  /**
   * Extract strategy action from policy decision
   */
  private extractStrategyFromDecision(decision: PolicyDecision): string | null {
    if (!decision.enforcementActions || decision.enforcementActions.length === 0) {
      return null
    }

    const action = decision.enforcementActions[0]
    
    // Map enforcement action types to strategy names
    switch (action.type) {
      case 'provider_reroute':
        return 'reroute'
      case 'execution_blocked':
        return 'block'
      case 'entropy_mitigation':
        return 'mitigate_entropy'
      case 'canonical_protection':
        return 'protect_canonical'
      default:
        return null
    }
  }

  /**
   * Get memory store for direct access
   */
  getMemoryStore(): RuntimeMemoryStore {
    return this.memoryStore
  }

  /**
   * Get analyzer for direct access
   */
  getAnalyzer(): StrategyEffectivenessAnalyzer {
    return this.analyzer
  }

  /**
   * Get underlying policy engine
   */
  getPolicyEngine(): RuntimePolicyEngine {
    return this.policyEngine
  }
}

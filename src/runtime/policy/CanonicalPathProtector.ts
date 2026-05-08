import type { ExecutionPlan, EnforcementAction } from './types.js'

/**
 * CanonicalPathProtector - Protect stable canonical execution paths
 * 
 * Biases execution toward stable canonical paths when:
 * - Entropy is high
 * - Canonical confidence is low
 * - Operational behavior is unstable
 * 
 * This is the first form of operational self-healing.
 */
export class CanonicalPathProtector {
  /**
   * Protect canonical paths
   * 
   * Evaluates if canonical protection should engage based on:
   * - Canonical confidence
   * - Entropy level
   * - Transition stability
   * 
   * @param executionPlan - Current execution plan
   * @param canonicalConfidence - Canonical confidence score (0-1)
   * @param entropy - Operational entropy (0-1)
   * @param minConfidence - Minimum canonical confidence threshold
   * @returns Warnings and enforcement actions
   */
  protect(
    executionPlan: ExecutionPlan,
    canonicalConfidence: number,
    entropy: number,
    minConfidence: number
  ): {
    shouldProtect: boolean
    actions: EnforcementAction[]
    warnings: string[]
  } {
    const warnings: string[] = []
    const actions: EnforcementAction[] = []

    // Check if protection is needed
    const lowConfidence = canonicalConfidence < minConfidence
    const highEntropy = entropy > 0.7

    if (!lowConfidence && !highEntropy) {
      return { shouldProtect: false, actions, warnings }
    }

    // Canonical protection engaged
    if (lowConfidence) {
      warnings.push(
        `Canonical confidence ${canonicalConfidence.toFixed(2)} below threshold ${minConfidence}. ` +
        `Canonical path protection engaged.`
      )
    }

    if (highEntropy) {
      warnings.push(
        `High operational entropy ${entropy.toFixed(2)}. ` +
        `Biasing toward stable canonical paths.`
      )
    }

    actions.push({
      type: 'canonical_protection',
      reason: `Canonical protection engaged: confidence=${canonicalConfidence.toFixed(2)}, entropy=${entropy.toFixed(2)}`,
      metadata: {
        canonicalConfidence,
        entropy,
        minConfidence
      }
    })

    return {
      shouldProtect: true,
      actions,
      warnings
    }
  }

  /**
   * Check if a transition is canonical
   * 
   * A transition is considered canonical if it appears frequently
   * in execution history and has high success rate.
   * 
   * In a full implementation, this would query the CanonicalInferenceEngine
   * to check if the transition is in the canonical set.
   */
  isCanonicalTransition(
    transition: { from: string; to: string; event: string },
    canonicalConfidence: number
  ): boolean {
    // For now, assume transitions are canonical if overall confidence is high
    // In production, this would check against canonical transition set
    return canonicalConfidence >= 0.9
  }

  /**
   * Assess stability of execution path
   * 
   * Returns a score indicating how stable/canonical the planned path is.
   */
  assessPathStability(
    executionPlan: ExecutionPlan,
    canonicalConfidence: number,
    entropy: number
  ): {
    score: number  // 0-1, higher is more stable
    reasoning: string
  } {
    // Combine canonical confidence and inverted entropy
    const stabilityScore = (canonicalConfidence * 0.7 + (1 - entropy) * 0.3)

    let reasoning = ''
    if (stabilityScore >= 0.9) {
      reasoning = 'High stability - execution follows well-established canonical path'
    } else if (stabilityScore >= 0.7) {
      reasoning = 'Moderate stability - execution follows known patterns'
    } else if (stabilityScore >= 0.5) {
      reasoning = 'Low stability - execution path shows divergence from canonical behavior'
    } else {
      reasoning = 'Very low stability - execution path is highly unstable, consider blocking'
    }

    return {
      score: stabilityScore,
      reasoning
    }
  }
}

/**
 * Types for the Runtime Recommendation & Adaptive Optimization Layer
 * 
 * This module defines data structures for:
 * - Runtime recommendations
 * - Provider reliability metrics
 * - Canonical convergence analysis
 * - Model patches and suggestions
 */

/**
 * RecommendationType - Categories of runtime recommendations
 */
export type RecommendationType =
  | 'remove_dead_transition'
  | 'formalize_shadow_transition'
  | 'merge_states'
  | 'provider_instability'
  | 'reduce_entropy'
  | 'canonicalize_path'
  | 'split_overloaded_state'
  | 'retry_policy_adjustment'

/**
 * RecommendationSeverity - Priority level for recommendations
 */
export type RecommendationSeverity = 'low' | 'medium' | 'high'

/**
 * RecommendationEvidence - Supporting data for a recommendation
 */
export type RecommendationEvidence = {
  type: string
  description: string
  data: Record<string, unknown>
}

/**
 * SuggestedModelChange - Machine-readable model modification
 */
export type SuggestedModelChange = {
  operation: 'add_transition' | 'remove_transition' | 'merge_states' | 'update_provider'
  target?: {
    from?: string
    to?: string
    event?: string
    transitionId?: string
    states?: string[]
    action?: string
    provider?: string
  }
  reason: string
}

/**
 * RuntimeRecommendation - A single actionable recommendation
 */
export type RuntimeRecommendation = {
  id: string
  type: RecommendationType
  severity: RecommendationSeverity
  confidence: number

  title: string
  description: string

  evidence: RecommendationEvidence[]
  suggestedAction?: SuggestedModelChange

  estimatedImpact?: {
    reliability?: number
    complexityReduction?: number
    entropyReduction?: number
  }

  generatedAt: string
}

/**
 * ProviderReliability - Provider stability metrics
 */
export type ProviderReliability = {
  provider: string
  action?: string
  failureRate: number
  retryRate: number
  dlqRate: number
  stabilityScore: number
  executionCount: number
  recommendation?: 'stable' | 'monitor' | 'consider_alternate_provider' | 'unstable'
}

/**
 * CanonicalConvergence - Operational convergence metrics
 */
export type CanonicalConvergence = {
  tenantId: string
  convergenceScore: number
  dominantPathCoverage: number
  entropyTrend: number
  canonicalizationVelocity: number
  generatedAt: string
}

/**
 * EntropyReduction - Opportunity for operational simplification
 */
export type EntropyReductionOpportunity = {
  type: 'unused_transition' | 'dead_state' | 'low_confidence_path' | 'state_explosion'
  severity: RecommendationSeverity
  description: string
  affectedElements: string[]
  potentialEntropyReduction: number
}

/**
 * RecommendationContext - Input data for recommendation generation
 */
export type RecommendationContext = {
  tenantId: string
  executionCount: number
  timeWindowDays: number
}

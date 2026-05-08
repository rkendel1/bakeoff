import type { ExecutionContext } from '../context/execution-context.js'
import type { TenantModel } from '../../models/tenant-model.js'

/**
 * PolicyRule - Abstract policy definition
 * 
 * Defines governance rules that the runtime evaluates at execution time.
 * Rules can be:
 * - Soft (warn but allow)
 * - Hard (block execution)
 * - Adaptive (modify execution plan)
 */
export type PolicyRule = 
  | ProviderStabilityRule
  | EntropyLimitRule
  | MinimumConvergenceRule
  | CanonicalPathProtectionRule

/**
 * Provider stability rule - Block or reroute unstable providers
 */
export type ProviderStabilityRule = {
  type: 'provider_stability'
  threshold: number  // Minimum stability score (0-1)
  action: 'block_provider' | 'warn' | 'reroute'
  alternateProvider?: string  // For reroute action
}

/**
 * Entropy limit rule - Restrict high-entropy execution
 */
export type EntropyLimitRule = {
  type: 'entropy_limit'
  maxEntropy: number  // Maximum allowed entropy (0-1)
  action: 'block' | 'warn' | 'restrict_transition_branching'
}

/**
 * Minimum convergence rule - Ensure minimum convergence
 */
export type MinimumConvergenceRule = {
  type: 'minimum_convergence'
  threshold: number  // Minimum convergence score (0-1)
  action: 'warn' | 'block'
}

/**
 * Canonical path protection rule - Prefer stable canonical paths
 */
export type CanonicalPathProtectionRule = {
  type: 'canonical_path_protection'
  minConfidence: number  // Minimum canonical confidence (0-1)
  action: 'prefer_canonical_transition' | 'warn'
}

/**
 * PolicyWarning - Warning generated during policy evaluation
 */
export type PolicyWarning = {
  rule: string
  severity: 'low' | 'medium' | 'high'
  message: string
  metadata?: Record<string, unknown>
}

/**
 * EnforcementAction - Action taken by policy engine
 */
export type EnforcementAction = {
  type: 'provider_reroute' | 'execution_blocked' | 'entropy_mitigation' | 'canonical_protection'
  target?: string
  reason: string
  metadata?: Record<string, unknown>
}

/**
 * ExecutionPlan - Planned actions with providers
 */
export type ExecutionPlan = {
  actions: Array<{
    name: string
    provider: string
  }>
  transition?: {
    from: string
    to: string
    event: string
  }
}

/**
 * PolicyDecision - Result of policy evaluation
 */
export type PolicyDecision = {
  allowed: boolean
  modifiedExecutionPlan?: ExecutionPlan
  warnings?: PolicyWarning[]
  enforcementActions?: EnforcementAction[]
  rationale: string[]
}

/**
 * PolicyEvaluationContext - Context for policy evaluation
 */
export type PolicyEvaluationContext = {
  tenantId: string
  entityId: string
  executionContext: ExecutionContext
  model: TenantModel
  executionPlan: ExecutionPlan
  providerStability?: Map<string, number>  // provider -> stability score
  entropy?: number
  convergenceScore?: number
  canonicalConfidence?: number
}

/**
 * GovernanceDecision - Audit record of governance action
 */
export type GovernanceDecision = {
  id: string
  tenantId: string
  entityId: string
  timestamp: Date
  
  decision: PolicyDecision
  context: PolicyEvaluationContext
  
  rulesEvaluated: string[]
  rulesFired: string[]
}

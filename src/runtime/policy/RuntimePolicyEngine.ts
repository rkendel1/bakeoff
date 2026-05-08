import type {
  PolicyRule,
  PolicyDecision,
  PolicyEvaluationContext,
  PolicyWarning,
  EnforcementAction,
  ProviderStabilityRule,
  EntropyLimitRule,
  MinimumConvergenceRule,
  CanonicalPathProtectionRule
} from './types.js'
import { AdaptiveProviderRouter } from './AdaptiveProviderRouter.js'
import { CanonicalPathProtector } from './CanonicalPathProtector.js'
import { PolicyStore } from './PolicyStore.js'

/**
 * RuntimePolicyEngine - Central orchestration for runtime governance
 * 
 * Evaluates:
 * - Execution context
 * - Intelligence metrics
 * - Provider stability
 * - Topology drift
 * - Retry history
 * - Tenant policy rules
 * 
 * Returns:
 * - Policy decisions (allowed/blocked)
 * - Modified execution plans (adaptive governance)
 * - Warnings and enforcement actions
 * - Rationale for decisions
 * 
 * This is where intelligence influences runtime decisions in real-time.
 */
export class RuntimePolicyEngine {
  private readonly providerRouter: AdaptiveProviderRouter
  private readonly pathProtector: CanonicalPathProtector
  private readonly policyStore: PolicyStore

  constructor(policyStore?: PolicyStore) {
    this.providerRouter = new AdaptiveProviderRouter()
    this.pathProtector = new CanonicalPathProtector()
    this.policyStore = policyStore || new PolicyStore()
  }

  /**
   * Evaluate policies against execution context
   * 
   * This is the main entry point for governance.
   * Called between PLAN and EXECUTE stages.
   * 
   * @param context - Full execution context with metrics
   * @returns Policy decision with enforcement actions
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyDecision> {
    const warnings: PolicyWarning[] = []
    const enforcementActions: EnforcementAction[] = []
    const rationale: string[] = []

    let allowed = true
    let modifiedPlan = context.executionPlan

    // Get tenant policies
    const rules = await this.policyStore.getRules(context.tenantId)
    const rulesEvaluated: string[] = []

    // Evaluate each rule
    for (const rule of rules) {
      rulesEvaluated.push(rule.type)

      switch (rule.type) {
        case 'provider_stability': {
          const result = this.evaluateProviderStability(
            rule,
            context,
            modifiedPlan
          )
          if (result.warnings) warnings.push(...result.warnings)
          if (result.actions) enforcementActions.push(...result.actions)
          if (result.rationale) rationale.push(...result.rationale)
          if (result.modifiedPlan) modifiedPlan = result.modifiedPlan
          if (!result.allowed) allowed = false
          break
        }

        case 'entropy_limit': {
          const result = this.evaluateEntropyLimit(rule, context)
          if (result.warnings) warnings.push(...result.warnings)
          if (result.actions) enforcementActions.push(...result.actions)
          if (result.rationale) rationale.push(...result.rationale)
          if (!result.allowed) allowed = false
          break
        }

        case 'minimum_convergence': {
          const result = this.evaluateMinimumConvergence(rule, context)
          if (result.warnings) warnings.push(...result.warnings)
          if (result.actions) enforcementActions.push(...result.actions)
          if (result.rationale) rationale.push(...result.rationale)
          if (!result.allowed) allowed = false
          break
        }

        case 'canonical_path_protection': {
          const result = this.evaluateCanonicalPathProtection(
            rule,
            context,
            modifiedPlan
          )
          if (result.warnings) warnings.push(...result.warnings)
          if (result.actions) enforcementActions.push(...result.actions)
          if (result.rationale) rationale.push(...result.rationale)
          break
        }
      }
    }

    // Build final decision
    const decision: PolicyDecision = {
      allowed,
      modifiedExecutionPlan: modifiedPlan !== context.executionPlan ? modifiedPlan : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      enforcementActions: enforcementActions.length > 0 ? enforcementActions : undefined,
      rationale
    }

    return decision
  }

  /**
   * Evaluate provider stability rule
   */
  private evaluateProviderStability(
    rule: ProviderStabilityRule,
    context: PolicyEvaluationContext,
    currentPlan: typeof context.executionPlan
  ): {
    allowed: boolean
    warnings?: PolicyWarning[]
    actions?: EnforcementAction[]
    rationale?: string[]
    modifiedPlan?: typeof context.executionPlan
  } {
    const warnings: PolicyWarning[] = []
    const rationale: string[] = []
    let actions: EnforcementAction[] | undefined
    let allowed = true
    let modifiedPlan = currentPlan

    if (!context.providerStability) {
      return { allowed, rationale: ['Provider stability data not available'] }
    }

    // Check each action's provider stability
    for (const action of currentPlan.actions) {
      const stability = context.providerStability.get(action.provider) ?? 1.0

      if (stability < rule.threshold) {
        rationale.push(
          `Provider ${action.provider} stability score ${stability.toFixed(2)} below threshold ${rule.threshold}`
        )

        if (rule.action === 'block_provider') {
          allowed = false
          warnings.push({
            rule: 'provider_stability',
            severity: 'high',
            message: `Provider ${action.provider} blocked due to low stability`,
            metadata: { provider: action.provider, stability, threshold: rule.threshold }
          })
        } else if (rule.action === 'reroute') {
          // Attempt to reroute
          const rerouteResult = this.providerRouter.reroute(
            modifiedPlan,
            context.model,
            context.providerStability,
            rule.threshold
          )
          modifiedPlan = rerouteResult.modifiedPlan
          actions = rerouteResult.actions

          if (actions.length > 0) {
            rationale.push(`Rerouted to alternate provider(s)`)
          }
        } else if (rule.action === 'warn') {
          warnings.push({
            rule: 'provider_stability',
            severity: 'medium',
            message: `Provider ${action.provider} has low stability but execution allowed`,
            metadata: { provider: action.provider, stability, threshold: rule.threshold }
          })
        }
      }
    }

    return {
      allowed,
      warnings: warnings.length > 0 ? warnings : undefined,
      actions,
      rationale: rationale.length > 0 ? rationale : undefined,
      modifiedPlan: modifiedPlan !== currentPlan ? modifiedPlan : undefined
    }
  }

  /**
   * Evaluate entropy limit rule
   */
  private evaluateEntropyLimit(
    rule: EntropyLimitRule,
    context: PolicyEvaluationContext
  ): {
    allowed: boolean
    warnings?: PolicyWarning[]
    actions?: EnforcementAction[]
    rationale?: string[]
  } {
    const warnings: PolicyWarning[] = []
    const actions: EnforcementAction[] = []
    const rationale: string[] = []
    let allowed = true

    const entropy = context.entropy ?? 0

    if (entropy > rule.maxEntropy) {
      rationale.push(
        `Operational entropy ${entropy.toFixed(2)} exceeds maximum ${rule.maxEntropy}`
      )

      if (rule.action === 'block') {
        allowed = false
        warnings.push({
          rule: 'entropy_limit',
          severity: 'high',
          message: 'Execution blocked due to high entropy',
          metadata: { entropy, maxEntropy: rule.maxEntropy }
        })
      } else if (rule.action === 'restrict_transition_branching') {
        actions.push({
          type: 'entropy_mitigation',
          reason: `High entropy ${entropy.toFixed(2)} detected, restricting branching`,
          metadata: { entropy, maxEntropy: rule.maxEntropy }
        })
        rationale.push('Entropy mitigation applied')
      } else if (rule.action === 'warn') {
        warnings.push({
          rule: 'entropy_limit',
          severity: 'medium',
          message: 'High entropy detected but execution allowed',
          metadata: { entropy, maxEntropy: rule.maxEntropy }
        })
      }
    }

    return {
      allowed,
      warnings: warnings.length > 0 ? warnings : undefined,
      actions: actions.length > 0 ? actions : undefined,
      rationale: rationale.length > 0 ? rationale : undefined
    }
  }

  /**
   * Evaluate minimum convergence rule
   */
  private evaluateMinimumConvergence(
    rule: MinimumConvergenceRule,
    context: PolicyEvaluationContext
  ): {
    allowed: boolean
    warnings?: PolicyWarning[]
    actions?: EnforcementAction[]
    rationale?: string[]
  } {
    const warnings: PolicyWarning[] = []
    const rationale: string[] = []
    let allowed = true

    const convergence = context.convergenceScore ?? 1.0

    if (convergence < rule.threshold) {
      rationale.push(
        `Convergence score ${convergence.toFixed(2)} below minimum ${rule.threshold}`
      )

      if (rule.action === 'block') {
        allowed = false
        warnings.push({
          rule: 'minimum_convergence',
          severity: 'high',
          message: 'Execution blocked due to low convergence',
          metadata: { convergence, threshold: rule.threshold }
        })
      } else if (rule.action === 'warn') {
        warnings.push({
          rule: 'minimum_convergence',
          severity: 'medium',
          message: 'Low convergence detected but execution allowed',
          metadata: { convergence, threshold: rule.threshold }
        })
      }
    }

    return {
      allowed,
      warnings: warnings.length > 0 ? warnings : undefined,
      rationale: rationale.length > 0 ? rationale : undefined
    }
  }

  /**
   * Evaluate canonical path protection rule
   */
  private evaluateCanonicalPathProtection(
    rule: CanonicalPathProtectionRule,
    context: PolicyEvaluationContext,
    currentPlan: typeof context.executionPlan
  ): {
    allowed: boolean
    warnings?: PolicyWarning[]
    actions?: EnforcementAction[]
    rationale?: string[]
  } {
    const rationale: string[] = []

    const canonicalConfidence = context.canonicalConfidence ?? 1.0
    const entropy = context.entropy ?? 0

    const protection = this.pathProtector.protect(
      currentPlan,
      canonicalConfidence,
      entropy,
      rule.minConfidence
    )

    if (protection.shouldProtect) {
      rationale.push(...protection.warnings)

      if (rule.action === 'prefer_canonical_transition') {
        rationale.push('Canonical path protection engaged')
      }
    }

    return {
      allowed: true,  // Canonical protection never blocks, only guides
      warnings: protection.warnings.map((msg) => ({
        rule: 'canonical_path_protection',
        severity: 'low',
        message: msg,
        metadata: { canonicalConfidence, entropy, minConfidence: rule.minConfidence }
      })),
      actions: protection.actions.length > 0 ? protection.actions : undefined,
      rationale: rationale.length > 0 ? rationale : undefined
    }
  }

  /**
   * Dry-run policy evaluation (for API endpoint)
   */
  async dryRun(context: PolicyEvaluationContext): Promise<PolicyDecision> {
    return this.evaluate(context)
  }

  /**
   * Get policy store
   */
  getPolicyStore(): PolicyStore {
    return this.policyStore
  }
}

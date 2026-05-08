import type { ExecutionContext } from '../context/execution-context.js'
import type { RuntimePolicyEngine } from './RuntimePolicyEngine.js'
import type { GovernanceDecisionStore } from './GovernanceDecisionStore.js'
import type { PolicyEvaluationContext, ExecutionPlan, GovernanceDecision } from './types.js'
import { randomUUID } from 'node:crypto'
import { ProviderReliabilityAnalyzer } from '../intelligence/recommendation/ProviderReliabilityAnalyzer.js'
import { ExecutionStore } from '../store/execution-store.js'
import type { DurableExecutionQueue } from '../queue/durable-execution-queue.js'
import { CanonicalInferenceEngine } from '../intelligence/CanonicalInferenceEngine.js'

/**
 * ExecutionGovernanceMiddleware - Pipeline stage for policy enforcement
 * 
 * Inserted between PLAN and EXECUTE stages:
 * 
 * INGEST → EVALUATE → PLAN → **GOVERN** → EXECUTE → APPLY → EMIT
 * 
 * This is critically important because it allows the runtime to:
 * - Alter execution plans before side effects occur
 * - Block unsafe transitions
 * - Reroute unstable providers
 * - Enforce convergence policies
 * - Auto-heal execution paths
 * 
 * WITHOUT changing tenant models directly.
 */
export class ExecutionGovernanceMiddleware {
  private readonly policyEngine: RuntimePolicyEngine
  private readonly governanceStore: GovernanceDecisionStore
  private readonly executionStore: ExecutionStore
  private readonly reliabilityAnalyzer: ProviderReliabilityAnalyzer
  private readonly inferenceEngine: CanonicalInferenceEngine
  private readonly queue?: DurableExecutionQueue

  constructor(
    policyEngine: RuntimePolicyEngine,
    governanceStore: GovernanceDecisionStore,
    executionStore: ExecutionStore,
    queue?: DurableExecutionQueue
  ) {
    this.policyEngine = policyEngine
    this.governanceStore = governanceStore
    this.executionStore = executionStore
    this.reliabilityAnalyzer = new ProviderReliabilityAnalyzer()
    this.inferenceEngine = new CanonicalInferenceEngine()
    this.queue = queue
  }

  /**
   * Create governance stage for pipeline
   * 
   * This stage evaluates policies and modifies execution context.
   */
  createGovernanceStage() {
    return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
      const timestamp = new Date().toISOString()

      ctx.trace.push({
        stage: 'govern',
        timestamp,
        metadata: { governance: 'evaluating_policies' }
      })

      // Skip governance if no transitions or planned actions
      if (ctx.transitions.length === 0 || ctx.plannedActions.length === 0) {
        ctx.trace.push({
          stage: 'govern',
          timestamp: new Date().toISOString(),
          metadata: { governance: 'skipped_no_actions' }
        })
        return ctx
      }

      // Build execution plan from context
      const executionPlan: ExecutionPlan = {
        actions: ctx.plannedActions,
        transition: ctx.transitions.length > 0 ? {
          from: ctx.transitions[0].fromState,
          to: ctx.transitions[0].toState,
          event: ctx.event.type
        } : undefined
      }

      // Gather intelligence metrics
      const executions = await this.executionStore.listByTenant(ctx.tenantId)
      const providerReliabilities = this.reliabilityAnalyzer.analyzeProviders(executions, this.queue)
      const providerStability = new Map<string, number>()
      for (const reliability of providerReliabilities) {
        providerStability.set(reliability.provider, reliability.stabilityScore)
      }

      // Calculate canonical metrics
      const snapshot = this.inferenceEngine.generateTopologySnapshot(ctx.tenantId, executions)

      // Build policy evaluation context
      const policyContext: PolicyEvaluationContext = {
        tenantId: ctx.tenantId,
        entityId: ctx.entityId,
        executionContext: ctx,
        model: ctx.model,
        executionPlan,
        providerStability,
        entropy: snapshot.entropyScore,
        convergenceScore: this.calculateConvergenceScore(executions),
        canonicalConfidence: snapshot.canonicalConfidence
      }

      // Evaluate policies
      const decision = await this.policyEngine.evaluate(policyContext)

      // Store governance decision
      const governanceDecision: GovernanceDecision = {
        id: randomUUID(),
        tenantId: ctx.tenantId,
        entityId: ctx.entityId,
        timestamp: new Date(),
        decision,
        context: policyContext,
        rulesEvaluated: await this.getRuleTypes(ctx.tenantId),
        rulesFired: this.extractFiredRules(decision)
      }

      await this.governanceStore.store(governanceDecision)

      // Apply decision
      if (!decision.allowed) {
        // Block execution by clearing planned actions
        ctx.plannedActions = []
        ctx.trace.push({
          stage: 'govern',
          timestamp: new Date().toISOString(),
          metadata: {
            governance: 'execution_blocked',
            rationale: decision.rationale,
            warnings: decision.warnings
          }
        })

        // Throw error to stop pipeline
        throw new Error(
          `Execution blocked by governance policy: ${decision.rationale.join('; ')}`
        )
      }

      // Apply modifications if present
      if (decision.modifiedExecutionPlan) {
        ctx.plannedActions = decision.modifiedExecutionPlan.actions
        ctx.trace.push({
          stage: 'govern',
          timestamp: new Date().toISOString(),
          metadata: {
            governance: 'plan_modified',
            enforcementActions: decision.enforcementActions,
            rationale: decision.rationale
          }
        })
      }

      // Add governance metadata to context
      ctx.trace.push({
        stage: 'govern',
        timestamp: new Date().toISOString(),
        metadata: {
          governance: 'policies_evaluated',
          allowed: decision.allowed,
          warnings: decision.warnings?.length || 0,
          enforcementActions: decision.enforcementActions?.length || 0,
          modified: !!decision.modifiedExecutionPlan
        }
      })

      return ctx
    }
  }

  /**
   * Get rule types for tenant
   */
  private async getRuleTypes(tenantId: string): Promise<string[]> {
    const rules = await this.policyEngine.getPolicyStore().getRules(tenantId)
    return rules.map((rule) => rule.type)
  }

  /**
   * Extract fired rules from decision
   */
  private extractFiredRules(decision: import('./types.js').PolicyDecision): string[] {
    const fired: string[] = []

    if (decision.warnings) {
      for (const warning of decision.warnings) {
        if (!fired.includes(warning.rule)) {
          fired.push(warning.rule)
        }
      }
    }

    if (decision.enforcementActions) {
      for (const action of decision.enforcementActions) {
        // Enforcement actions indicate rules fired
        if (action.type === 'provider_reroute' && !fired.includes('provider_stability')) {
          fired.push('provider_stability')
        } else if (action.type === 'entropy_mitigation' && !fired.includes('entropy_limit')) {
          fired.push('entropy_limit')
        } else if (action.type === 'canonical_protection' && !fired.includes('canonical_path_protection')) {
          fired.push('canonical_path_protection')
        }
      }
    }

    return fired
  }

  /**
   * Calculate convergence score from executions
   */
  private calculateConvergenceScore(executions: import('../store/execution-record.js').ExecutionRecord[]): number {
    if (executions.length < 3) {
      return 1.0  // Not enough data, assume converged
    }

    // Simple convergence metric: ratio of successful executions
    const successful = executions.filter((e) => e.status === 'completed').length
    return successful / executions.length
  }
}

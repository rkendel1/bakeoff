import type { TenantModel } from '../../models/tenant-model.js'
import type { ExecutionRecord } from '../store/execution-record.js'
import type { DriftAnalysis } from './types.js'
import { CanonicalTransitionGraph } from './CanonicalTransitionGraph.js'
import { ExecutionPatternAnalyzer } from './ExecutionPatternAnalyzer.js'

/**
 * DriftFromCanonicalAnalyzer - Detects drift between declared model and observed behavior
 * 
 * This is where the runtime helps tenants reconcile their models with reality:
 * 
 * - Tenant model = hypothesis about how the workflow should work
 * - Execution behavior = evidence of how it actually works
 * - Runtime = provides analysis to help reconcile the two
 * 
 * The analyzer compares:
 * - What the model declares (transitions, states, actions)
 * - What is observed in execution (actual behavior)
 * 
 * And provides evidence of:
 * - Unused transitions (defined but not observed in execution)
 * - Shadow transitions (observed but not formally defined)
 * - Dead states (defined but not reached)
 * - Emergent workflows (patterns not captured in model)
 * - Model drift (divergence over time)
 * 
 * This is massively important because:
 * - It provides evidence-based feedback to tenants
 * - It helps tenants understand actual vs intended behavior
 * - The runtime can suggest model improvements
 * - The runtime can detect when behavior has evolved beyond the model
 */
export class DriftFromCanonicalAnalyzer {
  private readonly transitionGraph: CanonicalTransitionGraph
  private readonly patternAnalyzer: ExecutionPatternAnalyzer

  constructor() {
    this.transitionGraph = new CanonicalTransitionGraph()
    this.patternAnalyzer = new ExecutionPatternAnalyzer()
  }

  /**
   * Analyze drift between declared model and observed execution behavior
   */
  analyzeDrift(
    tenantId: string,
    model: TenantModel,
    executions: ExecutionRecord[]
  ): DriftAnalysis {
    // Build transition graph from actual execution behavior
    this.transitionGraph.build(executions)

    // Detect unused transitions (in model but not executed)
    const unusedTransitions = this.detectUnusedTransitions(model, executions)

    // Detect shadow transitions (executed but not in model)
    const shadowTransitions = this.detectShadowTransitions(model, executions)

    // Calculate entropy score
    const entropyScore = this.patternAnalyzer.calculateExecutionEntropy(executions)

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      unusedTransitions,
      shadowTransitions,
      entropyScore
    )

    const driftDetected =
      unusedTransitions.length > 0 || shadowTransitions.length > 0

    return {
      tenantId,
      driftDetected,
      unusedTransitions,
      shadowTransitions,
      entropyScore,
      recommendations
    }
  }

  /**
   * Detect transitions defined in model but never executed
   */
  private detectUnusedTransitions(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): string[] {
    const unused: string[] = []

    for (const transition of model.transitions) {
      const hasExecution = this.transitionGraph.hasTransition(
        transition.fromState,
        transition.toState,
        transition.eventType
      )

      if (!hasExecution) {
        unused.push(
          `${transition.fromState} -> ${transition.toState} (${transition.eventType})`
        )
      }
    }

    return unused
  }

  /**
   * Detect transitions executed but not formally defined in model
   * These are "shadow transitions" - emergent behavior
   */
  private detectShadowTransitions(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): string[] {
    const shadow: string[] = []
    const observedTransitions = this.transitionGraph.getCanonicalTransitions()

    for (const observed of observedTransitions) {
      const isDefined = model.transitions.some(
        (t) =>
          t.fromState === observed.from &&
          t.toState === observed.to &&
          t.eventType === observed.eventType
      )

      if (!isDefined) {
        shadow.push(
          `${observed.from} -> ${observed.to} (${observed.eventType})`
        )
      }
    }

    return shadow
  }

  /**
   * Detect dead states: states defined in model but never reached in execution
   */
  detectDeadStates(model: TenantModel, executions: ExecutionRecord[]): string[] {
    const observedStates = new Set(this.transitionGraph.getStates())
    const deadStates: string[] = []

    for (const state of model.states) {
      if (!observedStates.has(state)) {
        deadStates.push(state)
      }
    }

    return deadStates
  }

  /**
   * Detect dominant providers that differ from model declarations
   */
  detectProviderDrift(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): Array<{ action: string; declared: string; actual: string }> {
    const drift: Array<{ action: string; declared: string; actual: string }> = []

    // Build map of declared providers
    const declaredProviders = new Map<string, string>()
    for (const action of model.actions) {
      declaredProviders.set(action.name, action.provider)
    }

    // Build map of actual provider usage
    const actualProviders = new Map<string, Map<string, number>>()
    for (const execution of executions) {
      const trace = execution.contextSnapshot.trace
      for (const entry of trace) {
        if (entry.stage === 'EXECUTE' && entry.context.plannedActions) {
          for (const action of entry.context.plannedActions) {
            if (!actualProviders.has(action.name)) {
              actualProviders.set(action.name, new Map())
            }
            const providerCounts = actualProviders.get(action.name)!
            providerCounts.set(
              action.provider,
              (providerCounts.get(action.provider) || 0) + 1
            )
          }
        }
      }
    }

    // Compare declared vs actual
    for (const [action, providerCounts] of actualProviders) {
      const declared = declaredProviders.get(action)
      if (!declared) continue

      // Find most used provider
      let maxCount = 0
      let mostUsed = ''
      for (const [provider, count] of providerCounts) {
        if (count > maxCount) {
          maxCount = count
          mostUsed = provider
        }
      }

      if (mostUsed && mostUsed !== declared) {
        drift.push({ action, declared, actual: mostUsed })
      }
    }

    return drift
  }

  /**
   * Calculate model coverage: percentage of model that's actually used
   */
  calculateModelCoverage(model: TenantModel, executions: ExecutionRecord[]): number {
    if (model.transitions.length === 0) return 0

    let usedCount = 0
    for (const transition of model.transitions) {
      const hasExecution = this.transitionGraph.hasTransition(
        transition.fromState,
        transition.toState,
        transition.eventType
      )
      if (hasExecution) {
        usedCount++
      }
    }

    return usedCount / model.transitions.length
  }

  /**
   * Generate actionable recommendations based on drift analysis
   */
  private generateRecommendations(
    unusedTransitions: string[],
    shadowTransitions: string[],
    entropyScore: number
  ): string[] {
    const recommendations: string[] = []

    if (unusedTransitions.length > 0) {
      recommendations.push(
        `Consider removing ${unusedTransitions.length} unused transition(s) from the model`
      )
      if (unusedTransitions.length <= 3) {
        recommendations.push(`Unused: ${unusedTransitions.join(', ')}`)
      }
    }

    if (shadowTransitions.length > 0) {
      recommendations.push(
        `Formalize ${shadowTransitions.length} shadow transition(s) in the model`
      )
      if (shadowTransitions.length <= 3) {
        recommendations.push(`Shadow: ${shadowTransitions.join(', ')}`)
      }
    }

    if (entropyScore > 0.7) {
      recommendations.push(
        'High entropy detected: execution patterns are diverse and unpredictable'
      )
      recommendations.push('Consider simplifying the workflow or adding constraints')
    } else if (entropyScore < 0.3) {
      recommendations.push(
        'Low entropy detected: execution patterns have converged to stable paths'
      )
      recommendations.push('Model can be simplified to match observed behavior')
    }

    if (recommendations.length === 0) {
      recommendations.push('No significant drift detected')
      recommendations.push('Model aligns well with observed execution behavior')
    }

    return recommendations
  }
}

import type { ExecutionRecord } from '../../store/execution-record.js'
import type { TenantModel } from '../../../models/tenant-model.js'
import type { EntropyReductionOpportunity } from './types.js'
import { ExecutionPatternAnalyzer } from '../ExecutionPatternAnalyzer.js'

/**
 * EntropyReductionAdvisor - Identify operational simplification opportunities
 * 
 * Detects:
 * - State explosion
 * - Branching instability
 * - Unnecessary transitions
 * - Low-confidence paths
 * 
 * Goal:
 * Identify ways to reduce operational complexity and entropy
 */
export class EntropyReductionAdvisor {
  private readonly patternAnalyzer: ExecutionPatternAnalyzer

  constructor() {
    this.patternAnalyzer = new ExecutionPatternAnalyzer()
  }

  /**
   * Analyze entropy and identify reduction opportunities
   */
  analyzeEntropy(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): EntropyReductionOpportunity[] {
    const opportunities: EntropyReductionOpportunity[] = []

    // 1. Detect unused transitions
    const unusedTransitions = this.detectUnusedTransitions(model, executions)
    if (unusedTransitions.length > 0) {
      opportunities.push({
        type: 'unused_transition',
        severity: unusedTransitions.length > 3 ? 'high' : 'medium',
        description: `${unusedTransitions.length} transition(s) defined in model but never executed`,
        affectedElements: unusedTransitions,
        potentialEntropyReduction: unusedTransitions.length * 0.1
      })
    }

    // 2. Detect dead states
    const deadStates = this.detectDeadStates(model, executions)
    if (deadStates.length > 0) {
      opportunities.push({
        type: 'dead_state',
        severity: deadStates.length > 2 ? 'high' : 'medium',
        description: `${deadStates.length} state(s) defined in model but never reached`,
        affectedElements: deadStates,
        potentialEntropyReduction: deadStates.length * 0.15
      })
    }

    // 3. Detect low-confidence paths
    const lowConfidencePaths = this.detectLowConfidencePaths(executions)
    if (lowConfidencePaths.length > 0) {
      opportunities.push({
        type: 'low_confidence_path',
        severity: 'low',
        description: `${lowConfidencePaths.length} execution path(s) with low frequency`,
        affectedElements: lowConfidencePaths,
        potentialEntropyReduction: lowConfidencePaths.length * 0.05
      })
    }

    // 4. Detect state explosion (too many states for execution volume)
    const stateExplosion = this.detectStateExplosion(model, executions)
    if (stateExplosion) {
      opportunities.push({
        type: 'state_explosion',
        severity: 'high',
        description: 'Model defines many states but executions converge to a few paths',
        affectedElements: [stateExplosion.unusedStates.join(', ')],
        potentialEntropyReduction: 0.3
      })
    }

    return opportunities
  }

  /**
   * Detect transitions defined in model but never executed
   */
  private detectUnusedTransitions(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): string[] {
    const executedTransitions = new Set<string>()

    // Track all executed transitions
    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        const key = `${update.fromState} -> ${update.toState} (${update.eventType})`
        executedTransitions.add(key)
      }
    }

    // Find unused transitions from model
    const unused: string[] = []
    for (const transition of model.transitions) {
      const key = `${transition.fromState} -> ${transition.toState} (${transition.eventType})`
      if (!executedTransitions.has(key)) {
        unused.push(key)
      }
    }

    return unused
  }

  /**
   * Detect states defined in model but never reached in execution
   */
  private detectDeadStates(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): string[] {
    const reachedStates = new Set<string>()

    // Track all reached states
    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        reachedStates.add(update.fromState)
        reachedStates.add(update.toState)
      }
    }

    // Find unreached states from model
    const dead: string[] = []
    for (const state of model.states) {
      if (!reachedStates.has(state)) {
        dead.push(state)
      }
    }

    return dead
  }

  /**
   * Detect execution paths that are rarely used (< 5% of total)
   */
  private detectLowConfidencePaths(executions: ExecutionRecord[]): string[] {
    const paths = this.patternAnalyzer.getTopPaths(executions, 20)
    const totalExecutions = executions.length

    const lowConfidence: string[] = []
    for (const path of paths) {
      const frequency = path.frequency / totalExecutions
      if (frequency < 0.05) {
        lowConfidence.push(path.path.join(' → '))
      }
    }

    return lowConfidence
  }

  /**
   * Detect if model defines many states but executions use only a few
   */
  private detectStateExplosion(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): { unusedStates: string[], utilizationRate: number } | null {
    const reachedStates = new Set<string>()

    // Track reached states
    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        reachedStates.add(update.fromState)
        reachedStates.add(update.toState)
      }
    }

    const utilizationRate = reachedStates.size / model.states.length
    
    // If less than 60% of states are used, flag as state explosion
    if (utilizationRate < 0.6 && model.states.length > 5) {
      const unusedStates = model.states.filter(s => !reachedStates.has(s))
      return {
        unusedStates,
        utilizationRate
      }
    }

    return null
  }

  /**
   * Generate entropy reduction recommendations
   */
  getRecommendations(opportunities: EntropyReductionOpportunity[]): string[] {
    const recommendations: string[] = []

    for (const opp of opportunities) {
      switch (opp.type) {
        case 'unused_transition':
          recommendations.push(
            `Remove ${opp.affectedElements.length} unused transition(s) to reduce model complexity`
          )
          break
        case 'dead_state':
          recommendations.push(
            `Remove ${opp.affectedElements.length} dead state(s) that are never reached`
          )
          break
        case 'low_confidence_path':
          recommendations.push(
            `Consider consolidating ${opp.affectedElements.length} rarely-used execution paths`
          )
          break
        case 'state_explosion':
          recommendations.push(
            `High state count with low utilization - consider simplifying the workflow`
          )
          break
      }
    }

    return recommendations
  }
}

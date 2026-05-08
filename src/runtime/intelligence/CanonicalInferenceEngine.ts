import type { ExecutionRecord } from '../store/execution-record.js'
import type {
  CanonicalState,
  ProviderPattern,
  OperationalTopologySnapshot
} from './types.js'
import { CanonicalTransitionGraph } from './CanonicalTransitionGraph.js'
import { ExecutionPatternAnalyzer } from './ExecutionPatternAnalyzer.js'

/**
 * CanonicalInferenceEngine - Core intelligence engine for deriving canonical behavior
 * 
 * This is where the runtime transitions from:
 *   "executing what the model says"
 * to:
 *   "gathering evidence about what actually happens"
 * 
 * The engine analyzes execution history to provide evidence of:
 * - Dominant transitions (what paths are frequently observed)
 * - Dominant providers (which providers are commonly used)
 * - Stable workflow paths (what workflows emerge organically)
 * - Canonical state clusters (which states are operationally important)
 * - Operational bottlenecks (where executions fail)
 * - Dead transitions (what's defined but not observed)
 * 
 * This shifts the philosophical center:
 *   tenant model = hypothesis
 *   execution behavior = evidence
 *   runtime = reconciliation layer
 */
export class CanonicalInferenceEngine {
  private readonly transitionGraph: CanonicalTransitionGraph
  private readonly patternAnalyzer: ExecutionPatternAnalyzer

  constructor() {
    this.transitionGraph = new CanonicalTransitionGraph()
    this.patternAnalyzer = new ExecutionPatternAnalyzer()
  }

  /**
   * Generate operational topology snapshot from execution history
   * 
   * This is the primary output of the inference engine:
   * A snapshot capturing the tenant's actual operational behavior
   */
  generateTopologySnapshot(
    tenantId: string,
    executions: ExecutionRecord[]
  ): OperationalTopologySnapshot {
    // Build transition graph from execution history
    this.transitionGraph.build(executions)

    // Extract canonical states
    const canonicalStates = this.inferCanonicalStates(executions)

    // Extract canonical transitions
    const canonicalTransitions = this.transitionGraph.getCanonicalTransitions()

    // Extract dominant providers
    const dominantProviders = this.inferDominantProviders(executions)

    // Extract stable paths
    const stablePaths = this.patternAnalyzer.getStablePaths(executions)

    // Calculate metrics
    const entropyScore = this.patternAnalyzer.calculateExecutionEntropy(executions)
    const operationalComplexity = this.calculateOperationalComplexity(executions)
    const canonicalConfidence = this.calculateCanonicalConfidence(executions)

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      canonicalStates,
      canonicalTransitions,
      dominantProviders,
      stablePaths,
      entropyScore,
      operationalComplexity,
      canonicalConfidence
    }
  }

  /**
   * Infer canonical states: states with high centrality and execution frequency
   */
  private inferCanonicalStates(executions: ExecutionRecord[]): CanonicalState[] {
    const states = this.transitionGraph.getStates()
    const stateExecutionCounts = new Map<string, number>()

    // Count how many times each state appears in execution context
    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        stateExecutionCounts.set(
          update.toState,
          (stateExecutionCounts.get(update.toState) || 0) + 1
        )
      }
    }

    // Create canonical states with centrality scores
    const canonicalStates: CanonicalState[] = states.map((state) => ({
      state,
      centrality: this.transitionGraph.getStateCentrality(state),
      executionCount: stateExecutionCounts.get(state) || 0
    }))

    // Sort by centrality (most central first)
    return canonicalStates.sort((a, b) => b.centrality - a.centrality)
  }

  /**
   * Infer dominant providers: which providers are actually used for each action
   */
  private inferDominantProviders(executions: ExecutionRecord[]): ProviderPattern[] {
    const providerMap = new Map<
      string,
      {
        action: string
        provider: string
        count: number
        successCount: number
      }
    >()

    // Extract provider usage from execution context
    for (const execution of executions) {
      const plannedActions = execution.contextSnapshot.plannedActions
      for (const action of plannedActions) {
        const key = `${action.name}::${action.provider}`
        const existing = providerMap.get(key)

        if (existing) {
          existing.count++
          if (execution.status === 'completed') {
            existing.successCount++
          }
        } else {
          providerMap.set(key, {
            action: action.name,
            provider: action.provider,
            count: 1,
            successCount: execution.status === 'completed' ? 1 : 0
          })
        }
      }
    }

    // Calculate total usage per action
    const actionTotals = new Map<string, number>()
    for (const data of providerMap.values()) {
      actionTotals.set(data.action, (actionTotals.get(data.action) || 0) + data.count)
    }

    // Convert to ProviderPattern array
    const patterns: ProviderPattern[] = []
    for (const data of providerMap.values()) {
      const total = actionTotals.get(data.action) || 0
      patterns.push({
        action: data.action,
        provider: data.provider,
        usage: total > 0 ? data.count / total : 0,
        successRate: data.count > 0 ? data.successCount / data.count : 0,
        executionCount: data.count
      })
    }

    // Sort by usage (most used first)
    return patterns.sort((a, b) => b.usage - a.usage)
  }

  /**
   * Calculate operational complexity: diversity of execution paths
   */
  private calculateOperationalComplexity(executions: ExecutionRecord[]): number {
    if (executions.length === 0) return 0

    const patterns = this.patternAnalyzer.analyzePatterns(executions)
    const uniquePaths = patterns.length

    // Complexity is the ratio of unique paths to total executions
    // Normalized to 0-1 range
    const complexity = uniquePaths / Math.max(executions.length, 1)
    return Math.min(complexity, 1)
  }

  /**
   * Calculate canonical confidence: how well behavior has converged
   * 
   * High confidence = executions converge on few stable paths
   * Low confidence = high diversity, low convergence
   */
  private calculateCanonicalConfidence(executions: ExecutionRecord[]): number {
    if (executions.length === 0) return 0

    // Confidence is inversely related to entropy
    // Low entropy = high confidence (behavior is converged)
    const entropy = this.patternAnalyzer.calculateExecutionEntropy(executions)
    const convergence = this.patternAnalyzer.calculatePathConvergence(executions, 3)

    // Combine entropy and convergence
    // confidence = (1 - entropy) * convergence
    return (1 - entropy) * convergence
  }

  /**
   * Get dominant transitions: the most canonical transitions
   */
  getDominantTransitions(limit: number = 5) {
    return this.transitionGraph.getCanonicalTransitions().slice(0, limit)
  }

  /**
   * Get execution bottlenecks: states where failures occur
   */
  getBottlenecks(executions: ExecutionRecord[]): Map<string, number> {
    return this.patternAnalyzer.identifyBottlenecks(executions)
  }

  /**
   * Get the underlying transition graph for detailed analysis
   */
  getTransitionGraph(): CanonicalTransitionGraph {
    return this.transitionGraph
  }
}

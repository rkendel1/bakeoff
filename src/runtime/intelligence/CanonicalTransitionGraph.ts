import type { ExecutionRecord } from '../store/execution-record.js'
import type { TransitionWeight, CanonicalTransition } from './types.js'

/**
 * CanonicalTransitionGraph - Builds weighted operational graph from execution history
 * 
 * This is the core data structure that represents observed operational behavior
 * as evidenced through execution history, which may differ from the declared model.
 * 
 * Key concepts:
 * - Weight: Based on execution frequency and success rate
 * - Confidence: Normalized weight representing how commonly a transition is observed
 * - Operational topology: The graph structure provides evidence of the tenant's
 *   actual operational patterns
 */
export class CanonicalTransitionGraph {
  private transitions: Map<string, TransitionWeight> = new Map()

  /**
   * Build the transition graph from execution records
   */
  build(executions: ExecutionRecord[]): void {
    this.transitions.clear()

    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      const isSuccess = execution.status === 'completed'

      // Extract state transitions from execution context
      for (const update of stateUpdates) {
        const key = this.makeKey(
          update.fromState,
          update.toState,
          execution.event.type
        )

        const existing = this.transitions.get(key)

        if (existing) {
          existing.count++
          if (isSuccess) {
            existing.successCount++
          } else {
            existing.failureCount++
          }
        } else {
          this.transitions.set(key, {
            from: update.fromState,
            to: update.toState,
            eventType: execution.event.type,
            weight: 0, // Will be calculated later
            count: 1,
            successCount: isSuccess ? 1 : 0,
            failureCount: isSuccess ? 0 : 1
          })
        }
      }
    }

    // Calculate weights based on frequency and success rate
    this.calculateWeights()
  }

  /**
   * Calculate normalized weights for all transitions
   * Weight = (execution_count * success_rate) / total_executions
   */
  private calculateWeights(): void {
    const totalExecutions = Array.from(this.transitions.values()).reduce(
      (sum, t) => sum + t.count,
      0
    )

    if (totalExecutions === 0) return

    for (const transition of this.transitions.values()) {
      const successRate =
        transition.count > 0
          ? transition.successCount / transition.count
          : 0

      // Weight combines frequency and reliability
      transition.weight = (transition.count * successRate) / totalExecutions
    }
  }

  /**
   * Get canonical transitions sorted by confidence (weight)
   */
  getCanonicalTransitions(): CanonicalTransition[] {
    const transitions = Array.from(this.transitions.values())
      .map((t) => ({
        from: t.from,
        to: t.to,
        eventType: t.eventType,
        confidence: t.weight,
        executionCount: t.count,
        successRate: t.count > 0 ? t.successCount / t.count : 0
      }))
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence descending

    return transitions
  }

  /**
   * Get transitions from a specific state
   */
  getTransitionsFrom(state: string): CanonicalTransition[] {
    return this.getCanonicalTransitions().filter((t) => t.from === state)
  }

  /**
   * Get the most canonical transition from a state
   */
  getMostCanonicalFrom(state: string): CanonicalTransition | undefined {
    const transitions = this.getTransitionsFrom(state)
    return transitions.length > 0 ? transitions[0] : undefined
  }

  /**
   * Get all unique states observed in the graph
   */
  getStates(): string[] {
    const states = new Set<string>()
    for (const t of this.transitions.values()) {
      states.add(t.from)
      states.add(t.to)
    }
    return Array.from(states)
  }

  /**
   * Calculate state centrality (how often a state appears in transitions)
   */
  getStateCentrality(state: string): number {
    const transitions = Array.from(this.transitions.values())
    const totalCount = transitions.reduce((sum, t) => sum + t.count, 0)

    if (totalCount === 0) return 0

    const stateCount = transitions
      .filter((t) => t.from === state || t.to === state)
      .reduce((sum, t) => sum + t.count, 0)

    return stateCount / totalCount
  }

  /**
   * Check if a transition exists in observed behavior
   */
  hasTransition(from: string, to: string, eventType: string): boolean {
    const key = this.makeKey(from, to, eventType)
    return this.transitions.has(key)
  }

  /**
   * Get transition by key
   */
  getTransition(
    from: string,
    to: string,
    eventType: string
  ): CanonicalTransition | undefined {
    const key = this.makeKey(from, to, eventType)
    const t = this.transitions.get(key)
    if (!t) return undefined

    return {
      from: t.from,
      to: t.to,
      eventType: t.eventType,
      confidence: t.weight,
      executionCount: t.count,
      successRate: t.count > 0 ? t.successCount / t.count : 0
    }
  }

  /**
   * Create unique key for a transition
   */
  private makeKey(from: string, to: string, eventType: string): string {
    return `${from}::${eventType}::${to}`
  }

  /**
   * Get total number of transitions observed
   */
  size(): number {
    return this.transitions.size
  }
}

import type { ExecutionRecord } from '../store/execution-record.js'
import type { ExecutionPattern } from './types.js'

/**
 * ExecutionPatternAnalyzer - Detects execution patterns from historical records
 * 
 * This analyzer identifies:
 * - Most common execution paths
 * - Path frequencies
 * - Success rates for each path
 * - Average durations
 * 
 * This provides evidence of which workflows are actually being followed
 * and which are reliable, independent of what the model declares.
 */
export class ExecutionPatternAnalyzer {
  /**
   * Analyze execution records and extract patterns
   */
  analyzePatterns(executions: ExecutionRecord[]): ExecutionPattern[] {
    const pathMap = new Map<
      string,
      {
        frequency: number
        successCount: number
        totalDurationMs: number
        path: string[]
      }
    >()

    // Extract paths from each execution
    for (const execution of executions) {
      const path = this.extractPath(execution)
      if (path.length === 0) continue

      const pathKey = path.join('→')
      const existing = pathMap.get(pathKey)

      const duration = execution.completedAt
        ? execution.completedAt.getTime() - execution.createdAt.getTime()
        : 0

      if (existing) {
        existing.frequency++
        if (execution.status === 'completed') {
          existing.successCount++
        }
        existing.totalDurationMs += duration
      } else {
        pathMap.set(pathKey, {
          frequency: 1,
          successCount: execution.status === 'completed' ? 1 : 0,
          totalDurationMs: duration,
          path
        })
      }
    }

    // Convert to ExecutionPattern array
    const patterns: ExecutionPattern[] = []
    for (const data of pathMap.values()) {
      patterns.push({
        path: data.path,
        frequency: data.frequency,
        successRate: data.frequency > 0 ? data.successCount / data.frequency : 0,
        averageDurationMs:
          data.frequency > 0 ? data.totalDurationMs / data.frequency : 0
      })
    }

    // Sort by frequency (most common first)
    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Extract the state path from an execution record
   */
  private extractPath(execution: ExecutionRecord): string[] {
    const path: string[] = []
    const stateUpdates = execution.contextSnapshot.stateUpdates

    for (const update of stateUpdates) {
      // Add states to path
      if (path.length === 0 || path[path.length - 1] !== update.fromState) {
        path.push(update.fromState)
      }
      path.push(update.toState)
    }

    return path
  }

  /**
   * Get the most common execution paths (top N)
   */
  getTopPaths(executions: ExecutionRecord[], limit: number = 5): ExecutionPattern[] {
    const patterns = this.analyzePatterns(executions)
    return patterns.slice(0, limit)
  }

  /**
   * Calculate path convergence: percentage of executions that follow top N paths
   */
  calculatePathConvergence(
    executions: ExecutionRecord[],
    topN: number = 3
  ): number {
    if (executions.length === 0) return 0

    const patterns = this.analyzePatterns(executions)
    const topPaths = patterns.slice(0, topN)
    const topPathExecutions = topPaths.reduce(
      (sum, p) => sum + p.frequency,
      0
    )

    return topPathExecutions / executions.length
  }

  /**
   * Calculate execution entropy: measure of path diversity
   * Lower entropy = more convergence on few paths
   * Higher entropy = more diverse execution patterns
   */
  calculateExecutionEntropy(executions: ExecutionRecord[]): number {
    if (executions.length === 0) return 0

    const patterns = this.analyzePatterns(executions)
    const total = executions.length

    let entropy = 0
    for (const pattern of patterns) {
      const probability = pattern.frequency / total
      if (probability > 0) {
        entropy -= probability * Math.log2(probability)
      }
    }

    // Normalize by maximum possible entropy (log2 of number of patterns)
    const maxEntropy = patterns.length > 1 ? Math.log2(patterns.length) : 1
    return maxEntropy > 0 ? entropy / maxEntropy : 0
  }

  /**
   * Get stable paths: paths with high success rate and frequency
   */
  getStablePaths(
    executions: ExecutionRecord[],
    minSuccessRate: number = 0.8,
    minFrequency: number = 2
  ): ExecutionPattern[] {
    const patterns = this.analyzePatterns(executions)
    return patterns.filter(
      (p) => p.successRate >= minSuccessRate && p.frequency >= minFrequency
    )
  }

  /**
   * Identify execution bottlenecks: states that appear frequently in failed executions
   */
  identifyBottlenecks(executions: ExecutionRecord[]): Map<string, number> {
    const failedStates = new Map<string, number>()

    for (const execution of executions) {
      if (execution.status === 'failed') {
        const path = this.extractPath(execution)
        // The last state in the path is where it failed
        if (path.length > 0) {
          const failureState = path[path.length - 1]
          failedStates.set(
            failureState,
            (failedStates.get(failureState) || 0) + 1
          )
        }
      }
    }

    return failedStates
  }
}

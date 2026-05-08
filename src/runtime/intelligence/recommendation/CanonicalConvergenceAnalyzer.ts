import type { ExecutionRecord } from '../../store/execution-record.js'
import type { CanonicalConvergence } from './types.js'
import { OperationalTopologyStore } from '../../store/OperationalTopologyStore.js'
import { ExecutionPatternAnalyzer } from '../ExecutionPatternAnalyzer.js'

/**
 * CanonicalConvergenceAnalyzer - Measure operational behavior convergence
 * 
 * Measures:
 * - How strongly execution behavior converges toward stable operational semantics
 * - Convergence score (0-1)
 * - Dominant path coverage
 * - Entropy trend over time
 * - Canonicalization velocity
 * 
 * This is enormous because now you can observe:
 * - Organizations operationally stabilizing over time
 * - Operational maturity metrics
 * - Organizational coherence metrics
 * - Runtime intelligence signals
 */
export class CanonicalConvergenceAnalyzer {
  private readonly patternAnalyzer: ExecutionPatternAnalyzer
  private readonly topologyStore: OperationalTopologyStore

  constructor(topologyStore?: OperationalTopologyStore) {
    this.patternAnalyzer = new ExecutionPatternAnalyzer()
    this.topologyStore = topologyStore || new OperationalTopologyStore()
  }

  /**
   * Analyze canonical convergence from execution history
   */
  async analyzeConvergence(
    tenantId: string,
    executions: ExecutionRecord[]
  ): Promise<CanonicalConvergence> {
    // Calculate convergence score
    const convergenceScore = this.calculateConvergenceScore(executions)

    // Calculate dominant path coverage
    const dominantPathCoverage = this.calculateDominantPathCoverage(executions)

    // Get entropy trend from historical snapshots
    const entropyTrend = await this.calculateEntropyTrend(tenantId)

    // Calculate canonicalization velocity
    const canonicalizationVelocity = await this.calculateCanonicalizationVelocity(tenantId)

    return {
      tenantId,
      convergenceScore,
      dominantPathCoverage,
      entropyTrend,
      canonicalizationVelocity,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Calculate convergence score (0-1)
   * Higher score = behavior has converged to fewer stable paths
   */
  private calculateConvergenceScore(executions: ExecutionRecord[]): number {
    if (executions.length === 0) return 0

    // Get execution entropy (0-1, lower is more convergence)
    const entropy = this.patternAnalyzer.calculateExecutionEntropy(executions)

    // Get path concentration
    const paths = this.patternAnalyzer.getTopPaths(executions, 10)
    const totalExecutions = executions.length

    // Calculate how much of execution volume is in top paths
    let topPathExecutions = 0
    for (const path of paths.slice(0, 3)) {
      topPathExecutions += path.frequency
    }
    const topPathConcentration = topPathExecutions / totalExecutions

    // Convergence score combines low entropy with high concentration
    // Formula: (1 - entropy) * concentration
    const convergenceScore = (1 - entropy) * topPathConcentration

    return Math.max(0, Math.min(1, convergenceScore))
  }

  /**
   * Calculate what percentage of executions follow the dominant paths
   */
  private calculateDominantPathCoverage(executions: ExecutionRecord[]): number {
    if (executions.length === 0) return 0

    const paths = this.patternAnalyzer.getTopPaths(executions, 5)
    const totalExecutions = executions.length

    // Sum frequency of top 3 paths
    let dominantPathExecutions = 0
    for (const path of paths.slice(0, 3)) {
      dominantPathExecutions += path.frequency
    }

    return dominantPathExecutions / totalExecutions
  }

  /**
   * Calculate entropy trend over time
   * Negative = decreasing entropy (converging)
   * Positive = increasing entropy (diverging)
   */
  private async calculateEntropyTrend(tenantId: string): Promise<number> {
    const metrics = await this.topologyStore.getEvolutionMetrics(tenantId)
    
    if (!metrics || metrics.snapshotCount < 2) {
      return 0 // Not enough data
    }

    // Convert trend to numeric value
    switch (metrics.entropyTrend) {
      case 'decreasing':
        return -0.1 // Converging
      case 'increasing':
        return 0.1 // Diverging
      case 'stable':
      default:
        return 0
    }
  }

  /**
   * Calculate canonicalization velocity
   * How quickly operational behavior is stabilizing
   * Positive = stabilizing, negative = destabilizing
   */
  private async calculateCanonicalizationVelocity(tenantId: string): Promise<number> {
    const metrics = await this.topologyStore.getEvolutionMetrics(tenantId)
    
    if (!metrics || metrics.snapshotCount < 2) {
      return 0 // Not enough data
    }

    // Combine confidence trend and entropy trend
    let velocityScore = 0

    // Confidence increasing is good
    if (metrics.confidenceTrend === 'increasing') {
      velocityScore += 0.1
    } else if (metrics.confidenceTrend === 'decreasing') {
      velocityScore -= 0.1
    }

    // Entropy decreasing is good
    if (metrics.entropyTrend === 'decreasing') {
      velocityScore += 0.1
    } else if (metrics.entropyTrend === 'increasing') {
      velocityScore -= 0.1
    }

    // Complexity decreasing is good
    if (metrics.complexityTrend === 'decreasing') {
      velocityScore += 0.05
    } else if (metrics.complexityTrend === 'increasing') {
      velocityScore -= 0.05
    }

    return velocityScore
  }

  /**
   * Determine if tenant is converging toward canonical behavior
   */
  isConverging(convergence: CanonicalConvergence): boolean {
    return (
      convergence.convergenceScore > 0.7 &&
      convergence.dominantPathCoverage > 0.75 &&
      convergence.entropyTrend <= 0
    )
  }

  /**
   * Determine if tenant is diverging (behavior becoming unstable)
   */
  isDiverging(convergence: CanonicalConvergence): boolean {
    return (
      convergence.convergenceScore < 0.4 ||
      (convergence.entropyTrend > 0 && convergence.canonicalizationVelocity < 0)
    )
  }

  /**
   * Generate convergence recommendations
   */
  getRecommendations(convergence: CanonicalConvergence): string[] {
    const recommendations: string[] = []

    if (this.isConverging(convergence)) {
      recommendations.push(
        `Operational behavior is converging strongly (score: ${convergence.convergenceScore.toFixed(2)})`
      )
      recommendations.push(
        `${(convergence.dominantPathCoverage * 100).toFixed(0)}% of executions follow dominant paths`
      )
      recommendations.push(
        'Consider formalizing dominant patterns into canonical model'
      )
    } else if (this.isDiverging(convergence)) {
      recommendations.push(
        `Warning: Operational behavior is diverging (score: ${convergence.convergenceScore.toFixed(2)})`
      )
      recommendations.push(
        'Executions are becoming more diverse and unpredictable'
      )
      recommendations.push(
        'Consider adding constraints or simplifying the workflow'
      )
    } else {
      recommendations.push(
        `Operational convergence is moderate (score: ${convergence.convergenceScore.toFixed(2)})`
      )
      recommendations.push(
        `${(convergence.dominantPathCoverage * 100).toFixed(0)}% of executions follow top 3 paths`
      )
    }

    // Add velocity insight
    if (convergence.canonicalizationVelocity > 0.1) {
      recommendations.push('Canonicalization velocity is positive - behavior is stabilizing over time')
    } else if (convergence.canonicalizationVelocity < -0.1) {
      recommendations.push('Canonicalization velocity is negative - behavior is destabilizing')
    }

    return recommendations
  }
}

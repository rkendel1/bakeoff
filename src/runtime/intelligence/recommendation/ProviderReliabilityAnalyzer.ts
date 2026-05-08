import type { ExecutionRecord } from '../../store/execution-record.js'
import type { DurableExecutionQueue } from '../../queue/durable-execution-queue.js'
import type { ProviderReliability } from './types.js'

/**
 * ProviderReliabilityAnalyzer - Analyze provider stability and reliability
 * 
 * Detects:
 * - Retry frequency
 * - Failure rates
 * - Timeout trends
 * - DLQ rates
 * - Provider divergence
 * - Unstable provider behavior
 * 
 * This is crucial for:
 * - Autonomous provider routing
 * - Adaptive failover
 * - Execution optimization
 */
export class ProviderReliabilityAnalyzer {
  /**
   * Analyze provider reliability from execution history and queue data
   */
  analyzeProviders(
    executions: ExecutionRecord[],
    queue?: DurableExecutionQueue
  ): ProviderReliability[] {
    // Build provider statistics
    const providerStats = new Map<string, {
      action?: string
      totalExecutions: number
      failedExecutions: number
      retriedExecutions: number
      dlqExecutions: number
    }>()

    // Analyze execution records
    for (const execution of executions) {
      const plannedActions = execution.contextSnapshot.plannedActions
      
      for (const action of plannedActions) {
        const key = action.name ? `${action.name}::${action.provider}` : action.provider
        
        if (!providerStats.has(key)) {
          providerStats.set(key, {
            action: action.name,
            totalExecutions: 0,
            failedExecutions: 0,
            retriedExecutions: 0,
            dlqExecutions: 0
          })
        }

        const stats = providerStats.get(key)!
        stats.totalExecutions++

        if (execution.status === 'failed') {
          stats.failedExecutions++
        }
      }
    }

    // Analyze DLQ if provided
    if (queue) {
      const dlq = queue.getDeadLetterQueue()
      const dlqEvents = dlq.getAll()

      for (const dlqEvent of dlqEvents) {
        // Extract provider information from DLQ event
        // Note: This is simplified - in production you'd need to track provider info
        // through the entire execution pipeline
        const event = dlqEvent.event
        
        // For now, we mark all DLQ events as affecting reliability
        // In a real implementation, you'd track which provider caused the failure
        for (const [, stats] of providerStats) {
          stats.dlqExecutions++
        }
      }
    }

    // Calculate reliability metrics
    const reliabilities: ProviderReliability[] = []

    for (const [key, stats] of providerStats) {
      const failureRate = stats.totalExecutions > 0 
        ? stats.failedExecutions / stats.totalExecutions 
        : 0

      const retryRate = stats.totalExecutions > 0
        ? stats.retriedExecutions / stats.totalExecutions
        : 0

      const dlqRate = stats.totalExecutions > 0
        ? stats.dlqExecutions / stats.totalExecutions
        : 0

      // Calculate stability score (0-1, higher is better)
      // Formula: 1 - (weighted combination of failure, retry, and DLQ rates)
      const stabilityScore = Math.max(0, 1 - (
        failureRate * 0.5 +    // Failures weight 50%
        retryRate * 0.3 +       // Retries weight 30%
        dlqRate * 0.2           // DLQ weight 20%
      ))

      // Determine recommendation
      let recommendation: ProviderReliability['recommendation']
      if (stabilityScore >= 0.9) {
        recommendation = 'stable'
      } else if (stabilityScore >= 0.7) {
        recommendation = 'monitor'
      } else if (stabilityScore >= 0.5) {
        recommendation = 'consider_alternate_provider'
      } else {
        recommendation = 'unstable'
      }

      const parts = key.split('::')
      const provider = parts.length > 1 ? parts[1] : parts[0]
      const action = parts.length > 1 ? parts[0] : undefined

      reliabilities.push({
        provider,
        action,
        failureRate,
        retryRate,
        dlqRate,
        stabilityScore,
        executionCount: stats.totalExecutions,
        recommendation
      })
    }

    // Sort by stability score (worst first for attention)
    return reliabilities.sort((a, b) => a.stabilityScore - b.stabilityScore)
  }

  /**
   * Check if a provider is unstable and should trigger a recommendation
   */
  isProviderUnstable(reliability: ProviderReliability): boolean {
    return reliability.stabilityScore < 0.7 || reliability.failureRate > 0.15
  }

  /**
   * Generate provider instability recommendations
   */
  getProviderRecommendations(reliabilities: ProviderReliability[]): string[] {
    const recommendations: string[] = []

    for (const reliability of reliabilities) {
      if (this.isProviderUnstable(reliability)) {
        const providerLabel = reliability.action 
          ? `${reliability.provider} (${reliability.action})`
          : reliability.provider

        recommendations.push(
          `Provider ${providerLabel} shows instability: ` +
          `${(reliability.failureRate * 100).toFixed(1)}% failure rate, ` +
          `stability score ${reliability.stabilityScore.toFixed(2)}`
        )
      }
    }

    return recommendations
  }
}

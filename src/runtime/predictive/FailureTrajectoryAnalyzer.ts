import type { FailureTrajectory } from './types.js'
import type { RuntimeMemoryStore } from '../memory/RuntimeMemoryStore.js'
import type { OperationalTopologyStore } from '../store/OperationalTopologyStore.js'

/**
 * FailureTrajectoryAnalyzer - Detects patterns preceding operational failures
 * 
 * This analyzes:
 * - Provider degradation patterns
 * - Entropy spike precursors
 * - Convergence decline signals
 * - Retry escalation patterns
 * 
 * Key insight:
 * Failures don't happen suddenly.
 * They follow trajectories.
 * 
 * Example pattern:
 * docuseal retry rate rising
 * + canonical confidence dropping
 * + entropy increasing
 * → predicted instability event
 * 
 * This is operational foresight.
 */
export class FailureTrajectoryAnalyzer {
  // Thresholds for trajectory detection
  private readonly DEGRADING_THRESHOLD = 0.15  // 15% degradation
  private readonly CRITICAL_THRESHOLD = 0.30   // 30% degradation
  private readonly TREND_WINDOW = 7 * 24 * 60 * 60 * 1000  // 7 days
  
  // Failure probability thresholds
  private readonly HIGH_FAILURE_PROBABILITY = 0.7
  private readonly CRITICAL_FAILURE_PROBABILITY = 0.85

  constructor(
    private readonly memoryStore: RuntimeMemoryStore,
    private readonly topologyStore: OperationalTopologyStore
  ) {}

  /**
   * Analyze failure trajectory for a tenant
   */
  async analyzeTrajectory(tenantId: string): Promise<FailureTrajectory | undefined> {
    // Get recent memory records
    const recentMemory = await this.memoryStore.getRecent(tenantId, 100)
    
    if (recentMemory.length < 10) {
      return undefined  // Not enough data
    }

    // Calculate current operational metrics
    const currentState = await this.calculateCurrentState(tenantId, recentMemory)

    // Detect pattern type
    const patternType = this.detectPatternType(currentState, recentMemory)
    if (!patternType) {
      return undefined  // No concerning pattern
    }

    // Analyze trajectory
    const trajectory = this.analyzeTrajectoryState(currentState)

    // Calculate failure probability
    const failureProbability = this.calculateFailureProbability(currentState, trajectory)

    // Estimate time to failure
    const timeToFailure = this.estimateTimeToFailure(
      currentState,
      trajectory,
      failureProbability
    )

    // Identify leading indicators
    const leadingIndicators = this.identifyLeadingIndicators(currentState)

    // Calculate confidence
    const confidence = this.calculateConfidence(recentMemory.length, failureProbability)

    return {
      tenantId,
      patternType,
      currentState,
      trajectory,
      timeToFailure,
      failureProbability,
      leadingIndicators,
      confidence,
      analyzedAt: new Date()
    }
  }

  /**
   * Calculate current operational state
   */
  private async calculateCurrentState(
    tenantId: string,
    recentMemory: any[]
  ): Promise<{
    retryRate: number
    entropyScore: number
    convergenceScore: number
    providerStability: number
  }> {
    // Calculate retry rate from memory
    const retriedExecutions = recentMemory.filter(
      (m) => m.outcome?.retryCount && m.outcome.retryCount > 0
    )
    const retryRate = retriedExecutions.length / recentMemory.length

    // Get latest topology snapshot
    const topology = await this.topologyStore.getLatest(tenantId)

    const entropyScore = topology?.entropyScore || 0.5
    const convergenceScore = topology?.canonicalConfidence || 0.5

    // Calculate provider stability from memory
    const providerFailures = recentMemory.filter(
      (m) => m.trigger.type === 'provider_instability'
    )
    const providerStability = 1 - (providerFailures.length / recentMemory.length)

    return {
      retryRate,
      entropyScore,
      convergenceScore,
      providerStability
    }
  }

  /**
   * Detect pattern type from current state
   */
  private detectPatternType(
    currentState: any,
    recentMemory: any[]
  ): FailureTrajectory['patternType'] | undefined {
    // Provider degradation: low stability + high retry rate
    if (currentState.providerStability < 0.7 && currentState.retryRate > 0.2) {
      return 'provider_degradation'
    }

    // Entropy spike: high entropy + increasing
    const entropyTriggers = recentMemory.filter(
      (m) => m.trigger.type === 'high_entropy'
    ).length
    if (currentState.entropyScore > 0.6 && entropyTriggers > recentMemory.length * 0.15) {
      return 'entropy_spike'
    }

    // Convergence decline: low convergence + trending down
    if (currentState.convergenceScore < 0.5) {
      return 'convergence_decline'
    }

    // Retry escalation: high retry rate
    if (currentState.retryRate > 0.25) {
      return 'retry_escalation'
    }

    return undefined  // No pattern detected
  }

  /**
   * Analyze trajectory state
   */
  private analyzeTrajectoryState(
    currentState: any
  ): 'stable' | 'degrading' | 'critical' {
    // Calculate overall health score
    const healthScore = (
      currentState.providerStability * 0.3 +
      (1 - currentState.retryRate) * 0.3 +
      currentState.convergenceScore * 0.2 +
      (1 - currentState.entropyScore) * 0.2
    )

    if (healthScore < 0.5) {
      return 'critical'
    } else if (healthScore < 0.7) {
      return 'degrading'
    } else {
      return 'stable'
    }
  }

  /**
   * Calculate failure probability
   */
  private calculateFailureProbability(
    currentState: any,
    trajectory: 'stable' | 'degrading' | 'critical'
  ): number {
    let baseProbability = 0

    // Base on trajectory
    if (trajectory === 'critical') {
      baseProbability = 0.8
    } else if (trajectory === 'degrading') {
      baseProbability = 0.5
    } else {
      baseProbability = 0.2
    }

    // Adjust based on specific metrics
    if (currentState.providerStability < 0.5) {
      baseProbability += 0.1
    }

    if (currentState.retryRate > 0.3) {
      baseProbability += 0.1
    }

    if (currentState.convergenceScore < 0.4) {
      baseProbability += 0.05
    }

    if (currentState.entropyScore > 0.7) {
      baseProbability += 0.05
    }

    return Math.min(1.0, baseProbability)
  }

  /**
   * Estimate time to failure
   */
  private estimateTimeToFailure(
    currentState: any,
    trajectory: 'stable' | 'degrading' | 'critical',
    failureProbability: number
  ): string | undefined {
    if (failureProbability < 0.5) {
      return undefined  // Not trending toward failure
    }

    if (trajectory === 'critical') {
      return '6h'  // Imminent
    } else if (trajectory === 'degrading') {
      if (failureProbability > this.CRITICAL_FAILURE_PROBABILITY) {
        return '12h'
      } else if (failureProbability > this.HIGH_FAILURE_PROBABILITY) {
        return '24h'
      } else {
        return '2d'
      }
    } else {
      return '7d'  // Long term
    }
  }

  /**
   * Identify leading indicators
   */
  private identifyLeadingIndicators(
    currentState: any
  ): Array<{
    indicator: string
    currentValue: number
    threshold: number
    deviation: number
  }> {
    const indicators: Array<{
      indicator: string
      currentValue: number
      threshold: number
      deviation: number
    }> = []

    // Provider stability
    const providerThreshold = 0.8
    if (currentState.providerStability < providerThreshold) {
      indicators.push({
        indicator: 'provider_stability',
        currentValue: currentState.providerStability,
        threshold: providerThreshold,
        deviation: providerThreshold - currentState.providerStability
      })
    }

    // Retry rate
    const retryThreshold = 0.15
    if (currentState.retryRate > retryThreshold) {
      indicators.push({
        indicator: 'retry_rate',
        currentValue: currentState.retryRate,
        threshold: retryThreshold,
        deviation: currentState.retryRate - retryThreshold
      })
    }

    // Convergence score
    const convergenceThreshold = 0.6
    if (currentState.convergenceScore < convergenceThreshold) {
      indicators.push({
        indicator: 'convergence_score',
        currentValue: currentState.convergenceScore,
        threshold: convergenceThreshold,
        deviation: convergenceThreshold - currentState.convergenceScore
      })
    }

    // Entropy score
    const entropyThreshold = 0.5
    if (currentState.entropyScore > entropyThreshold) {
      indicators.push({
        indicator: 'entropy_score',
        currentValue: currentState.entropyScore,
        threshold: entropyThreshold,
        deviation: currentState.entropyScore - entropyThreshold
      })
    }

    return indicators
  }

  /**
   * Calculate confidence in trajectory analysis
   */
  private calculateConfidence(sampleSize: number, failureProbability: number): number {
    let confidence = 0

    if (sampleSize < 20) {
      confidence = 0.4
    } else if (sampleSize < 50) {
      confidence = 0.6
    } else if (sampleSize < 100) {
      confidence = 0.8
    } else {
      confidence = 0.9
    }

    // Higher confidence for more extreme probabilities
    if (failureProbability > 0.8 || failureProbability < 0.2) {
      confidence = Math.min(1.0, confidence + 0.1)
    }

    return confidence
  }
}

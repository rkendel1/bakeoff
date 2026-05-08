import type { EntropyForecast } from './types.js'
import type { OperationalTopologyStore } from '../store/OperationalTopologyStore.js'

/**
 * EntropyTrajectoryForecaster - Forecasts operational fragmentation
 * 
 * This predicts:
 * - Workflow fragmentation
 * - Operational branching explosion
 * - Convergence destabilization
 * 
 * This is the first form of:
 * - operational topology forecasting
 * 
 * Key insight:
 * Entropy doesn't just measure current complexity.
 * It predicts future operational coherence.
 * 
 * High entropy → fragmentation risk → operational instability
 */
export class EntropyTrajectoryForecaster {
  // Thresholds
  private readonly CONVERGING_THRESHOLD = -0.05  // Negative = improving
  private readonly DIVERGING_THRESHOLD = 0.05    // Positive = degrading
  private readonly FRAGMENTING_THRESHOLD = 0.15  // High = critical

  constructor(
    private readonly topologyStore: OperationalTopologyStore
  ) {}

  /**
   * Forecast entropy trajectory for a tenant
   */
  async forecastEntropy(tenantId: string): Promise<EntropyForecast | undefined> {
    // Get evolution metrics
    const metrics = await this.topologyStore.getEvolutionMetrics(tenantId)

    if (!metrics || metrics.snapshotCount < 5) {
      return undefined  // Not enough historical data
    }

    // Get latest snapshot
    const latestSnapshot = await this.topologyStore.getLatest(tenantId)
    if (!latestSnapshot) {
      return undefined
    }

    const currentEntropy = latestSnapshot.entropyScore

    // Calculate entropy velocity (rate of change)
    const entropyVelocity = this.calculateEntropyVelocity(metrics)

    // Predict future entropy
    const predictedEntropy24h = Math.max(
      0,
      Math.min(1.0, currentEntropy + (entropyVelocity * 1))  // 1 day
    )
    const predictedEntropy7d = Math.max(
      0,
      Math.min(1.0, currentEntropy + (entropyVelocity * 7))  // 7 days
    )

    // Determine trajectory
    const entropyTrajectory = this.determineTrajectory(
      currentEntropy,
      entropyVelocity,
      metrics
    )

    // Identify fragmentation risks
    const fragmentationRisks = this.identifyFragmentationRisks(
      currentEntropy,
      entropyVelocity,
      metrics
    )

    // Calculate convergence velocity
    const convergenceVelocity = this.calculateConvergenceVelocity(metrics, entropyVelocity)

    // Estimate time to stable convergence
    const timeToStableConvergence = this.estimateTimeToConvergence(
      currentEntropy,
      entropyVelocity,
      convergenceVelocity
    )

    // Calculate confidence
    const confidence = this.calculateConfidence(metrics.snapshotCount, entropyVelocity)

    return {
      tenantId,
      currentEntropy,
      predictedEntropy24h,
      predictedEntropy7d,
      entropyTrajectory,
      fragmentationRisks,
      convergenceVelocity,
      timeToStableConvergence,
      confidence,
      forecastedAt: new Date()
    }
  }

  /**
   * Calculate entropy velocity (rate of change per day)
   */
  private calculateEntropyVelocity(metrics: any): number {
    // Convert trend to numeric velocity
    if (metrics.entropyTrend === 'increasing') {
      // Use average entropy to estimate rate
      // Higher average = faster increase potential
      return 0.02 + (metrics.averageEntropy * 0.01)
    } else if (metrics.entropyTrend === 'decreasing') {
      return -0.02 - ((1 - metrics.averageEntropy) * 0.01)
    } else {
      return 0  // Stable
    }
  }

  /**
   * Determine entropy trajectory
   */
  private determineTrajectory(
    currentEntropy: number,
    entropyVelocity: number,
    metrics: any
  ): 'converging' | 'stable' | 'diverging' | 'fragmenting' {
    // Fragmenting: high entropy + increasing rapidly
    if (currentEntropy > 0.7 && entropyVelocity > this.FRAGMENTING_THRESHOLD) {
      return 'fragmenting'
    }

    // Diverging: entropy increasing
    if (entropyVelocity > this.DIVERGING_THRESHOLD) {
      return 'diverging'
    }

    // Converging: entropy decreasing
    if (entropyVelocity < this.CONVERGING_THRESHOLD) {
      return 'converging'
    }

    // Stable: minimal change
    return 'stable'
  }

  /**
   * Identify fragmentation risks
   */
  private identifyFragmentationRisks(
    currentEntropy: number,
    entropyVelocity: number,
    metrics: any
  ): Array<{
    riskType: string
    probability: number
    impact: string
  }> {
    const risks: Array<{
      riskType: string
      probability: number
      impact: string
    }> = []

    // High entropy risk
    if (currentEntropy > 0.6) {
      risks.push({
        riskType: 'high_operational_complexity',
        probability: 0.7,
        impact: 'Execution paths are highly fragmented, reducing operational predictability'
      })
    }

    // Increasing entropy risk
    if (entropyVelocity > this.DIVERGING_THRESHOLD) {
      risks.push({
        riskType: 'diverging_behavior',
        probability: 0.6,
        impact: 'Operational behavior is diverging, increasing maintenance complexity'
      })
    }

    // Low convergence risk
    if (metrics.averageConfidence < 0.5) {
      risks.push({
        riskType: 'low_canonical_confidence',
        probability: 0.65,
        impact: 'Execution behavior is not converging toward stable patterns'
      })
    }

    // Rapid fragmentation risk
    if (currentEntropy > 0.7 && entropyVelocity > this.FRAGMENTING_THRESHOLD) {
      risks.push({
        riskType: 'operational_fragmentation',
        probability: 0.85,
        impact: 'Critical: Operational topology is fragmenting rapidly'
      })
    }

    return risks
  }

  /**
   * Calculate convergence velocity
   * Positive = converging, negative = diverging
   */
  private calculateConvergenceVelocity(
    metrics: any,
    entropyVelocity: number
  ): number {
    // Convergence velocity is inverse of entropy velocity
    let convergenceVelocity = -entropyVelocity

    // Adjust based on confidence trend
    if (metrics.confidenceTrend === 'increasing') {
      convergenceVelocity += 0.02
    } else if (metrics.confidenceTrend === 'decreasing') {
      convergenceVelocity -= 0.02
    }

    return convergenceVelocity
  }

  /**
   * Estimate time to stable convergence
   */
  private estimateTimeToConvergence(
    currentEntropy: number,
    entropyVelocity: number,
    convergenceVelocity: number
  ): string | undefined {
    // Only estimate if converging
    if (convergenceVelocity <= 0) {
      return undefined  // Not converging
    }

    // Target entropy for "stable"
    const targetEntropy = 0.3

    if (currentEntropy <= targetEntropy) {
      return undefined  // Already stable
    }

    // Calculate days to reach target
    const entropyToReduce = currentEntropy - targetEntropy
    const daysToConvergence = entropyToReduce / Math.abs(entropyVelocity)

    if (daysToConvergence < 7) {
      return `${Math.ceil(daysToConvergence)}d`
    } else if (daysToConvergence < 30) {
      return `${Math.ceil(daysToConvergence / 7)}w`
    } else if (daysToConvergence < 365) {
      return `${Math.ceil(daysToConvergence / 30)}mo`
    } else {
      return '>1y'
    }
  }

  /**
   * Calculate confidence in forecast
   */
  private calculateConfidence(snapshotCount: number, entropyVelocity: number): number {
    let confidence = 0

    // Base on snapshot count
    if (snapshotCount < 5) {
      confidence = 0.3
    } else if (snapshotCount < 10) {
      confidence = 0.5
    } else if (snapshotCount < 20) {
      confidence = 0.7
    } else {
      confidence = 0.85
    }

    // Higher confidence for more extreme velocities (clearer trends)
    if (Math.abs(entropyVelocity) > 0.1) {
      confidence = Math.min(1.0, confidence + 0.1)
    }

    return confidence
  }
}

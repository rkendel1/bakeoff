import type { OperationalTopologySnapshot } from '../intelligence/types.js'

/**
 * OperationalTopologyStore - Persistent storage for operational topology snapshots
 * 
 * This store maintains a history of operational topology snapshots over time,
 * allowing the runtime to track:
 * - How operational behavior evolves
 * - Whether complexity is increasing or decreasing
 * - Whether canonical convergence is improving
 * - How organizational behavior changes over time
 * 
 * This enables:
 * - Temporal analysis of operational maturity
 * - Trend detection in organizational behavior
 * - Learning from operational evolution
 */
export class OperationalTopologyStore {
  private readonly snapshots = new Map<string, OperationalTopologySnapshot[]>()

  /**
   * Store a topology snapshot for a tenant
   */
  async store(snapshot: OperationalTopologySnapshot): Promise<void> {
    const existing = this.snapshots.get(snapshot.tenantId) || []
    existing.push(snapshot)
    this.snapshots.set(snapshot.tenantId, existing)
  }

  /**
   * Get the latest topology snapshot for a tenant
   */
  async getLatest(tenantId: string): Promise<OperationalTopologySnapshot | undefined> {
    const snapshots = this.snapshots.get(tenantId)
    if (!snapshots || snapshots.length === 0) {
      return undefined
    }
    return snapshots[snapshots.length - 1]
  }

  /**
   * Get all topology snapshots for a tenant (ordered by time)
   */
  async getHistory(tenantId: string): Promise<OperationalTopologySnapshot[]> {
    return this.snapshots.get(tenantId) || []
  }

  /**
   * Get topology snapshots within a time range
   */
  async getRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OperationalTopologySnapshot[]> {
    const snapshots = this.snapshots.get(tenantId) || []
    return snapshots.filter((s) => {
      const date = new Date(s.generatedAt)
      return date >= startDate && date <= endDate
    })
  }

  /**
   * Calculate topology evolution metrics
   * Returns metrics showing how topology has changed over time
   */
  async getEvolutionMetrics(tenantId: string): Promise<{
    snapshotCount: number
    entropyTrend: 'increasing' | 'decreasing' | 'stable'
    complexityTrend: 'increasing' | 'decreasing' | 'stable'
    confidenceTrend: 'increasing' | 'decreasing' | 'stable'
    averageEntropy: number
    averageComplexity: number
    averageConfidence: number
  } | undefined> {
    const snapshots = this.snapshots.get(tenantId)
    if (!snapshots || snapshots.length === 0) {
      return undefined
    }

    const snapshotCount = snapshots.length

    // Calculate averages
    const totalEntropy = snapshots.reduce((sum, s) => sum + s.entropyScore, 0)
    const totalComplexity = snapshots.reduce(
      (sum, s) => sum + s.operationalComplexity,
      0
    )
    const totalConfidence = snapshots.reduce(
      (sum, s) => sum + s.canonicalConfidence,
      0
    )

    const averageEntropy = totalEntropy / snapshotCount
    const averageComplexity = totalComplexity / snapshotCount
    const averageConfidence = totalConfidence / snapshotCount

    // Calculate trends (compare first half to second half)
    const midpoint = Math.floor(snapshotCount / 2)
    const firstHalf = snapshots.slice(0, midpoint)
    const secondHalf = snapshots.slice(midpoint)

    const entropyTrend = this.calculateTrend(
      firstHalf.map((s) => s.entropyScore),
      secondHalf.map((s) => s.entropyScore)
    )
    const complexityTrend = this.calculateTrend(
      firstHalf.map((s) => s.operationalComplexity),
      secondHalf.map((s) => s.operationalComplexity)
    )
    const confidenceTrend = this.calculateTrend(
      firstHalf.map((s) => s.canonicalConfidence),
      secondHalf.map((s) => s.canonicalConfidence)
    )

    return {
      snapshotCount,
      entropyTrend,
      complexityTrend,
      confidenceTrend,
      averageEntropy,
      averageComplexity,
      averageConfidence
    }
  }

  /**
   * Calculate trend direction by comparing two sets of values
   */
  private calculateTrend(
    firstHalf: number[],
    secondHalf: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return 'stable'
    }

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length

    const diff = secondAvg - firstAvg
    const threshold = 0.05 // 5% change threshold

    if (diff > threshold) {
      return 'increasing'
    } else if (diff < -threshold) {
      return 'decreasing'
    } else {
      return 'stable'
    }
  }

  /**
   * Clear all snapshots for a tenant (useful for testing)
   */
  async clear(tenantId: string): Promise<void> {
    this.snapshots.delete(tenantId)
  }

  /**
   * Get all tenants with stored topology snapshots
   */
  async getAllTenants(): Promise<string[]> {
    return Array.from(this.snapshots.keys())
  }
}

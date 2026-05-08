import type { 
  RuntimeMemoryRecord, 
  MemoryQuery, 
  StrategyPattern 
} from './types.js'

/**
 * RuntimeMemoryStore - Persistent operational memory
 * 
 * This is the foundation of learned execution strategies.
 * 
 * Stores:
 * - Governance decisions
 * - Adaptive actions
 * - Execution outcomes
 * - Strategy effectiveness
 * - Convergence improvements
 * - Provider recovery patterns
 * 
 * Enables:
 * - Experience-informed governance
 * - Learned operational strategies
 * - Tenant-specific execution heuristics
 * - Effectiveness tracking over time
 */
export class RuntimeMemoryStore {
  // Effectiveness scoring weights
  private static readonly WEIGHT_SUCCESS_RATE = 0.4
  private static readonly WEIGHT_RETRY_REDUCTION = 0.2
  private static readonly WEIGHT_CONVERGENCE_GAIN = 0.2
  private static readonly WEIGHT_ENTROPY_REDUCTION = 0.2
  
  // Trend detection threshold
  private static readonly TREND_CHANGE_THRESHOLD = 0.1
  
  // Minimum records needed for trend analysis
  private static readonly MIN_RECORDS_FOR_TREND_ANALYSIS = 4

  private readonly records = new Map<string, RuntimeMemoryRecord>()
  private readonly tenantIndex = new Map<string, string[]>()
  private readonly strategyIndex = new Map<string, string[]>()  // strategy -> record IDs
  private readonly triggerIndex = new Map<string, string[]>()   // triggerType -> record IDs

  /**
   * Store a runtime memory record
   */
  async store(record: RuntimeMemoryRecord): Promise<void> {
    this.records.set(record.id, record)

    // Index by tenant
    const tenantRecords = this.tenantIndex.get(record.tenantId) || []
    tenantRecords.push(record.id)
    this.tenantIndex.set(record.tenantId, tenantRecords)

    // Index by strategy
    const strategy = record.decision.strategyApplied
    const strategyRecords = this.strategyIndex.get(strategy) || []
    strategyRecords.push(record.id)
    this.strategyIndex.set(strategy, strategyRecords)

    // Index by trigger type
    const triggerKey = `${record.tenantId}:${record.trigger.type}`
    const triggerRecords = this.triggerIndex.get(triggerKey) || []
    triggerRecords.push(record.id)
    this.triggerIndex.set(triggerKey, triggerRecords)
  }

  /**
   * Get a specific memory record
   */
  async get(id: string): Promise<RuntimeMemoryRecord | undefined> {
    return this.records.get(id)
  }

  /**
   * Query memory records
   */
  async query(query: MemoryQuery): Promise<RuntimeMemoryRecord[]> {
    let recordIds: string[] = []

    // Start with tenant records
    recordIds = this.tenantIndex.get(query.tenantId) || []

    // Filter by trigger type if specified
    if (query.triggerType) {
      const triggerKey = `${query.tenantId}:${query.triggerType}`
      const triggerRecords = this.triggerIndex.get(triggerKey) || []
      recordIds = recordIds.filter((id) => triggerRecords.includes(id))
    }

    // Get actual records
    let records = recordIds
      .map((id) => this.records.get(id))
      .filter((r): r is RuntimeMemoryRecord => r !== undefined)

    // Filter by strategy if specified
    if (query.strategyApplied) {
      records = records.filter((r) => 
        r.decision.strategyApplied === query.strategyApplied
      )
    }

    // Filter by effectiveness if specified
    if (query.minEffectiveness !== undefined) {
      records = records.filter((r) => 
        r.effectiveness.score >= query.minEffectiveness!
      )
    }

    // Filter by date range
    if (query.startDate) {
      records = records.filter((r) => r.createdAt >= query.startDate!)
    }
    if (query.endDate) {
      records = records.filter((r) => r.createdAt <= query.endDate!)
    }

    // Sort by most recent first
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Apply limit
    if (query.limit) {
      records = records.slice(0, query.limit)
    }

    return records
  }

  /**
   * Get all memory records for a tenant
   */
  async getByTenant(tenantId: string): Promise<RuntimeMemoryRecord[]> {
    return this.query({ tenantId })
  }

  /**
   * Get recent memory records for a tenant
   */
  async getRecent(tenantId: string, limit: number = 50): Promise<RuntimeMemoryRecord[]> {
    return this.query({ tenantId, limit })
  }

  /**
   * Get memory records for a specific trigger type
   */
  async getByTrigger(
    tenantId: string, 
    triggerType: string
  ): Promise<RuntimeMemoryRecord[]> {
    return this.query({ tenantId, triggerType })
  }

  /**
   * Get memory records for a specific strategy
   */
  async getByStrategy(
    tenantId: string, 
    strategyApplied: string
  ): Promise<RuntimeMemoryRecord[]> {
    return this.query({ tenantId, strategyApplied })
  }

  /**
   * Get most effective strategies for a trigger type
   */
  async getMostEffectiveStrategies(
    tenantId: string,
    triggerType: string,
    limit: number = 5
  ): Promise<StrategyPattern[]> {
    const records = await this.getByTrigger(tenantId, triggerType)

    // Group by strategy
    const strategyGroups = new Map<string, RuntimeMemoryRecord[]>()
    for (const record of records) {
      const strategy = record.decision.strategyApplied
      const group = strategyGroups.get(strategy) || []
      group.push(record)
      strategyGroups.set(strategy, group)
    }

    // Calculate effectiveness for each strategy
    const patterns: StrategyPattern[] = []
    for (const [strategy, groupRecords] of strategyGroups) {
      if (groupRecords.length === 0) continue

      const successfulExecutions = groupRecords.filter(
        (r) => r.outcome.status === 'completed'
      ).length
      const successRate = successfulExecutions / groupRecords.length

      const avgRetryReduction = this.average(
        groupRecords.map((r) => r.effectiveness.factors.retryReduction)
      )
      const avgConvergenceGain = this.average(
        groupRecords.map((r) => r.effectiveness.factors.convergenceGain)
      )
      const avgEntropyReduction = this.average(
        groupRecords.map((r) => r.effectiveness.factors.entropyReduction)
      )

      // Overall effectiveness score (weighted average)
      const effectivenessScore = 
        successRate * RuntimeMemoryStore.WEIGHT_SUCCESS_RATE +
        avgRetryReduction * RuntimeMemoryStore.WEIGHT_RETRY_REDUCTION +
        avgConvergenceGain * RuntimeMemoryStore.WEIGHT_CONVERGENCE_GAIN +
        avgEntropyReduction * RuntimeMemoryStore.WEIGHT_ENTROPY_REDUCTION

      // Calculate trend (compare first half vs second half)
      const trend = this.calculateTrend(groupRecords)

      const lastApplied = groupRecords.reduce((latest, r) => {
        return r.createdAt > latest ? r.createdAt : latest
      }, groupRecords[0].createdAt)

      patterns.push({
        strategyName: strategy,
        triggerType,
        timesApplied: groupRecords.length,
        successRate,
        averageRetryReduction: avgRetryReduction,
        averageConvergenceGain: avgConvergenceGain,
        averageEntropyReduction: avgEntropyReduction,
        effectivenessScore,
        recentTrend: trend,
        lastApplied
      })
    }

    // Sort by effectiveness and return top N
    return patterns
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, limit)
  }

  /**
   * Calculate trend from records
   */
  private calculateTrend(
    records: RuntimeMemoryRecord[]
  ): 'improving' | 'stable' | 'declining' {
    if (records.length < RuntimeMemoryStore.MIN_RECORDS_FOR_TREND_ANALYSIS) {
      return 'stable'
    }

    const sorted = [...records].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )

    const midpoint = Math.floor(sorted.length / 2)
    const firstHalf = sorted.slice(0, midpoint)
    const secondHalf = sorted.slice(midpoint)

    const avgFirst = this.average(firstHalf.map((r) => r.effectiveness.score))
    const avgSecond = this.average(secondHalf.map((r) => r.effectiveness.score))

    const change = avgSecond - avgFirst

    if (change > RuntimeMemoryStore.TREND_CHANGE_THRESHOLD) return 'improving'
    if (change < -RuntimeMemoryStore.TREND_CHANGE_THRESHOLD) return 'declining'
    return 'stable'
  }

  /**
   * Calculate average of numbers
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  }

  /**
   * Get total memory records for a tenant
   */
  async getMemoryCount(tenantId: string): Promise<number> {
    const records = this.tenantIndex.get(tenantId) || []
    return records.length
  }

  /**
   * Clear all memory records for a tenant (useful for testing)
   */
  async clear(tenantId: string): Promise<void> {
    const recordIds = this.tenantIndex.get(tenantId) || []
    
    for (const id of recordIds) {
      const record = this.records.get(id)
      if (!record) continue

      // Remove from main storage
      this.records.delete(id)

      // Remove from strategy index
      const strategyRecords = this.strategyIndex.get(record.decision.strategyApplied) || []
      this.strategyIndex.set(
        record.decision.strategyApplied,
        strategyRecords.filter((rid) => rid !== id)
      )

      // Remove from trigger index
      const triggerKey = `${tenantId}:${record.trigger.type}`
      const triggerRecords = this.triggerIndex.get(triggerKey) || []
      this.triggerIndex.set(
        triggerKey,
        triggerRecords.filter((rid) => rid !== id)
      )
    }

    // Clear tenant index
    this.tenantIndex.delete(tenantId)
  }

  /**
   * Get all tenants with memory records
   */
  async getAllTenants(): Promise<string[]> {
    return Array.from(this.tenantIndex.keys())
  }
}

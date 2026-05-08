import type { GoalOutcome } from './types.js'

/**
 * StrategyOutcomeStore - Persistent storage for goal execution outcomes
 * 
 * This stores the historical results of strategy executions,
 * which is used by GoalPlanner and GoalOutcomeEvaluator
 * to learn which strategies work best.
 * 
 * This is the learning foundation for goal-oriented runtime.
 */
export class StrategyOutcomeStore {
  private outcomes: Map<string, GoalOutcome> = new Map()
  private outcomesByTenant: Map<string, Set<string>> = new Map()
  private outcomesByGoal: Map<string, Set<string>> = new Map()
  private outcomesByStrategy: Map<string, Set<string>> = new Map()

  /**
   * Store a goal execution outcome
   */
  async storeOutcome(outcome: GoalOutcome): Promise<void> {
    this.outcomes.set(outcome.id, outcome)
    
    // Index by tenant
    if (!this.outcomesByTenant.has(outcome.tenantId)) {
      this.outcomesByTenant.set(outcome.tenantId, new Set())
    }
    this.outcomesByTenant.get(outcome.tenantId)!.add(outcome.id)
    
    // Index by goal
    if (!this.outcomesByGoal.has(outcome.goalId)) {
      this.outcomesByGoal.set(outcome.goalId, new Set())
    }
    this.outcomesByGoal.get(outcome.goalId)!.add(outcome.id)
    
    // Index by strategy (composite key: tenantId:goalId:strategy)
    const strategyKey = `${outcome.tenantId}:${outcome.goalId}:${outcome.strategyUsed}`
    if (!this.outcomesByStrategy.has(strategyKey)) {
      this.outcomesByStrategy.set(strategyKey, new Set())
    }
    this.outcomesByStrategy.get(strategyKey)!.add(outcome.id)
  }

  /**
   * Get an outcome by ID
   */
  async getOutcome(id: string): Promise<GoalOutcome | undefined> {
    return this.outcomes.get(id)
  }

  /**
   * Get all outcomes for a tenant
   */
  async getOutcomesForTenant(tenantId: string): Promise<GoalOutcome[]> {
    const outcomeIds = this.outcomesByTenant.get(tenantId) || new Set()
    const outcomes: GoalOutcome[] = []
    
    for (const id of outcomeIds) {
      const outcome = this.outcomes.get(id)
      if (outcome) {
        outcomes.push(outcome)
      }
    }
    
    // Sort by completion time (most recent first)
    return outcomes.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  }

  /**
   * Get all outcomes for a specific goal
   */
  async getOutcomesForGoal(tenantId: string, goalId: string): Promise<GoalOutcome[]> {
    const outcomeIds = this.outcomesByGoal.get(goalId) || new Set()
    const outcomes: GoalOutcome[] = []
    
    for (const id of outcomeIds) {
      const outcome = this.outcomes.get(id)
      if (outcome && outcome.tenantId === tenantId) {
        outcomes.push(outcome)
      }
    }
    
    // Sort by completion time (most recent first)
    return outcomes.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  }

  /**
   * Get all outcomes for a specific strategy
   * 
   * This is critical for learning strategy effectiveness.
   */
  async getOutcomesForStrategy(
    tenantId: string,
    goalId: string,
    strategyName: string
  ): Promise<GoalOutcome[]> {
    const strategyKey = `${tenantId}:${goalId}:${strategyName}`
    const outcomeIds = this.outcomesByStrategy.get(strategyKey) || new Set()
    const outcomes: GoalOutcome[] = []
    
    for (const id of outcomeIds) {
      const outcome = this.outcomes.get(id)
      if (outcome) {
        outcomes.push(outcome)
      }
    }
    
    // Sort by completion time (most recent first)
    return outcomes.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  }

  /**
   * Get recent outcomes (last N)
   */
  async getRecentOutcomes(tenantId: string, limit: number = 50): Promise<GoalOutcome[]> {
    const outcomes = await this.getOutcomesForTenant(tenantId)
    return outcomes.slice(0, limit)
  }

  /**
   * Get successful outcomes only
   */
  async getSuccessfulOutcomes(tenantId: string, goalId?: string): Promise<GoalOutcome[]> {
    let outcomes: GoalOutcome[]
    
    if (goalId) {
      outcomes = await this.getOutcomesForGoal(tenantId, goalId)
    } else {
      outcomes = await this.getOutcomesForTenant(tenantId)
    }
    
    return outcomes.filter(o => o.goalAchieved)
  }

  /**
   * Get failed outcomes only
   */
  async getFailedOutcomes(tenantId: string, goalId?: string): Promise<GoalOutcome[]> {
    let outcomes: GoalOutcome[]
    
    if (goalId) {
      outcomes = await this.getOutcomesForGoal(tenantId, goalId)
    } else {
      outcomes = await this.getOutcomesForTenant(tenantId)
    }
    
    return outcomes.filter(o => !o.goalAchieved)
  }

  /**
   * Query outcomes with filters
   */
  async queryOutcomes(params: {
    tenantId: string
    goalId?: string
    strategyUsed?: string
    goalAchieved?: boolean
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<GoalOutcome[]> {
    let outcomes = await this.getOutcomesForTenant(params.tenantId)
    
    // Filter by goal
    if (params.goalId) {
      outcomes = outcomes.filter(o => o.goalId === params.goalId)
    }
    
    // Filter by strategy
    if (params.strategyUsed) {
      outcomes = outcomes.filter(o => o.strategyUsed === params.strategyUsed)
    }
    
    // Filter by success
    if (params.goalAchieved !== undefined) {
      outcomes = outcomes.filter(o => o.goalAchieved === params.goalAchieved)
    }
    
    // Filter by date range
    if (params.startDate) {
      outcomes = outcomes.filter(o => o.completedAt >= params.startDate!)
    }
    if (params.endDate) {
      outcomes = outcomes.filter(o => o.completedAt <= params.endDate!)
    }
    
    // Apply limit
    if (params.limit) {
      outcomes = outcomes.slice(0, params.limit)
    }
    
    return outcomes
  }

  /**
   * Delete old outcomes (retention policy)
   */
  async deleteOutcomesBefore(date: Date): Promise<number> {
    let deletedCount = 0
    
    for (const [id, outcome] of this.outcomes.entries()) {
      if (outcome.completedAt < date) {
        this.outcomes.delete(id)
        deletedCount++
        
        // Remove from indexes
        this.outcomesByTenant.get(outcome.tenantId)?.delete(id)
        this.outcomesByGoal.get(outcome.goalId)?.delete(id)
        
        const strategyKey = `${outcome.tenantId}:${outcome.goalId}:${outcome.strategyUsed}`
        this.outcomesByStrategy.get(strategyKey)?.delete(id)
      }
    }
    
    return deletedCount
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalOutcomes: number
    successfulOutcomes: number
    failedOutcomes: number
    averageExecutionTimeMs: number
    averageRetries: number
  } {
    const allOutcomes = Array.from(this.outcomes.values())
    const successfulOutcomes = allOutcomes.filter(o => o.goalAchieved)
    
    const avgExecutionTime = allOutcomes.length > 0
      ? allOutcomes.reduce((sum, o) => sum + o.totalExecutionTimeMs, 0) / allOutcomes.length
      : 0
    
    const avgRetries = allOutcomes.length > 0
      ? allOutcomes.reduce((sum, o) => sum + o.retryCount, 0) / allOutcomes.length
      : 0
    
    return {
      totalOutcomes: allOutcomes.length,
      successfulOutcomes: successfulOutcomes.length,
      failedOutcomes: allOutcomes.length - successfulOutcomes.length,
      averageExecutionTimeMs: avgExecutionTime,
      averageRetries: avgRetries
    }
  }
}

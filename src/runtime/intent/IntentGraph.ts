import type { GoalDefinition, StrategyDefinition } from './types.js'

/**
 * IntentGraph - Operational goals and their relationships
 * 
 * This is the foundational layer of intent-oriented runtime.
 * 
 * The graph represents:
 * - Operational goals
 * - Strategies to achieve goals
 * - Relationships between goals
 * - Dependencies and priorities
 * 
 * This transforms the runtime from:
 *   workflow executor
 * to:
 *   goal-oriented operational system
 */
export class IntentGraph {
  private goals: Map<string, GoalDefinition> = new Map()
  private strategies: Map<string, StrategyDefinition> = new Map()
  private goalsByTenant: Map<string, Set<string>> = new Map()
  private strategiesByGoal: Map<string, Set<string>> = new Map()

  /**
   * Register an operational goal
   */
  registerGoal(goal: GoalDefinition): void {
    this.goals.set(goal.id, goal)
    
    // Index by tenant
    if (!this.goalsByTenant.has(goal.tenantId)) {
      this.goalsByTenant.set(goal.tenantId, new Set())
    }
    this.goalsByTenant.get(goal.tenantId)!.add(goal.id)
    
    // Initialize strategy index for this goal
    if (!this.strategiesByGoal.has(goal.id)) {
      this.strategiesByGoal.set(goal.id, new Set())
    }
  }

  /**
   * Register a strategy for achieving a goal
   */
  registerStrategy(strategy: StrategyDefinition): void {
    this.strategies.set(strategy.id, strategy)
    
    // Index by goal
    if (!this.strategiesByGoal.has(strategy.goalId)) {
      this.strategiesByGoal.set(strategy.goalId, new Set())
    }
    this.strategiesByGoal.get(strategy.goalId)!.add(strategy.id)
  }

  /**
   * Get a goal by ID
   */
  getGoal(goalId: string): GoalDefinition | undefined {
    return this.goals.get(goalId)
  }

  /**
   * Get a strategy by ID
   */
  getStrategy(strategyId: string): StrategyDefinition | undefined {
    return this.strategies.get(strategyId)
  }

  /**
   * Get all goals for a tenant
   */
  getGoalsForTenant(tenantId: string): GoalDefinition[] {
    const goalIds = this.goalsByTenant.get(tenantId) || new Set()
    const goals: GoalDefinition[] = []
    
    for (const goalId of goalIds) {
      const goal = this.goals.get(goalId)
      if (goal) {
        goals.push(goal)
      }
    }
    
    return goals
  }

  /**
   * Get all strategies for a goal
   */
  getStrategiesForGoal(goalId: string): StrategyDefinition[] {
    const strategyIds = this.strategiesByGoal.get(goalId) || new Set()
    const strategies: StrategyDefinition[] = []
    
    for (const strategyId of strategyIds) {
      const strategy = this.strategies.get(strategyId)
      if (strategy) {
        strategies.push(strategy)
      }
    }
    
    return strategies
  }

  /**
   * Find goal by name
   */
  findGoalByName(tenantId: string, goalName: string): GoalDefinition | undefined {
    const goals = this.getGoalsForTenant(tenantId)
    return goals.find(g => g.goal === goalName)
  }

  /**
   * Find strategy by name
   */
  findStrategyByName(goalId: string, strategyName: string): StrategyDefinition | undefined {
    const strategies = this.getStrategiesForGoal(goalId)
    return strategies.find(s => s.strategyName === strategyName)
  }

  /**
   * Get all goals (for admin/debugging)
   */
  getAllGoals(): GoalDefinition[] {
    return Array.from(this.goals.values())
  }

  /**
   * Get all strategies (for admin/debugging)
   */
  getAllStrategies(): StrategyDefinition[] {
    return Array.from(this.strategies.values())
  }

  /**
   * Remove a goal (and its strategies)
   */
  removeGoal(goalId: string): void {
    const goal = this.goals.get(goalId)
    if (!goal) return
    
    // Remove from tenant index
    const tenantGoals = this.goalsByTenant.get(goal.tenantId)
    if (tenantGoals) {
      tenantGoals.delete(goalId)
    }
    
    // Remove all strategies for this goal
    const strategyIds = this.strategiesByGoal.get(goalId) || new Set()
    for (const strategyId of strategyIds) {
      this.strategies.delete(strategyId)
    }
    
    // Remove strategy index
    this.strategiesByGoal.delete(goalId)
    
    // Remove goal
    this.goals.delete(goalId)
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategyId: string): void {
    const strategy = this.strategies.get(strategyId)
    if (!strategy) return
    
    // Remove from goal index
    const goalStrategies = this.strategiesByGoal.get(strategy.goalId)
    if (goalStrategies) {
      goalStrategies.delete(strategyId)
    }
    
    // Remove strategy
    this.strategies.delete(strategyId)
  }

  /**
   * Get operational graph statistics
   */
  getStats(): {
    totalGoals: number
    totalStrategies: number
    goalsByPriority: Record<string, number>
    averageStrategiesPerGoal: number
  } {
    const goalsByPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
    
    for (const goal of this.goals.values()) {
      goalsByPriority[goal.priority]++
    }
    
    const totalStrategies = this.strategies.size
    const totalGoals = this.goals.size
    
    return {
      totalGoals,
      totalStrategies,
      goalsByPriority,
      averageStrategiesPerGoal: totalGoals > 0 ? totalStrategies / totalGoals : 0
    }
  }
}

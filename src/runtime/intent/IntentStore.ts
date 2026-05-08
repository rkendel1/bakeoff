import type { GoalDefinition, StrategyDefinition } from './types.js'

/**
 * IntentStore - Persistent storage for goals and strategies
 * 
 * This stores the operational intent definitions:
 * - Goals (what the runtime tries to achieve)
 * - Strategies (how goals are achieved)
 * 
 * This is the persistent foundation of the intent layer.
 */
export class IntentStore {
  private goals: Map<string, GoalDefinition> = new Map()
  private strategies: Map<string, StrategyDefinition> = new Map()

  /**
   * Store a goal definition
   */
  async storeGoal(goal: GoalDefinition): Promise<void> {
    this.goals.set(goal.id, goal)
  }

  /**
   * Get a goal by ID
   */
  async getGoal(id: string): Promise<GoalDefinition | undefined> {
    return this.goals.get(id)
  }

  /**
   * Get all goals for a tenant
   */
  async getGoalsForTenant(tenantId: string): Promise<GoalDefinition[]> {
    const goals: GoalDefinition[] = []
    
    for (const goal of this.goals.values()) {
      if (goal.tenantId === tenantId) {
        goals.push(goal)
      }
    }
    
    return goals
  }

  /**
   * Update a goal
   */
  async updateGoal(id: string, updates: Partial<GoalDefinition>): Promise<void> {
    const goal = this.goals.get(id)
    if (!goal) {
      throw new Error(`Goal ${id} not found`)
    }
    
    this.goals.set(id, {
      ...goal,
      ...updates,
      updatedAt: new Date()
    })
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<void> {
    this.goals.delete(id)
  }

  /**
   * Store a strategy definition
   */
  async storeStrategy(strategy: StrategyDefinition): Promise<void> {
    this.strategies.set(strategy.id, strategy)
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(id: string): Promise<StrategyDefinition | undefined> {
    return this.strategies.get(id)
  }

  /**
   * Get all strategies for a goal
   */
  async getStrategiesForGoal(goalId: string): Promise<StrategyDefinition[]> {
    const strategies: StrategyDefinition[] = []
    
    for (const strategy of this.strategies.values()) {
      if (strategy.goalId === goalId) {
        strategies.push(strategy)
      }
    }
    
    return strategies
  }

  /**
   * Update a strategy
   */
  async updateStrategy(id: string, updates: Partial<StrategyDefinition>): Promise<void> {
    const strategy = this.strategies.get(id)
    if (!strategy) {
      throw new Error(`Strategy ${id} not found`)
    }
    
    this.strategies.set(id, {
      ...strategy,
      ...updates,
      updatedAt: new Date()
    })
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(id: string): Promise<void> {
    this.strategies.delete(id)
  }

  /**
   * Get all goals (admin/debugging)
   */
  async getAllGoals(): Promise<GoalDefinition[]> {
    return Array.from(this.goals.values())
  }

  /**
   * Get all strategies (admin/debugging)
   */
  async getAllStrategies(): Promise<StrategyDefinition[]> {
    return Array.from(this.strategies.values())
  }
}

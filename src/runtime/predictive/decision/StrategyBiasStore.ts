import type { StrategyBias } from './types.js'

/**
 * StrategyBiasStore - Persistence for learned strategy biases
 * 
 * This stores the learned differences between predicted and actual
 * strategy performance, enabling real-time bias correction at decision-time.
 * 
 * Key insight:
 * Historical bias = evidence of systematic prediction error
 * → Use this to correct future predictions BEFORE execution
 */
export class StrategyBiasStore {
  // In-memory storage (would be persistent in production)
  private biases: Map<string, StrategyBias> = new Map()
  
  /**
   * Record or update strategy bias
   */
  async recordBias(bias: StrategyBias): Promise<void> {
    const key = this.makeKey(bias.tenantId, bias.goalId, bias.strategyName)
    this.biases.set(key, bias)
  }
  
  /**
   * Get bias for a specific strategy
   */
  async getBias(
    tenantId: string,
    goalId: string,
    strategyName: string
  ): Promise<StrategyBias | null> {
    const key = this.makeKey(tenantId, goalId, strategyName)
    return this.biases.get(key) || null
  }
  
  /**
   * Get all biases for a tenant
   */
  async getBiasesForTenant(tenantId: string): Promise<StrategyBias[]> {
    const results: StrategyBias[] = []
    
    for (const [key, bias] of this.biases) {
      if (bias.tenantId === tenantId) {
        results.push(bias)
      }
    }
    
    return results
  }
  
  /**
   * Get all biases for a goal
   */
  async getBiasesForGoal(
    tenantId: string,
    goalId: string
  ): Promise<StrategyBias[]> {
    const results: StrategyBias[] = []
    
    for (const [key, bias] of this.biases) {
      if (bias.tenantId === tenantId && bias.goalId === goalId) {
        results.push(bias)
      }
    }
    
    return results
  }
  
  /**
   * Get strategies to avoid (high negative bias)
   */
  async getStrategiesToAvoid(
    tenantId: string,
    goalId: string
  ): Promise<string[]> {
    const biases = await this.getBiasesForGoal(tenantId, goalId)
    
    return biases
      .filter(b => b.recommendAvoid)
      .map(b => b.strategyName)
  }
  
  /**
   * Get strategies to prefer (high positive bias)
   */
  async getStrategiesToPrefer(
    tenantId: string,
    goalId: string
  ): Promise<string[]> {
    const biases = await this.getBiasesForGoal(tenantId, goalId)
    
    return biases
      .filter(b => b.recommendPrefer)
      .map(b => b.strategyName)
  }
  
  /**
   * Clear old biases
   */
  async clearOldBiases(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    let cleared = 0
    const now = Date.now()
    
    for (const [key, bias] of this.biases) {
      if (now - bias.lastUpdated.getTime() > olderThanMs) {
        this.biases.delete(key)
        cleared++
      }
    }
    
    return cleared
  }
  
  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalBiases: number
    tenantsWithBiases: number
    averageSampleSize: number
  }> {
    const tenants = new Set<string>()
    let totalSampleSize = 0
    
    for (const bias of this.biases.values()) {
      tenants.add(bias.tenantId)
      totalSampleSize += bias.sampleSize
    }
    
    return {
      totalBiases: this.biases.size,
      tenantsWithBiases: tenants.size,
      averageSampleSize: this.biases.size > 0 ? totalSampleSize / this.biases.size : 0
    }
  }
  
  /**
   * Make storage key
   */
  private makeKey(tenantId: string, goalId: string, strategyName: string): string {
    return `${tenantId}:${goalId}:${strategyName}`
  }
}

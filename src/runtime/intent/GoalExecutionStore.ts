import type { OperationalIntent } from './types.js'

/**
 * GoalExecutionStore - Persistent storage for operational intent tracking
 * 
 * This stores the runtime state of goals being pursued.
 * Each OperationalIntent represents an active goal execution.
 * 
 * This is the operational state layer of intent execution.
 */
export class GoalExecutionStore {
  private intents: Map<string, OperationalIntent> = new Map()
  private intentsByTenant: Map<string, Set<string>> = new Map()
  private intentsByGoal: Map<string, Set<string>> = new Map()
  private intentsByEntity: Map<string, Set<string>> = new Map()

  /**
   * Create a new operational intent
   */
  async createIntent(intent: OperationalIntent): Promise<void> {
    this.intents.set(intent.id, intent)
    
    // Index by tenant
    if (!this.intentsByTenant.has(intent.tenantId)) {
      this.intentsByTenant.set(intent.tenantId, new Set())
    }
    this.intentsByTenant.get(intent.tenantId)!.add(intent.id)
    
    // Index by goal
    if (!this.intentsByGoal.has(intent.goalId)) {
      this.intentsByGoal.set(intent.goalId, new Set())
    }
    this.intentsByGoal.get(intent.goalId)!.add(intent.id)
    
    // Index by entity
    const entityKey = `${intent.tenantId}:${intent.entityId}`
    if (!this.intentsByEntity.has(entityKey)) {
      this.intentsByEntity.set(entityKey, new Set())
    }
    this.intentsByEntity.get(entityKey)!.add(intent.id)
  }

  /**
   * Get an intent by ID
   */
  async getIntent(id: string): Promise<OperationalIntent | undefined> {
    return this.intents.get(id)
  }

  /**
   * Update an intent
   */
  async updateIntent(id: string, updates: Partial<OperationalIntent>): Promise<void> {
    const intent = this.intents.get(id)
    if (!intent) {
      throw new Error(`Intent ${id} not found`)
    }
    
    this.intents.set(id, {
      ...intent,
      ...updates
    })
  }

  /**
   * Get all intents for a tenant
   */
  async getIntentsForTenant(tenantId: string): Promise<OperationalIntent[]> {
    const intentIds = this.intentsByTenant.get(tenantId) || new Set()
    const intents: OperationalIntent[] = []
    
    for (const id of intentIds) {
      const intent = this.intents.get(id)
      if (intent) {
        intents.push(intent)
      }
    }
    
    // Sort by creation time (most recent first)
    return intents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get all intents for a specific goal
   */
  async getIntentsForGoal(goalId: string): Promise<OperationalIntent[]> {
    const intentIds = this.intentsByGoal.get(goalId) || new Set()
    const intents: OperationalIntent[] = []
    
    for (const id of intentIds) {
      const intent = this.intents.get(id)
      if (intent) {
        intents.push(intent)
      }
    }
    
    // Sort by creation time (most recent first)
    return intents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get intents for a specific entity
   */
  async getIntentsForEntity(tenantId: string, entityId: string): Promise<OperationalIntent[]> {
    const entityKey = `${tenantId}:${entityId}`
    const intentIds = this.intentsByEntity.get(entityKey) || new Set()
    const intents: OperationalIntent[] = []
    
    for (const id of intentIds) {
      const intent = this.intents.get(id)
      if (intent) {
        intents.push(intent)
      }
    }
    
    // Sort by creation time (most recent first)
    return intents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get active intents (pending, planning, executing)
   */
  async getActiveIntents(tenantId: string): Promise<OperationalIntent[]> {
    const intents = await this.getIntentsForTenant(tenantId)
    return intents.filter(i => 
      i.status === 'pending' || 
      i.status === 'planning' || 
      i.status === 'executing'
    )
  }

  /**
   * Get completed intents
   */
  async getCompletedIntents(tenantId: string): Promise<OperationalIntent[]> {
    const intents = await this.getIntentsForTenant(tenantId)
    return intents.filter(i => i.status === 'completed')
  }

  /**
   * Get failed intents
   */
  async getFailedIntents(tenantId: string): Promise<OperationalIntent[]> {
    const intents = await this.getIntentsForTenant(tenantId)
    return intents.filter(i => i.status === 'failed')
  }

  /**
   * Query intents with filters
   */
  async queryIntents(params: {
    tenantId: string
    goalId?: string
    entityId?: string
    status?: OperationalIntent['status']
    limit?: number
  }): Promise<OperationalIntent[]> {
    let intents = await this.getIntentsForTenant(params.tenantId)
    
    // Filter by goal
    if (params.goalId) {
      intents = intents.filter(i => i.goalId === params.goalId)
    }
    
    // Filter by entity
    if (params.entityId) {
      intents = intents.filter(i => i.entityId === params.entityId)
    }
    
    // Filter by status
    if (params.status) {
      intents = intents.filter(i => i.status === params.status)
    }
    
    // Apply limit
    if (params.limit) {
      intents = intents.slice(0, params.limit)
    }
    
    return intents
  }

  /**
   * Delete old completed/failed intents (retention policy)
   */
  async deleteIntentsBefore(date: Date): Promise<number> {
    let deletedCount = 0
    
    for (const [id, intent] of this.intents.entries()) {
      const isCompleted = intent.status === 'completed' || intent.status === 'failed' || intent.status === 'abandoned'
      
      if (isCompleted && intent.completedAt && intent.completedAt < date) {
        this.intents.delete(id)
        deletedCount++
        
        // Remove from indexes
        this.intentsByTenant.get(intent.tenantId)?.delete(id)
        this.intentsByGoal.get(intent.goalId)?.delete(id)
        
        const entityKey = `${intent.tenantId}:${intent.entityId}`
        this.intentsByEntity.get(entityKey)?.delete(id)
      }
    }
    
    return deletedCount
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalIntents: number
    activeIntents: number
    completedIntents: number
    failedIntents: number
    abandonedIntents: number
  } {
    const allIntents = Array.from(this.intents.values())
    
    return {
      totalIntents: allIntents.length,
      activeIntents: allIntents.filter(i => 
        i.status === 'pending' || i.status === 'planning' || i.status === 'executing'
      ).length,
      completedIntents: allIntents.filter(i => i.status === 'completed').length,
      failedIntents: allIntents.filter(i => i.status === 'failed').length,
      abandonedIntents: allIntents.filter(i => i.status === 'abandoned').length
    }
  }
}

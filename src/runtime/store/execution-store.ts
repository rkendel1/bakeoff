import type { ExecutionRecord, ExecutionStatus } from './execution-record.js'

export class ExecutionStore {
  private readonly executions = new Map<string, ExecutionRecord>()
  private readonly executionsByTenant = new Map<string, string[]>()
  private readonly executionsByEntity = new Map<string, string[]>()

  /**
   * Create a new execution record
   */
  async create(record: ExecutionRecord): Promise<void> {
    this.executions.set(record.id, record)

    // Index by tenant
    const tenantExecutions = this.executionsByTenant.get(record.tenantId) || []
    tenantExecutions.push(record.id)
    this.executionsByTenant.set(record.tenantId, tenantExecutions)

    // Index by entity
    const entityKey = `${record.tenantId}:${record.entityId}`
    const entityExecutions = this.executionsByEntity.get(entityKey) || []
    entityExecutions.push(record.id)
    this.executionsByEntity.set(entityKey, entityExecutions)
  }

  /**
   * Update an existing execution record
   */
  async update(id: string, patch: Partial<ExecutionRecord>): Promise<void> {
    const existing = this.executions.get(id)
    if (!existing) {
      throw new Error(`Execution not found: ${id}`)
    }

    const updated = { ...existing, ...patch }
    this.executions.set(id, updated)
  }

  /**
   * Get an execution record by ID
   */
  async get(id: string): Promise<ExecutionRecord | undefined> {
    return this.executions.get(id)
  }

  /**
   * List all executions for a tenant
   */
  async listByTenant(tenantId: string): Promise<ExecutionRecord[]> {
    const executionIds = this.executionsByTenant.get(tenantId) || []
    return executionIds
      .map((id) => this.executions.get(id))
      .filter((record): record is ExecutionRecord => record !== undefined)
  }

  /**
   * List all executions for a specific entity
   */
  async listByEntity(tenantId: string, entityId: string): Promise<ExecutionRecord[]> {
    const entityKey = `${tenantId}:${entityId}`
    const executionIds = this.executionsByEntity.get(entityKey) || []
    return executionIds
      .map((id) => this.executions.get(id))
      .filter((record): record is ExecutionRecord => record !== undefined)
  }

  /**
   * List all executions with a specific status
   */
  async listByStatus(status: ExecutionStatus): Promise<ExecutionRecord[]> {
    return Array.from(this.executions.values()).filter((record) => record.status === status)
  }

  /**
   * Get all execution records (useful for debugging/testing)
   */
  async all(): Promise<ExecutionRecord[]> {
    return Array.from(this.executions.values())
  }
}

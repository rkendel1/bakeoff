import type { ExecutionStore } from '../store/execution-store.js'
import type { ExecutionRecord } from '../store/execution-record.js'
import type { ExecutionTrace } from '../context/execution-context.js'

/**
 * ExecutionQuery - Query API for executions
 * 
 * Makes executions a first-class query surface, allowing you to retrieve
 * and inspect execution records from the store.
 */
export class ExecutionQuery {
  constructor(private readonly store: ExecutionStore) {}

  /**
   * Get an execution by its ID
   */
  async getById(id: string): Promise<ExecutionRecord | undefined> {
    return this.store.get(id)
  }

  /**
   * Get all executions for a specific entity
   */
  async getByEntity(tenantId: string, entityId: string): Promise<ExecutionRecord[]> {
    return this.store.listByEntity(tenantId, entityId)
  }

  /**
   * Get all failed executions for a tenant
   */
  async getFailed(tenantId: string): Promise<ExecutionRecord[]> {
    const allFailed = await this.store.listByStatus('failed')
    return allFailed.filter((record) => record.tenantId === tenantId)
  }

  /**
   * Get all executions with a specific state
   * This searches through execution context snapshots to find executions
   * that resulted in a particular state.
   */
  async getByState(tenantId: string, state: string): Promise<ExecutionRecord[]> {
    const tenantExecutions = await this.store.listByTenant(tenantId)
    return tenantExecutions.filter((record) => {
      // Check if any state update in the execution resulted in the target state
      return record.contextSnapshot.stateUpdates.some((update) => update.toState === state)
    })
  }

  /**
   * Get the timeline (trace) for a specific execution
   */
  async getTimeline(executionId: string): Promise<ExecutionTrace[]> {
    const execution = await this.store.get(executionId)
    if (!execution) {
      return []
    }
    return execution.contextSnapshot.trace
  }
}

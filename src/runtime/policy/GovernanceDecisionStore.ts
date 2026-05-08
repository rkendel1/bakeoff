import type { GovernanceDecision } from './types.js'

/**
 * GovernanceDecisionStore - Persistent storage for governance decisions
 * 
 * Stores audit trail of policy decisions and enforcement actions.
 */
export class GovernanceDecisionStore {
  private readonly decisions = new Map<string, GovernanceDecision>()
  private readonly tenantIndex = new Map<string, string[]>()

  /**
   * Store a governance decision
   */
  async store(decision: GovernanceDecision): Promise<void> {
    this.decisions.set(decision.id, decision)

    // Index by tenant
    const tenantDecisions = this.tenantIndex.get(decision.tenantId) || []
    tenantDecisions.push(decision.id)
    this.tenantIndex.set(decision.tenantId, tenantDecisions)
  }

  /**
   * Get a specific governance decision
   */
  async get(id: string): Promise<GovernanceDecision | undefined> {
    return this.decisions.get(id)
  }

  /**
   * Get all governance decisions for a tenant
   */
  async getByTenant(tenantId: string): Promise<GovernanceDecision[]> {
    const decisionIds = this.tenantIndex.get(tenantId) || []
    return decisionIds
      .map((id) => this.decisions.get(id))
      .filter((d): d is GovernanceDecision => d !== undefined)
  }

  /**
   * Get recent governance decisions for a tenant
   */
  async getRecent(tenantId: string, limit: number = 50): Promise<GovernanceDecision[]> {
    const decisions = await this.getByTenant(tenantId)
    return decisions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get governance decisions with enforcement actions
   */
  async getWithEnforcement(tenantId: string): Promise<GovernanceDecision[]> {
    const decisions = await this.getByTenant(tenantId)
    return decisions.filter((d) => 
      d.decision.enforcementActions && d.decision.enforcementActions.length > 0
    )
  }

  /**
   * Get blocked executions
   */
  async getBlockedExecutions(tenantId: string): Promise<GovernanceDecision[]> {
    const decisions = await this.getByTenant(tenantId)
    return decisions.filter((d) => !d.decision.allowed)
  }
}

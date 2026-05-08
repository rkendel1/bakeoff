import type { PolicyRule } from './types.js'

/**
 * PolicyStore - Persistent storage for policy rules
 * 
 * Stores governance policies per tenant.
 */
export class PolicyStore {
  private readonly policies = new Map<string, PolicyRule[]>()

  /**
   * Add a policy rule for a tenant
   */
  async addRule(tenantId: string, rule: PolicyRule): Promise<void> {
    const existingRules = this.policies.get(tenantId) || []
    existingRules.push(rule)
    this.policies.set(tenantId, existingRules)
  }

  /**
   * Get all policy rules for a tenant
   */
  async getRules(tenantId: string): Promise<PolicyRule[]> {
    return this.policies.get(tenantId) || []
  }

  /**
   * Remove all rules for a tenant
   */
  async clearRules(tenantId: string): Promise<void> {
    this.policies.delete(tenantId)
  }

  /**
   * Get all tenants with policies
   */
  async getAllTenants(): Promise<string[]> {
    return Array.from(this.policies.keys())
  }
}

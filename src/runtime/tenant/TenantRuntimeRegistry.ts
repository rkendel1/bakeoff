/**
 * TenantRuntimeRegistry - Manages isolated runtime instances per tenant
 * 
 * This is the central registry that maintains per-tenant runtime isolation.
 * 
 * BEFORE (shared cognition):
 * All tenants shared:
 * - execution state
 * - memory store
 * - prediction engine
 * - governance policies
 * 
 * AFTER (isolated cognition):
 * Each tenant has:
 * - dedicated execution memory
 * - isolated governance state
 * - independent prediction calibration
 * - private strategy history
 * - separate modelVersion evolution
 * 
 * This enables true multi-tenant runtime isolation at the cognition layer.
 */

import { TenantRuntime } from "./TenantRuntime.js"

export interface TenantRuntimeDependencies {
  executionStoreFactory: (tenantId: string) => any
  memoryStoreFactory: (tenantId: string) => any
  predictionStoreFactory: (tenantId: string) => any
  governanceStoreFactory: (tenantId: string) => any
  policyEngineFactory: (tenantId: string) => any
  intelligenceEngineFactory: (tenantId: string) => any
}

export class TenantRuntimeRegistry {
  private runtimes = new Map<string, TenantRuntime>()
  private dependencies?: TenantRuntimeDependencies

  /**
   * Initialize registry with dependency factories
   */
  initialize(deps: TenantRuntimeDependencies): void {
    this.dependencies = deps
  }

  /**
   * Register a new tenant runtime
   */
  register(tenantId: string, deps?: TenantRuntimeDependencies): TenantRuntime {
    if (this.runtimes.has(tenantId)) {
      throw new Error(`Tenant runtime already registered: ${tenantId}`)
    }

    const runtimeDeps = deps || this.dependencies
    if (!runtimeDeps) {
      throw new Error('Dependencies not provided. Call initialize() first or provide deps parameter.')
    }

    const runtime = new TenantRuntime(tenantId, runtimeDeps)
    this.runtimes.set(tenantId, runtime)
    
    return runtime
  }

  /**
   * Get runtime for a tenant
   */
  get(tenantId: string): TenantRuntime | undefined {
    return this.runtimes.get(tenantId)
  }

  /**
   * Get runtime for a tenant (throws if not found)
   */
  require(tenantId: string): TenantRuntime {
    const runtime = this.get(tenantId)
    if (!runtime) {
      throw new Error(`Tenant runtime not found: ${tenantId}`)
    }
    return runtime
  }

  /**
   * Check if tenant has a runtime
   */
  has(tenantId: string): boolean {
    return this.runtimes.has(tenantId)
  }

  /**
   * Get all registered tenant IDs
   */
  getAllTenantIds(): string[] {
    return Array.from(this.runtimes.keys())
  }

  /**
   * Remove a tenant runtime
   */
  unregister(tenantId: string): boolean {
    return this.runtimes.delete(tenantId)
  }

  /**
   * Get the number of registered tenants
   */
  size(): number {
    return this.runtimes.size
  }

  /**
   * Execute intent for a tenant
   */
  async executeIntent(tenantId: string, intent: any) {
    const runtime = this.require(tenantId)
    return runtime.executeIntent(intent)
  }

  /**
   * Observe execution outcome for a tenant
   */
  async observe(tenantId: string, executionId: string, outcome: any) {
    const runtime = this.require(tenantId)
    return runtime.observe(executionId, outcome)
  }

  /**
   * Clear all runtimes (useful for testing)
   */
  clear(): void {
    this.runtimes.clear()
  }
}

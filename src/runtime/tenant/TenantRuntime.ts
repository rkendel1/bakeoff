/**
 * TenantRuntime - Isolated runtime instance per tenant
 * 
 * This provides true tenant isolation at the cognition layer:
 * - Per-tenant execution state
 * - Per-tenant modelVersion evolution
 * - Per-tenant memory and governance
 * - Per-tenant prediction calibration
 * 
 * Each tenant gets their own operational reality inside the same runtime.
 */

import { RuntimeCore } from "../RuntimeCore.js"

export class TenantRuntime {
  public tenantId: string
  public runtime: RuntimeCore

  // isolated state per tenant
  public executionStore: any
  public memoryStore: any
  public predictionStore: any
  public governanceStore: any

  constructor(tenantId: string, deps: any) {
    this.tenantId = tenantId

    this.executionStore = deps.executionStoreFactory(tenantId)
    this.memoryStore = deps.memoryStoreFactory(tenantId)
    this.predictionStore = deps.predictionStoreFactory(tenantId)
    this.governanceStore = deps.governanceStoreFactory(tenantId)

    this.runtime = new RuntimeCore(
      deps.policyEngineFactory(tenantId),
      deps.intelligenceEngineFactory(tenantId),
      this.memoryStore
    )
  }

  async executeIntent(intent: any) {
    return this.runtime.execute({
      ...intent,
      tenantId: this.tenantId
    })
  }

  /**
   * Observe execution outcome for learning and calibration
   * 
   * NOTE: This method calls RuntimeCore.observe() which is currently a placeholder.
   * The observe functionality will be fully implemented in the next phase when
   * integrating with ForecastOutcomeTracker and PredictionAccuracyAnalyzer.
   * 
   * For now, this ensures the interface is ready for future learning loop integration.
   */
  async observe(executionId: string, outcome: any) {
    return this.runtime.observe({
      executionId,
      tenantId: this.tenantId,
      outcome
    })
  }
}

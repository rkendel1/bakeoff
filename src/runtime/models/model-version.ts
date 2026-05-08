import type { TenantModel } from '../../models/tenant-model.js'

/**
 * TenantModelVersion - Core entity for model versioning
 * 
 * Represents a specific version of a tenant's operational model.
 * This is the foundation for deterministic execution and safe model evolution.
 * 
 * Every execution is bound to a specific model version to ensure:
 * - Replay correctness
 * - Deterministic behavior
 * - Safe model evolution
 * - Audit trail
 */
export type TenantModelVersion = {
  tenantId: string
  version: string
  createdAt: Date

  model: TenantModel

  metadata?: {
    description?: string
    createdBy?: string
  }
}

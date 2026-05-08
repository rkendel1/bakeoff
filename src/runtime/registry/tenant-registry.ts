import type { TenantModel } from '../../models/tenant-model.js'

/**
 * ModelVersion - Represents a versioned tenant model
 * This is a stub for future model versioning support.
 */
export type ModelVersion = {
  version: string
  model: TenantModel
  createdAt: Date
}

/**
 * TenantRuntimeRegistry - Centralized registry for tenant models and versions
 * 
 * This registry provides centralized lookup of:
 * - Tenant models
 * - Model versions (future feature)
 * - Execution configuration
 * 
 * This is critical for scaling into a multi-tenant product where each tenant
 * can have different operational models.
 */
export class TenantRuntimeRegistry {
  private models: Map<string, TenantModel> = new Map()
  private versions: Map<string, Map<string, ModelVersion>> = new Map()

  /**
   * Register a tenant model
   */
  register(tenantId: string, model: TenantModel): void {
    this.models.set(tenantId, model)
    
    // Also register as 'latest' version
    const versionMap = this.versions.get(tenantId) || new Map()
    versionMap.set('latest', {
      version: 'latest',
      model,
      createdAt: new Date()
    })
    this.versions.set(tenantId, versionMap)
  }

  /**
   * Register a specific version of a tenant model
   */
  registerVersion(tenantId: string, version: string, model: TenantModel): void {
    const versionMap = this.versions.get(tenantId) || new Map()
    versionMap.set(version, {
      version,
      model,
      createdAt: new Date()
    })
    this.versions.set(tenantId, versionMap)

    // If this is the first version, also set it as the current model
    if (!this.models.has(tenantId)) {
      this.models.set(tenantId, model)
    }
  }

  /**
   * Get a tenant model by tenant ID
   */
  getModel(tenantId: string): TenantModel | undefined {
    return this.models.get(tenantId)
  }

  /**
   * Get a specific version of a tenant model
   */
  getModelVersion(tenantId: string, version: string): TenantModel | undefined {
    const versionMap = this.versions.get(tenantId)
    if (!versionMap) {
      return undefined
    }
    
    const modelVersion = versionMap.get(version)
    return modelVersion?.model
  }

  /**
   * List all versions for a tenant
   */
  listVersions(tenantId: string): ModelVersion[] {
    const versionMap = this.versions.get(tenantId)
    if (!versionMap) {
      return []
    }
    return Array.from(versionMap.values())
  }

  /**
   * Check if a tenant is registered
   */
  hasTenant(tenantId: string): boolean {
    return this.models.has(tenantId)
  }
}

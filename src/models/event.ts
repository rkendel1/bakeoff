export type RuntimeEvent = {
  tenantId: string
  entityId: string
  entityType: string
  type: string
  payload: unknown
  headers?: {
    modelVersion?: string  // Optional override for model version
  }
}

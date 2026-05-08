export type RuntimeEvent = {
  tenantId: string
  entityId: string
  entityType: string
  type: string
  payload: unknown
}

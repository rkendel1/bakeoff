import type { Adapter, AdapterResult } from './base.js'

export class DocuSealAdapter implements Adapter {
  async execute(action: {
    name: string
    event: {
      tenantId: string
      entityId: string
      entityType: string
    }
  }): Promise<AdapterResult> {
    return {
      success: true,
      followUpEvents: [
        {
          tenantId: action.event.tenantId,
          entityId: action.event.entityId,
          entityType: action.event.entityType,
          type: 'signature.completed',
          payload: {
            provider: 'docuseal',
            action: action.name
          }
        }
      ]
    }
  }
}

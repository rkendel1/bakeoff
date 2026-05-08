import type { TenantModel } from '../models/tenant-model.js'

export const demoTenant: TenantModel = {
  entities: ['document'],
  states: ['draft', 'pending_signature', 'signed'],
  events: ['document.uploaded', 'signature.completed'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'pending_signature',
      actions: ['send_for_signature']
    },
    {
      entityType: 'document',
      fromState: 'pending_signature',
      eventType: 'signature.completed',
      toState: 'signed',
      actions: []
    }
  ],
  actions: [
    {
      name: 'send_for_signature',
      provider: 'docuseal'
    }
  ]
}

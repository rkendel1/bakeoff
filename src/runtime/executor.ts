import type { Adapter } from '../adapters/base.js'
import type { RuntimeEvent } from '../models/event.js'
import type { TenantModel } from '../models/tenant-model.js'

export class Executor {
  constructor(private readonly adapters: Record<string, Adapter>) {}

  async execute(params: {
    model: TenantModel
    actionNames: string[]
    event: RuntimeEvent
  }): Promise<RuntimeEvent[]> {
    const followUpEvents: RuntimeEvent[] = []

    for (const actionName of params.actionNames) {
      const definition = params.model.actions.find((item) => item.name === actionName)
      if (!definition) {
        throw new Error(`Action not found: ${actionName}`)
      }

      const adapter = this.adapters[definition.provider]
      if (!adapter) {
        throw new Error(`Adapter not found for provider: ${definition.provider}`)
      }

      console.log('[runtime] action executed', {
        action: definition.name,
        provider: definition.provider
      })

      const result = await adapter.execute({
        name: definition.name,
        event: params.event
      })

      console.log('[runtime] provider response', {
        provider: definition.provider,
        success: result.success,
        followUpEvents: result.followUpEvents.map((event) => event.type)
      })

      followUpEvents.push(...result.followUpEvents)
    }

    return followUpEvents
  }
}

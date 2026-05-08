import type { RuntimeEvent } from '../models/event.js'
import type { TenantModel } from '../models/tenant-model.js'
import type { Transition } from '../models/state.js'

export function evaluateTransition(params: {
  model: TenantModel
  event: RuntimeEvent
  currentState: string
}): Transition | undefined {
  const { model, event, currentState } = params

  return model.transitions.find(
    (transition) =>
      transition.eventType === event.type &&
      transition.entityType === event.entityType &&
      transition.fromState === currentState
  )
}

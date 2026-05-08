import type { RuntimeEvent } from '../../models/event.js'
import type { TenantModel } from '../../models/tenant-model.js'
import type { Transition } from '../../models/state.js'

export type RuntimeState = string

export type PlannedAction = {
  name: string
  provider: string
}

export type StateUpdate = {
  entityId: string
  fromState: string
  toState: string
  eventType: string
  timestamp: string
}

export type ExecutionTrace = {
  stage: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export type ExecutionContext = {
  tenantId: string
  entityId: string
  entityType: string
  event: RuntimeEvent

  model: TenantModel
  currentState: RuntimeState

  transitions: Transition[]
  plannedActions: PlannedAction[]

  emittedEvents: RuntimeEvent[]
  stateUpdates: StateUpdate[]

  trace: ExecutionTrace[]
}

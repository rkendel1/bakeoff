import type { ActionDefinition } from './action.js'
import type { Transition } from './state.js'

export type TenantModel = {
  entities: string[]
  states: string[]
  events: string[]
  transitions: Transition[]
  actions: ActionDefinition[]
}

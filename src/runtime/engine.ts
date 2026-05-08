import type { RuntimeEvent } from '../models/event.js'
import type { TenantModel } from '../models/tenant-model.js'
import { EventStore } from '../store/event-store.js'
import { StateStore } from '../store/state-store.js'
import { evaluateTransition } from './evaluator.js'
import { Executor } from './executor.js'
import { Dispatcher } from './dispatcher.js'

export class RuntimeEngine {
  constructor(
    private readonly model: TenantModel,
    private readonly stateStore: StateStore,
    private readonly eventStore: EventStore,
    private readonly executor: Executor,
    private readonly dispatcher: Dispatcher,
    private readonly initialState = 'draft'
  ) {}

  async ingest(event: RuntimeEvent): Promise<void> {
    this.dispatcher.enqueue(event)

    while (this.dispatcher.hasPending()) {
      const currentEvent = this.dispatcher.dequeue()
      if (!currentEvent) {
        continue
      }

      console.log('[runtime] event received', { type: currentEvent.type, entityId: currentEvent.entityId })

      this.eventStore.append(currentEvent)

      const currentState = this.stateStore.get(currentEvent.entityId) ?? this.initialState
      const transition = evaluateTransition({
        model: this.model,
        event: currentEvent,
        currentState
      })

      if (!transition) {
        console.log('[runtime] transition matched', { matched: false, state: currentState, event: currentEvent.type })
        continue
      }

      console.log('[runtime] transition matched', {
        matched: true,
        fromState: transition.fromState,
        toState: transition.toState,
        event: transition.eventType
      })

      const followUpEvents = await this.executor.execute({
        model: this.model,
        actionNames: transition.actions,
        event: currentEvent
      })

      this.stateStore.set(currentEvent.entityId, transition.toState)
      this.stateStore.appendHistory({
        entityId: currentEvent.entityId,
        fromState: transition.fromState,
        toState: transition.toState,
        eventType: currentEvent.type,
        timestamp: new Date().toISOString()
      })

      console.log('[runtime] state updated', {
        entityId: currentEvent.entityId,
        state: transition.toState
      })

      for (const followUpEvent of followUpEvents) {
        this.dispatcher.enqueue(followUpEvent)
      }
    }
  }
}

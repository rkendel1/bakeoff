import type { RuntimeEvent } from '../models/event.js'
import type { TenantModel } from '../models/tenant-model.js'
import type { ExecutionContext } from './context/execution-context.js'
import { EventStore } from '../store/event-store.js'
import { StateStore } from '../store/state-store.js'
import { Executor } from './executor.js'
import { Dispatcher } from './dispatcher.js'
import { pipe } from './pipeline/pipe.js'
import {
  createIngestStage,
  createEvaluateStage,
  createPlanStage,
  createExecuteStage,
  createApplyStage,
  createEmitStage
} from './pipeline/stages.js'

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

      const ctx = this.createContext(currentEvent)

      const result = await pipe(ctx, [
        createIngestStage(this.eventStore),
        createEvaluateStage(this.stateStore, this.initialState),
        createPlanStage(),
        createExecuteStage(this.executor),
        createApplyStage(this.stateStore),
        createEmitStage()
      ])

      for (const followUpEvent of result.emittedEvents) {
        this.dispatcher.enqueue(followUpEvent)
      }
    }
  }

  private createContext(event: RuntimeEvent): ExecutionContext {
    return {
      tenantId: event.tenantId,
      entityId: event.entityId,
      entityType: event.entityType,
      event,
      model: this.model,
      currentState: '',
      transitions: [],
      plannedActions: [],
      emittedEvents: [],
      stateUpdates: [],
      trace: []
    }
  }
}

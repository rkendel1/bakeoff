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
import { ExecutionStore } from './store/execution-store.js'
import type { ExecutionRecord } from './store/execution-record.js'
import { randomUUID } from 'node:crypto'

export class RuntimeEngine {
  constructor(
    private readonly model: TenantModel,
    private readonly stateStore: StateStore,
    private readonly eventStore: EventStore,
    private readonly executor: Executor,
    private readonly dispatcher: Dispatcher,
    private readonly executionStore: ExecutionStore,
    private readonly initialState = 'draft'
  ) {}

  async ingest(event: RuntimeEvent, modelVersion?: string): Promise<void> {
    this.dispatcher.enqueue(event)

    while (this.dispatcher.hasPending()) {
      const currentEvent = this.dispatcher.dequeue()
      if (!currentEvent) {
        continue
      }

      const ctx = this.createContext(currentEvent)
      const executionId = randomUUID()

      // Create execution record at start with initial context snapshot
      // This snapshot captures the input state before pipeline execution
      const executionRecord: ExecutionRecord = {
        id: executionId,
        tenantId: currentEvent.tenantId,
        entityId: currentEvent.entityId,
        event: currentEvent,
        modelVersion: modelVersion || 'latest',  // 👈 NEW FIELD - bind execution to model version
        status: 'running',
        contextSnapshot: ctx,
        createdAt: new Date()
      }

      await this.executionStore.create(executionRecord)

      try {
        const result = await pipe(ctx, [
          createIngestStage(this.eventStore),
          createEvaluateStage(this.stateStore, this.initialState),
          createPlanStage(),
          createExecuteStage(this.executor),
          createApplyStage(this.stateStore),
          createEmitStage()
        ])

        // Update execution record with completed status and final context
        // The context snapshot is updated to include all pipeline results
        await this.executionStore.update(executionId, {
          status: 'completed',
          contextSnapshot: result,
          completedAt: new Date()
        })

        for (const followUpEvent of result.emittedEvents) {
          this.dispatcher.enqueue(followUpEvent)
        }
      } catch (error) {
        // Update execution record with failed status and error details
        await this.executionStore.update(executionId, {
          status: 'failed',
          completedAt: new Date(),
          error: {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'Error'
          }
        })
        throw error
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
      currentState: undefined, // Set during EVALUATE stage
      transitions: [],
      plannedActions: [],
      emittedEvents: [],
      stateUpdates: [],
      trace: []
    }
  }
}

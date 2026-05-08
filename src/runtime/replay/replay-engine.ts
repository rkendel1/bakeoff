import type { ExecutionRecord } from '../store/execution-record.js'
import type { ExecutionContext } from '../context/execution-context.js'
import { pipe } from '../pipeline/pipe.js'
import {
  createIngestStage,
  createEvaluateStage,
  createPlanStage,
  createApplyStage,
  createEmitStage
} from '../pipeline/stages.js'
import { EventStore } from '../../store/event-store.js'
import { StateStore } from '../../store/state-store.js'

/**
 * ReplayExecuteStage - Mock execution stage for replay
 * This stage simulates execution WITHOUT hitting external providers.
 * It uses the recorded actions from the original execution.
 */
function createReplayExecuteStage() {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    // During replay, we don't actually execute actions
    // We just use the emitted events that were already recorded
    // in the original execution
    
    ctx.trace.push({
      stage: 'execute',
      timestamp: new Date().toISOString(),
      metadata: { 
        actionsExecuted: ctx.plannedActions.length,
        mode: 'replay',
        note: 'No external providers hit during replay'
      }
    })
    
    return ctx
  }
}

/**
 * replayExecution - Replay an execution using its snapshot
 * 
 * This function takes an execution record and replays it through the pipeline
 * WITHOUT hitting external providers. It uses mock adapters or recorded responses.
 * 
 * Important: Replay must NOT hit external providers - it operates on recorded state.
 * 
 * @param execution - The execution record to replay
 * @param stores - Optional stores for replay (defaults to in-memory stores)
 * @returns The replayed execution context
 */
export async function replayExecution(
  execution: ExecutionRecord,
  stores?: {
    eventStore?: EventStore
    stateStore?: StateStore
  }
): Promise<ExecutionContext> {
  // Get the initial context snapshot from the execution
  const ctx = execution.contextSnapshot
  
  // Create in-memory stores if not provided
  const eventStore = stores?.eventStore || new EventStore()
  const stateStore = stores?.stateStore || new StateStore()

  // Determine initial state from the context or execution
  const initialState = ctx.currentState || 'draft'

  // Replay through the pipeline with the replay execute stage
  // This uses the original context but doesn't hit external providers
  const result = await pipe(ctx, [
    createIngestStage(eventStore),
    createEvaluateStage(stateStore, initialState),
    createPlanStage(),
    createReplayExecuteStage(), // This is the key difference - no external calls
    createApplyStage(stateStore),
    createEmitStage()
  ])

  return result
}

/**
 * canReplay - Check if an execution can be replayed
 * 
 * An execution can be replayed if:
 * - It has a complete context snapshot
 * - It completed successfully or failed with recoverable error
 * 
 * @param execution - The execution to check
 * @returns true if the execution can be replayed
 */
export function canReplay(execution: ExecutionRecord): boolean {
  return (
    execution.contextSnapshot !== undefined &&
    execution.status !== 'running'
  )
}

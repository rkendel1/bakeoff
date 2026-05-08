import type { RuntimeEvent } from '../../models/event.js'
import type { TenantModel } from '../../models/tenant-model.js'
import type { ExecutionContext, ExecutionTrace, StateUpdate } from '../context/execution-context.js'
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
 * SimulationResult - Output from a simulation run
 * Shows what would happen if an event were processed with a given model version
 */
export type SimulationResult = {
  predictedState?: string
  predictedActions: string[]
  executionTrace: ExecutionTrace[]
  sideEffects: {
    emittedEvents: RuntimeEvent[]
    stateChanges: StateUpdate[]
  }
}

/**
 * SimulationExecuteStage - Mock execution stage for simulation
 * This stage simulates execution WITHOUT hitting external providers.
 * It uses the model to determine what actions would be executed.
 */
function createSimulationExecuteStage() {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    // During simulation, we don't actually execute actions
    // We just record what would have been executed
    
    ctx.trace.push({
      stage: 'execute',
      timestamp: new Date().toISOString(),
      metadata: { 
        actionsExecuted: ctx.plannedActions.length,
        mode: 'simulation',
        note: 'No external providers hit during simulation'
      }
    })
    
    return ctx
  }
}

/**
 * simulate - Simulate an event against a model version
 * 
 * This function runs tenant model changes safely by showing
 * "what would happen if we changed this model?"
 * 
 * The simulation:
 * - Does NOT hit external providers
 * - Uses the model to predict state transitions and actions
 * - Returns predicted outcomes without side effects
 * 
 * @param event - The event to simulate
 * @param modelVersion - The tenant model to simulate against
 * @param currentState - The current state of the entity (optional, defaults to 'draft')
 * @returns Simulation result showing predicted outcomes
 */
export async function simulate(
  event: RuntimeEvent,
  modelVersion: TenantModel,
  currentState?: string
): Promise<SimulationResult> {
  // Create a simulation context
  const ctx: ExecutionContext = {
    tenantId: event.tenantId,
    entityId: event.entityId,
    entityType: event.entityType,
    event,
    model: modelVersion,
    currentState: currentState || 'draft',
    transitions: [],
    plannedActions: [],
    emittedEvents: [],
    stateUpdates: [],
    trace: []
  }

  // Create in-memory stores for simulation
  const eventStore = new EventStore()
  const stateStore = new StateStore()

  const initialState = currentState || 'draft'

  // Run simulation through the pipeline
  const result = await pipe(ctx, [
    createIngestStage(eventStore),
    createEvaluateStage(stateStore, initialState),
    createPlanStage(),
    createSimulationExecuteStage(), // Mock execution - no external calls
    createApplyStage(stateStore),
    createEmitStage()
  ])

  // Extract predicted outcomes
  const predictedState = result.stateUpdates.length > 0 
    ? result.stateUpdates[result.stateUpdates.length - 1].toState 
    : undefined

  const predictedActions = result.plannedActions.map((action) => action.name)

  return {
    predictedState,
    predictedActions,
    executionTrace: result.trace,
    sideEffects: {
      emittedEvents: result.emittedEvents,
      stateChanges: result.stateUpdates
    }
  }
}

/**
 * simulateMany - Simulate multiple events in sequence
 * 
 * This is useful for testing complex scenarios where multiple events
 * are processed in sequence.
 * 
 * @param events - Array of events to simulate
 * @param modelVersion - The tenant model to simulate against
 * @param initialState - Initial state (optional, defaults to 'draft')
 * @returns Array of simulation results, one per event
 */
export async function simulateMany(
  events: RuntimeEvent[],
  modelVersion: TenantModel,
  initialState?: string
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = []
  let currentState = initialState || 'draft'

  for (const event of events) {
    const result = await simulate(event, modelVersion, currentState)
    results.push(result)
    
    // Update state for next simulation if state changed
    if (result.predictedState) {
      currentState = result.predictedState
    }
  }

  return results
}

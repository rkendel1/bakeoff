import type { ExecutionRecord } from '../store/execution-record.js'
import type { ExecutionTrace, StateUpdate } from '../context/execution-context.js'

/**
 * InspectionResult - Structured output from the inspector
 * Turns raw execution into readable insight.
 */
export type InspectionResult = {
  executionId: string
  summary: {
    startState?: string
    endState?: string
    eventChain: string[]
    actionsExecuted: string[]
    providersTouched: string[]
  }
  timeline: ExecutionTrace[]
  stateChanges: StateUpdate[]
  errors?: Array<{
    message: string
    name: string
  }>
}

/**
 * RuntimeInspector - Observability layer for the runtime
 * 
 * Transforms raw execution records into human-readable insights,
 * providing a clear view of what happened during execution.
 */
export class RuntimeInspector {
  /**
   * Inspect an execution and produce a structured report
   */
  inspect(execution: ExecutionRecord): InspectionResult {
    const { contextSnapshot } = execution

    // Extract start and end states from state updates
    const stateChanges = contextSnapshot.stateUpdates
    const startState = stateChanges.length > 0 ? stateChanges[0].fromState : undefined
    const endState = stateChanges.length > 0 ? stateChanges[stateChanges.length - 1].toState : undefined

    // Extract event chain
    const eventChain = [contextSnapshot.event.type]
    // Add emitted events to the chain
    contextSnapshot.emittedEvents.forEach((event) => {
      eventChain.push(event.type)
    })

    // Extract executed actions
    const actionsExecuted = contextSnapshot.plannedActions.map((action) => action.name)

    // Extract unique providers touched
    const providersTouched = Array.from(
      new Set(contextSnapshot.plannedActions.map((action) => action.provider))
    )

    // Compile errors if execution failed
    const errors = execution.error ? [execution.error] : undefined

    return {
      executionId: execution.id,
      summary: {
        startState,
        endState,
        eventChain,
        actionsExecuted,
        providersTouched
      },
      timeline: contextSnapshot.trace,
      stateChanges: contextSnapshot.stateUpdates,
      errors
    }
  }

  /**
   * Inspect multiple executions and return an array of results
   */
  inspectMany(executions: ExecutionRecord[]): InspectionResult[] {
    return executions.map((execution) => this.inspect(execution))
  }
}

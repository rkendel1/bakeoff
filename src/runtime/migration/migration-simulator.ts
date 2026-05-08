import type { TenantModel } from '../../models/tenant-model.js'
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
 * MigrationExecuteStage - Mock execution stage for migration simulation
 * This stage simulates execution WITHOUT hitting external providers.
 * Similar to replay, but used specifically for migration testing.
 */
function createMigrationExecuteStage() {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    // During migration simulation, we don't execute actions
    // We just simulate the state transitions with the new model
    
    ctx.trace.push({
      stage: 'execute',
      timestamp: new Date().toISOString(),
      metadata: { 
        actionsExecuted: ctx.plannedActions.length,
        mode: 'migration-simulation',
        note: 'No external providers hit during simulation'
      }
    })
    
    return ctx
  }
}

/**
 * StateChange - Represents a state change during execution
 */
export type StateChange = {
  entityId: string
  fromState: string
  toState: string
  eventType: string
}

/**
 * ActionChange - Represents an action change during execution
 */
export type ActionChange = {
  actionName: string
  fromProvider?: string
  toProvider?: string
  added: boolean
  removed: boolean
}

/**
 * MigrationSimulationResult - Result of simulating an execution against a new model
 * 
 * This tells you:
 * - Did the outcome change?
 * - What behavioral drift occurred?
 * - What actions changed?
 */
export type MigrationSimulationResult = {
  executionId: string
  
  originalOutcome: string  // Final state in original execution
  predictedOutcome: string  // Final state in simulated execution
  
  changed: boolean  // Did the outcome change?
  
  drift: {
    stateChanges: StateChange[]
    actionChanges: ActionChange[]
  }
}

/**
 * MigrationSimulationOptions - Options for migration simulation
 */
export type MigrationSimulationOptions = {
  tenantId: string
  fromVersion: string
  toVersion: string
  historicalExecutions: ExecutionRecord[]
  sampleSize?: number  // Optional sampling for large execution sets
}

/**
 * MigrationSimulator - Simulates migration impact by replaying executions
 * 
 * Core capability:
 * Takes historical executions and replays them against a NEW model version
 * to predict behavioral changes.
 * 
 * This is critical for:
 * - Safe model evolution
 * - Understanding migration impact
 * - Detecting regressions
 * - Operational confidence
 */
export class MigrationSimulator {
  /**
   * Simulate migration by replaying historical executions against new model
   */
  async simulateMigration(
    fromModel: TenantModel,
    toModel: TenantModel,
    options: MigrationSimulationOptions
  ): Promise<MigrationSimulationResult[]> {
    const { historicalExecutions, sampleSize } = options
    
    // Sample executions if requested
    const executionsToSimulate = sampleSize
      ? this.sampleExecutions(historicalExecutions, sampleSize)
      : historicalExecutions
    
    // Simulate each execution
    const results: MigrationSimulationResult[] = []
    
    for (const execution of executionsToSimulate) {
      const result = await this.simulateExecution(execution, fromModel, toModel)
      results.push(result)
    }
    
    return results
  }

  /**
   * Simulate a single execution against a new model
   */
  private async simulateExecution(
    execution: ExecutionRecord,
    fromModel: TenantModel,
    toModel: TenantModel
  ): Promise<MigrationSimulationResult> {
    // Get original outcome
    const originalOutcome = execution.contextSnapshot.currentState || 'unknown'
    
    // Replay execution with NEW model
    const simulatedContext = await this.replayWithModel(execution, toModel)
    const predictedOutcome = simulatedContext.currentState || 'unknown'
    
    // Detect drift
    const stateChanges = this.detectStateChanges(execution, simulatedContext)
    const actionChanges = this.detectActionChanges(execution, simulatedContext, fromModel, toModel)
    
    return {
      executionId: execution.id,
      originalOutcome,
      predictedOutcome,
      changed: originalOutcome !== predictedOutcome,
      drift: {
        stateChanges,
        actionChanges
      }
    }
  }

  /**
   * Replay execution with a specific model version
   * 
   * This is similar to replay but uses a DIFFERENT model version
   * to see what WOULD happen with the new model.
   */
  private async replayWithModel(
    execution: ExecutionRecord,
    model: TenantModel
  ): Promise<ExecutionContext> {
    // Create fresh stores for simulation
    const eventStore = new EventStore()
    const stateStore = new StateStore()
    
    // Get context from execution
    const ctx = { ...execution.contextSnapshot }
    
    // Override the model in the context with the NEW model
    ctx.model = model
    
    // Determine initial state
    const initialState = ctx.currentState || 'draft'
    
    // Replay through pipeline with migration execute stage
    const result = await pipe(ctx, [
      createIngestStage(eventStore),
      createEvaluateStage(stateStore, initialState),
      createPlanStage(),
      createMigrationExecuteStage(),  // Mock execution
      createApplyStage(stateStore),
      createEmitStage()
    ])
    
    return result
  }

  /**
   * Detect state changes between original and simulated execution
   */
  private detectStateChanges(
    original: ExecutionRecord,
    simulated: ExecutionContext
  ): StateChange[] {
    const changes: StateChange[] = []
    
    // Compare final states
    const originalState = original.contextSnapshot.currentState
    const simulatedState = simulated.currentState
    
    if (originalState && simulatedState && originalState !== simulatedState) {
      changes.push({
        entityId: original.entityId,
        fromState: originalState,
        toState: simulatedState,
        eventType: original.event.type
      })
    }
    
    return changes
  }

  /**
   * Detect action changes between original and simulated execution
   * 
   * This detects:
   * - Provider changes (critical!)
   * - Added actions
   * - Removed actions
   */
  private detectActionChanges(
    original: ExecutionRecord,
    simulated: ExecutionContext,
    fromModel: TenantModel,
    toModel: TenantModel
  ): ActionChange[] {
    const changes: ActionChange[] = []
    
    // Get actions from both contexts
    const originalActions = original.contextSnapshot.plannedActions || []
    const simulatedActions = simulated.plannedActions || []
    
    // Find removed actions
    for (const action of originalActions) {
      const found = simulatedActions.find(a => a.name === action.name)
      if (!found) {
        changes.push({
          actionName: action.name,
          fromProvider: action.provider,
          removed: true,
          added: false
        })
      }
    }
    
    // Find added actions
    for (const action of simulatedActions) {
      const found = originalActions.find(a => a.name === action.name)
      if (!found) {
        changes.push({
          actionName: action.name,
          toProvider: action.provider,
          removed: false,
          added: true
        })
      }
    }
    
    // Find provider changes (action exists in both but provider changed)
    for (const originalAction of originalActions) {
      const simulatedAction = simulatedActions.find(a => a.name === originalAction.name)
      
      if (simulatedAction && originalAction.provider !== simulatedAction.provider) {
        changes.push({
          actionName: originalAction.name,
          fromProvider: originalAction.provider,
          toProvider: simulatedAction.provider,
          removed: false,
          added: false
        })
      }
    }
    
    return changes
  }

  /**
   * Sample executions for large datasets
   * 
   * Uses reservoir sampling for unbiased sampling
   */
  private sampleExecutions(
    executions: ExecutionRecord[],
    sampleSize: number
  ): ExecutionRecord[] {
    if (executions.length <= sampleSize) {
      return executions
    }
    
    // Simple random sampling
    const sampled: ExecutionRecord[] = []
    const indices = new Set<number>()
    
    while (indices.size < sampleSize) {
      const index = Math.floor(Math.random() * executions.length)
      if (!indices.has(index)) {
        indices.add(index)
        sampled.push(executions[index])
      }
    }
    
    return sampled
  }
}

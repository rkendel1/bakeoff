import type { ExecutionContext } from '../context/execution-context.js'
import type { EventStore } from '../../store/event-store.js'
import type { StateStore } from '../../store/state-store.js'
import type { Executor } from '../executor.js'
import { evaluateTransition } from '../evaluator.js'
import { getTimestamp } from '../context/execution-context.js'

/**
 * Helper to get the first (and typically only) matched transition.
 * The runtime currently operates on a single transition per event.
 */
function getMatchedTransition(ctx: ExecutionContext) {
  return ctx.transitions[0]
}

/**
 * INGEST stage - Receives and logs the incoming event
 */
export function createIngestStage(eventStore: EventStore) {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    console.log('[runtime] event received', { type: ctx.event.type, entityId: ctx.event.entityId })
    
    eventStore.append(ctx.event)
    
    ctx.trace.push({
      stage: 'ingest',
      timestamp: getTimestamp(),
      metadata: { eventType: ctx.event.type }
    })
    
    return ctx
  }
}

/**
 * EVALUATE stage - Evaluates which transitions apply to this event
 */
export function createEvaluateStage(stateStore: StateStore, initialState: string) {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    const currentState = stateStore.get(ctx.entityId) ?? initialState
    ctx.currentState = currentState
    
    const transition = evaluateTransition({
      model: ctx.model,
      event: ctx.event,
      currentState
    })
    
    if (transition) {
      ctx.transitions.push(transition)
      console.log('[runtime] transition matched', {
        matched: true,
        fromState: transition.fromState,
        toState: transition.toState,
        event: transition.eventType
      })
    } else {
      console.log('[runtime] transition matched', { 
        matched: false, 
        state: currentState, 
        event: ctx.event.type 
      })
    }
    
    ctx.trace.push({
      stage: 'evaluate',
      timestamp: getTimestamp(),
      metadata: { transitionFound: !!transition }
    })
    
    return ctx
  }
}

/**
 * PLAN stage - Plans which actions to execute
 */
export function createPlanStage() {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    if (ctx.transitions.length === 0) {
      ctx.trace.push({
        stage: 'plan',
        timestamp: getTimestamp(),
        metadata: { actionsPlanned: 0 }
      })
      return ctx
    }
    
    const transition = getMatchedTransition(ctx)
    
    for (const actionName of transition.actions) {
      const actionDef = ctx.model.actions.find((a) => a.name === actionName)
      if (actionDef) {
        ctx.plannedActions.push({
          name: actionDef.name,
          provider: actionDef.provider
        })
      }
    }
    
    ctx.trace.push({
      stage: 'plan',
      timestamp: getTimestamp(),
      metadata: { actionsPlanned: ctx.plannedActions.length }
    })
    
    return ctx
  }
}

/**
 * EXECUTE stage - Executes planned actions
 */
export function createExecuteStage(executor: Executor) {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    if (ctx.transitions.length === 0) {
      ctx.trace.push({
        stage: 'execute',
        timestamp: getTimestamp(),
        metadata: { actionsExecuted: 0 }
      })
      return ctx
    }
    
    const transition = getMatchedTransition(ctx)
    
    const followUpEvents = await executor.execute({
      model: ctx.model,
      actionNames: transition.actions,
      event: ctx.event
    })
    
    ctx.emittedEvents.push(...followUpEvents)
    
    ctx.trace.push({
      stage: 'execute',
      timestamp: getTimestamp(),
      metadata: { actionsExecuted: transition.actions.length, followUpEvents: followUpEvents.length }
    })
    
    return ctx
  }
}

/**
 * APPLY stage - Applies state changes
 */
export function createApplyStage(stateStore: StateStore) {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    if (ctx.transitions.length === 0) {
      ctx.trace.push({
        stage: 'apply',
        timestamp: getTimestamp(),
        metadata: { stateUpdated: false }
      })
      return ctx
    }
    
    const transition = getMatchedTransition(ctx)
    
    stateStore.set(ctx.entityId, transition.toState)
    
    const stateUpdate = {
      entityId: ctx.entityId,
      fromState: transition.fromState,
      toState: transition.toState,
      eventType: ctx.event.type,
      timestamp: getTimestamp()
    }
    
    stateStore.appendHistory(stateUpdate)
    ctx.stateUpdates.push(stateUpdate)
    
    console.log('[runtime] state updated', {
      entityId: ctx.entityId,
      state: transition.toState
    })
    
    ctx.trace.push({
      stage: 'apply',
      timestamp: getTimestamp(),
      metadata: { stateUpdated: true, newState: transition.toState }
    })
    
    return ctx
  }
}

/**
 * EMIT stage - Emits follow-up events (for dispatcher to handle)
 */
export function createEmitStage() {
  return async (ctx: ExecutionContext): Promise<ExecutionContext> => {
    ctx.trace.push({
      stage: 'emit',
      timestamp: getTimestamp(),
      metadata: { eventsEmitted: ctx.emittedEvents.length }
    })
    
    return ctx
  }
}

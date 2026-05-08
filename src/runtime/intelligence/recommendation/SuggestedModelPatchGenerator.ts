import type { ExecutionRecord } from '../../store/execution-record.js'
import type { TenantModel } from '../../../models/tenant-model.js'
import type { SuggestedModelChange } from './types.js'
import type { DriftAnalysis } from '../types.js'

/**
 * SuggestedModelPatchGenerator - Generate machine-readable model patches
 * 
 * Generates:
 * - add_transition patches
 * - remove_transition patches
 * - merge_states patches
 * - update_provider patches
 * 
 * This is the beginning of:
 * - Runtime-assisted model evolution
 * - Semi-autonomous operational architecture
 */
export class SuggestedModelPatchGenerator {
  /**
   * Generate model patches from drift analysis and execution data
   */
  generatePatches(
    model: TenantModel,
    executions: ExecutionRecord[],
    driftAnalysis?: DriftAnalysis
  ): SuggestedModelChange[] {
    const patches: SuggestedModelChange[] = []

    // 1. Generate patches for shadow transitions (formalize them)
    if (driftAnalysis?.shadowTransitions) {
      for (const shadowTransition of driftAnalysis.shadowTransitions) {
        patches.push(...this.generateAddTransitionPatch(shadowTransition, executions))
      }
    }

    // 2. Generate patches for unused transitions (remove them)
    if (driftAnalysis?.unusedTransitions) {
      for (const unusedTransition of driftAnalysis.unusedTransitions) {
        patches.push(this.generateRemoveTransitionPatch(unusedTransition))
      }
    }

    // 3. Generate patches for provider instability
    patches.push(...this.generateProviderPatches(model, executions))

    // 4. Generate patches for state merging opportunities
    patches.push(...this.generateStateMergePatches(model, executions))

    return patches
  }

  /**
   * Generate patch to add a shadow transition that is frequently used
   */
  private generateAddTransitionPatch(
    shadowTransition: string,
    executions: ExecutionRecord[]
  ): SuggestedModelChange[] {
    // Parse shadow transition format: "from -> to (event)"
    const match = shadowTransition.match(/^(.+?) -> (.+?) \((.+?)\)$/)
    if (!match) return []

    const [, fromState, toState, eventType] = match

    // Count how often this transition is used
    let executionCount = 0
    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        if (
          update.fromState === fromState &&
          update.toState === toState &&
          update.eventType === eventType
        ) {
          executionCount++
        }
      }
    }

    const percentage = executions.length > 0 
      ? (executionCount / executions.length * 100).toFixed(0)
      : '0'

    return [{
      operation: 'add_transition',
      target: {
        from: fromState,
        to: toState,
        event: eventType
      },
      reason: `Observed in ${executionCount} executions (${percentage}% of total) but not defined in model`
    }]
  }

  /**
   * Generate patch to remove an unused transition
   */
  private generateRemoveTransitionPatch(unusedTransition: string): SuggestedModelChange {
    // Parse unused transition format: "from -> to (event)"
    const match = unusedTransition.match(/^(.+?) -> (.+?) \((.+?)\)$/)
    const transitionId = match 
      ? `${match[1]}_${match[2]}_${match[3]}` 
      : unusedTransition

    return {
      operation: 'remove_transition',
      target: {
        transitionId
      },
      reason: 'Never executed in observed time period'
    }
  }

  /**
   * Generate patches for provider updates based on reliability
   */
  private generateProviderPatches(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): SuggestedModelChange[] {
    const patches: SuggestedModelChange[] = []

    // Analyze provider usage patterns
    const providerUsage = new Map<string, Map<string, number>>()

    for (const execution of executions) {
      const plannedActions = execution.contextSnapshot.plannedActions
      for (const action of plannedActions) {
        if (!providerUsage.has(action.name)) {
          providerUsage.set(action.name, new Map())
        }
        const providers = providerUsage.get(action.name)!
        providers.set(action.provider, (providers.get(action.provider) || 0) + 1)
      }
    }

    // Check for provider divergence
    for (const [action, providers] of providerUsage) {
      // Find declared provider
      const modelAction = model.actions.find(a => a.name === action)
      if (!modelAction) continue

      // Find most used provider
      let maxCount = 0
      let mostUsedProvider = ''
      for (const [provider, count] of providers) {
        if (count > maxCount) {
          maxCount = count
          mostUsedProvider = provider
        }
      }

      // If most used provider differs from declared, suggest update
      if (mostUsedProvider && mostUsedProvider !== modelAction.provider) {
        const percentage = (maxCount / executions.length * 100).toFixed(0)
        patches.push({
          operation: 'update_provider',
          target: {
            action,
            provider: mostUsedProvider
          },
          reason: `${mostUsedProvider} used in ${percentage}% of executions, but model declares ${modelAction.provider}`
        })
      }
    }

    return patches
  }

  /**
   * Generate patches for merging underutilized states
   */
  private generateStateMergePatches(
    model: TenantModel,
    executions: ExecutionRecord[]
  ): SuggestedModelChange[] {
    const patches: SuggestedModelChange[] = []

    // Track state usage
    const stateUsage = new Map<string, number>()
    for (const state of model.states) {
      stateUsage.set(state, 0)
    }

    for (const execution of executions) {
      const stateUpdates = execution.contextSnapshot.stateUpdates
      for (const update of stateUpdates) {
        stateUsage.set(update.fromState, (stateUsage.get(update.fromState) || 0) + 1)
        stateUsage.set(update.toState, (stateUsage.get(update.toState) || 0) + 1)
      }
    }

    // Find pairs of states that are rarely used
    const underutilizedStates: string[] = []
    for (const [state, count] of stateUsage) {
      const utilizationRate = count / (executions.length * 2) // *2 because each execution touches ~2 states
      if (utilizationRate < 0.1 && count > 0) {
        underutilizedStates.push(state)
      }
    }

    // If multiple underutilized states, suggest merging
    if (underutilizedStates.length >= 2) {
      patches.push({
        operation: 'merge_states',
        target: {
          states: underutilizedStates
        },
        reason: `These states are rarely used and could potentially be consolidated`
      })
    }

    return patches
  }

  /**
   * Generate a comprehensive patch set for a tenant
   */
  generatePatchSet(
    tenantId: string,
    model: TenantModel,
    executions: ExecutionRecord[],
    driftAnalysis?: DriftAnalysis
  ): {
    tenantId: string
    generatedAt: string
    patches: SuggestedModelChange[]
    summary: {
      addTransitions: number
      removeTransitions: number
      updateProviders: number
      mergeStates: number
    }
  } {
    const patches = this.generatePatches(model, executions, driftAnalysis)

    const summary = {
      addTransitions: patches.filter(p => p.operation === 'add_transition').length,
      removeTransitions: patches.filter(p => p.operation === 'remove_transition').length,
      updateProviders: patches.filter(p => p.operation === 'update_provider').length,
      mergeStates: patches.filter(p => p.operation === 'merge_states').length
    }

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      patches,
      summary
    }
  }
}

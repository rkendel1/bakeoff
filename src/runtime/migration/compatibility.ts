import type { BehavioralDiff } from '../diff/behavioral-diff-engine.js'

/**
 * CompatibilityReport - Classifies breaking vs non-breaking changes
 * 
 * This enables:
 * - Safe migration decisions
 * - Automated deployment gates
 * - Operational risk assessment
 */
export type CompatibilityReport = {
  compatible: boolean
  breakingChanges: string[]
  warnings: string[]
  summary: {
    totalBreaking: number
    totalWarnings: number
    riskLevel: 'low' | 'medium' | 'high'
  }
}

/**
 * CompatibilityAnalyzer - Classifies model changes as breaking or non-breaking
 * 
 * Breaking changes:
 * - Removed transition (execution paths disappear)
 * - Removed event (external integrations break)
 * - Removed state (state machine contracts break)
 * - Changed transition destination (behavior changes)
 * 
 * Warnings (non-breaking but risky):
 * - Provider change (different execution behavior)
 * - Additional actions (side effects added)
 * - Retry policy changes (timing/reliability changes)
 * - New transitions (expanded behavior)
 */
export class CompatibilityAnalyzer {
  /**
   * Analyze a behavioral diff and produce compatibility report
   */
  analyze(diff: BehavioralDiff): CompatibilityReport {
    const breakingChanges: string[] = []
    const warnings: string[] = []

    // Analyze breaking changes
    this.analyzeBreakingChanges(diff, breakingChanges)

    // Analyze warnings
    this.analyzeWarnings(diff, warnings)

    // Determine overall compatibility
    const compatible = breakingChanges.length === 0

    return {
      compatible,
      breakingChanges,
      warnings,
      summary: {
        totalBreaking: breakingChanges.length,
        totalWarnings: warnings.length,
        riskLevel: diff.riskLevel
      }
    }
  }

  /**
   * Detect breaking changes
   */
  private analyzeBreakingChanges(diff: BehavioralDiff, breakingChanges: string[]): void {
    // Removed transitions are ALWAYS breaking
    if (diff.removedTransitions.length > 0) {
      for (const transition of diff.removedTransitions) {
        breakingChanges.push(
          `Removed transition: ${transition.entityType} ${transition.fromState} → ${transition.toState} on ${transition.eventType}`
        )
      }
    }

    // Removed events are breaking (external systems depend on these)
    if (diff.removedEvents.length > 0) {
      for (const event of diff.removedEvents) {
        breakingChanges.push(`Removed event type: ${event}`)
      }
    }

    // Removed states are breaking (state machine contract broken)
    if (diff.removedStates.length > 0) {
      for (const state of diff.removedStates) {
        breakingChanges.push(`Removed state: ${state}`)
      }
    }

    // Changed transitions that alter destination are breaking
    if (diff.changedTransitions.length > 0) {
      for (const change of diff.changedTransitions) {
        if (change.before.toState !== change.after.toState) {
          breakingChanges.push(
            `Changed transition destination: ${change.before.entityType} ${change.before.fromState} → ${change.before.toState} became → ${change.after.toState}`
          )
        }
      }
    }

    // Removed entities are breaking
    if (diff.removedEntities.length > 0) {
      for (const entity of diff.removedEntities) {
        breakingChanges.push(`Removed entity type: ${entity}`)
      }
    }
  }

  /**
   * Detect non-breaking warnings
   */
  private analyzeWarnings(diff: BehavioralDiff, warnings: string[]): void {
    // Provider changes are warnings (execution behavior changes but not contract)
    if (diff.changedActions.length > 0) {
      for (const change of diff.changedActions) {
        warnings.push(
          `Provider changed: ${change.before.name} (${change.before.provider} → ${change.after.provider})`
        )
      }
    }

    // Additional actions are warnings (new side effects)
    if (diff.addedActions.length > 0) {
      for (const action of diff.addedActions) {
        warnings.push(`New action added: ${action.name} (${action.provider})`)
      }
    }

    // Changed transition actions are warnings
    if (diff.changedTransitions.length > 0) {
      for (const change of diff.changedTransitions) {
        const beforeActions = JSON.stringify(change.before.actions)
        const afterActions = JSON.stringify(change.after.actions)
        
        if (beforeActions !== afterActions) {
          warnings.push(
            `Transition actions changed: ${change.before.entityType} ${change.before.fromState} → ${change.after.toState}`
          )
        }
      }
    }

    // New transitions are warnings (expanded behavior space)
    if (diff.addedTransitions.length > 0) {
      for (const transition of diff.addedTransitions) {
        warnings.push(
          `New transition added: ${transition.entityType} ${transition.fromState} → ${transition.toState} on ${transition.eventType}`
        )
      }
    }

    // New states are warnings (expanded state space)
    if (diff.addedStates.length > 0) {
      for (const state of diff.addedStates) {
        warnings.push(`New state added: ${state}`)
      }
    }

    // New events are warnings (expanded event space)
    if (diff.addedEvents.length > 0) {
      for (const event of diff.addedEvents) {
        warnings.push(`New event type added: ${event}`)
      }
    }
  }
}

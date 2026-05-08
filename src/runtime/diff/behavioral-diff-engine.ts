import type { TenantModel } from '../../models/tenant-model.js'
import type { Transition } from '../../models/state.js'
import type { ActionDefinition } from '../../models/action.js'

/**
 * TransitionChange - Represents a changed transition between model versions
 */
export type TransitionChange = {
  before: Transition
  after: Transition
}

/**
 * RiskLevel - Operational risk classification
 */
export type RiskLevel = 'low' | 'medium' | 'high'

/**
 * RiskFactor - Specific factor contributing to operational risk
 */
export type RiskFactor = 
  | 'critical_transition_removed'
  | 'terminal_state_removed'
  | 'provider_changed'
  | 'transition_removed'
  | 'event_removed'
  | 'state_removed'
  | 'action_added'
  | 'transition_added'
  | 'retry_policy_changed'

/**
 * RiskScore - Quantified operational risk assessment
 */
export type RiskScore = {
  score: number  // 0-100
  factors: RiskFactor[]
}

/**
 * BehavioralDiff - Semantic comparison of two tenant model versions
 * 
 * This is NOT schema diff or code diff.
 * This is EXECUTION BEHAVIOR DIFF.
 * 
 * Critical for understanding operational evolution.
 */
export type BehavioralDiff = {
  // Transition changes
  addedTransitions: Transition[]
  removedTransitions: Transition[]
  changedTransitions: TransitionChange[]

  // Action changes
  addedActions: ActionDefinition[]
  removedActions: ActionDefinition[]
  changedActions: {
    before: ActionDefinition
    after: ActionDefinition
  }[]

  // State and event changes
  addedStates: string[]
  removedStates: string[]
  addedEvents: string[]
  removedEvents: string[]
  addedEntities: string[]
  removedEntities: string[]

  // Risk assessment
  riskLevel: RiskLevel
  riskScore: RiskScore
}

/**
 * BehavioralDiffEngine - Core engine for comparing model versions
 * 
 * Detects:
 * - Transition drift (state machine changes)
 * - Action drift (provider execution changes)
 * - Breaking changes
 * - Operational risk
 */
export class BehavioralDiffEngine {
  /**
   * Compare two tenant model versions and produce behavioral diff
   */
  diff(beforeModel: TenantModel, afterModel: TenantModel): BehavioralDiff {
    // Analyze transitions
    const transitionDiff = this.diffTransitions(beforeModel.transitions, afterModel.transitions)
    
    // Analyze actions
    const actionDiff = this.diffActions(beforeModel.actions, afterModel.actions)
    
    // Analyze states
    const stateDiff = this.diffStringArrays(beforeModel.states, afterModel.states)
    
    // Analyze events
    const eventDiff = this.diffStringArrays(beforeModel.events, afterModel.events)
    
    // Analyze entities
    const entityDiff = this.diffStringArrays(beforeModel.entities, afterModel.entities)
    
    // Calculate risk
    const riskScore = this.calculateRiskScore({
      removedTransitions: transitionDiff.removed,
      changedTransitions: transitionDiff.changed,
      removedStates: stateDiff.removed,
      removedEvents: eventDiff.removed,
      changedActions: actionDiff.changed,
      addedActions: actionDiff.added,
      addedTransitions: transitionDiff.added
    })
    
    const riskLevel = this.calculateRiskLevel(riskScore.score)
    
    return {
      addedTransitions: transitionDiff.added,
      removedTransitions: transitionDiff.removed,
      changedTransitions: transitionDiff.changed,
      addedActions: actionDiff.added,
      removedActions: actionDiff.removed,
      changedActions: actionDiff.changed,
      addedStates: stateDiff.added,
      removedStates: stateDiff.removed,
      addedEvents: eventDiff.added,
      removedEvents: eventDiff.removed,
      addedEntities: entityDiff.added,
      removedEntities: entityDiff.removed,
      riskLevel,
      riskScore
    }
  }

  /**
   * Diff transitions between two model versions
   * 
   * Detects:
   * - Added transitions (new paths)
   * - Removed transitions (breaking changes)
   * - Changed transitions (behavioral drift)
   */
  private diffTransitions(
    before: Transition[],
    after: Transition[]
  ): {
    added: Transition[]
    removed: Transition[]
    changed: TransitionChange[]
  } {
    const added: Transition[] = []
    const removed: Transition[] = []
    const changed: TransitionChange[] = []

    // Find removed and changed transitions
    for (const beforeTransition of before) {
      const afterTransition = this.findMatchingTransition(beforeTransition, after)
      
      if (!afterTransition) {
        // Transition was removed
        removed.push(beforeTransition)
      } else if (!this.transitionsEqual(beforeTransition, afterTransition)) {
        // Transition exists but changed
        changed.push({
          before: beforeTransition,
          after: afterTransition
        })
      }
    }

    // Find added transitions
    for (const afterTransition of after) {
      const beforeTransition = this.findMatchingTransition(afterTransition, before)
      if (!beforeTransition) {
        added.push(afterTransition)
      }
    }

    return { added, removed, changed }
  }

  /**
   * Find a matching transition based on entityType, fromState, and eventType
   * This forms the "identity" of a transition
   */
  private findMatchingTransition(
    target: Transition,
    transitions: Transition[]
  ): Transition | undefined {
    return transitions.find(
      (t) =>
        t.entityType === target.entityType &&
        t.fromState === target.fromState &&
        t.eventType === target.eventType
    )
  }

  /**
   * Check if two transitions are functionally equal
   */
  private transitionsEqual(a: Transition, b: Transition): boolean {
    return (
      a.entityType === b.entityType &&
      a.fromState === b.fromState &&
      a.eventType === b.eventType &&
      a.toState === b.toState &&
      JSON.stringify(a.actions) === JSON.stringify(b.actions)
    )
  }

  /**
   * Diff actions between two model versions
   * 
   * CRITICAL: This detects provider execution drift
   * Example: send_for_signature → docuseal vs docusign
   */
  private diffActions(
    before: ActionDefinition[],
    after: ActionDefinition[]
  ): {
    added: ActionDefinition[]
    removed: ActionDefinition[]
    changed: { before: ActionDefinition; after: ActionDefinition }[]
  } {
    const added: ActionDefinition[] = []
    const removed: ActionDefinition[] = []
    const changed: { before: ActionDefinition; after: ActionDefinition }[] = []

    // Find removed and changed actions
    for (const beforeAction of before) {
      const afterAction = after.find((a) => a.name === beforeAction.name)
      
      if (!afterAction) {
        removed.push(beforeAction)
      } else if (beforeAction.provider !== afterAction.provider) {
        // Provider changed - this is execution drift!
        changed.push({
          before: beforeAction,
          after: afterAction
        })
      }
    }

    // Find added actions
    for (const afterAction of after) {
      const beforeAction = before.find((a) => a.name === afterAction.name)
      if (!beforeAction) {
        added.push(afterAction)
      }
    }

    return { added, removed, changed }
  }

  /**
   * Generic diff for string arrays (states, events, entities)
   */
  private diffStringArrays(
    before: string[],
    after: string[]
  ): {
    added: string[]
    removed: string[]
  } {
    const added = after.filter((item) => !before.includes(item))
    const removed = before.filter((item) => !after.includes(item))
    return { added, removed }
  }

  /**
   * Calculate operational risk score
   * 
   * This is the SEED of platform value.
   * Risk factors:
   * - Critical: Removed transitions, terminal states
   * - High: Provider changes, removed events
   * - Medium: Additional actions, new transitions
   */
  private calculateRiskScore(changes: {
    removedTransitions: Transition[]
    changedTransitions: TransitionChange[]
    removedStates: string[]
    removedEvents: string[]
    changedActions: { before: ActionDefinition; after: ActionDefinition }[]
    addedActions: ActionDefinition[]
    addedTransitions: Transition[]
  }): RiskScore {
    let score = 0
    const factors: RiskFactor[] = []

    // Critical risk factors (30 points each)
    if (changes.removedTransitions.length > 0) {
      score += changes.removedTransitions.length * 30
      factors.push('critical_transition_removed')
    }

    if (changes.removedStates.length > 0) {
      score += changes.removedStates.length * 30
      factors.push('state_removed')
      
      // TODO: Implement proper terminal state detection
      // For now, we assume all removed states could be terminal states
      // A proper implementation would analyze the transition graph to identify
      // states with no outgoing transitions (actual terminal states)
      factors.push('terminal_state_removed')
    }

    // High risk factors (20 points each)
    if (changes.removedEvents.length > 0) {
      score += changes.removedEvents.length * 20
      factors.push('event_removed')
    }

    if (changes.changedActions.length > 0) {
      score += changes.changedActions.length * 20
      factors.push('provider_changed')
    }

    // Medium risk factors (10 points each)
    if (changes.addedActions.length > 0) {
      score += changes.addedActions.length * 10
      factors.push('action_added')
    }

    if (changes.addedTransitions.length > 0) {
      score += changes.addedTransitions.length * 5
      factors.push('transition_added')
    }

    // Changed transitions (analyze what changed)
    for (const change of changes.changedTransitions) {
      if (change.before.toState !== change.after.toState) {
        // Destination changed - high risk
        score += 25
        factors.push('transition_removed')
      } else if (JSON.stringify(change.before.actions) !== JSON.stringify(change.after.actions)) {
        // Actions changed - medium risk
        score += 15
      }
    }

    // Cap score at 100
    score = Math.min(score, 100)

    return { score, factors }
  }

  /**
   * Map risk score to risk level
   */
  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }
}

import type { ExecutionPlan, PolicyDecision } from '../policy/types.js'
import type { ExecutionStatus } from '../store/execution-record.js'

/**
 * Intent Layer Types
 * 
 * This defines the goal-oriented execution semantics.
 * 
 * Architectural shift:
 * FROM: event → transition → action
 * TO:   intent → strategy → execution plan → adaptive execution
 */

/**
 * GoalDefinition - Operational goal with success criteria
 * 
 * This is the fundamental unit of intent.
 * Goals represent *what* the runtime is trying to achieve,
 * independent of *how* it achieves it.
 */
export type GoalDefinition = {
  id: string
  tenantId: string
  
  // Goal identity
  goal: string  // e.g., "obtain_signed_contract"
  description: string
  
  // Success criteria (evaluated against execution state)
  successCriteria: string[]  // e.g., ["document.state == signed"]
  
  // Priority (affects strategy selection)
  priority: 'low' | 'medium' | 'high' | 'critical'
  
  // Operational strategies that can achieve this goal
  operationalStrategies: string[]  // e.g., ["provider_signature_flow", "manual_review_flow"]
  
  // Timeout (optional)
  timeoutMs?: number
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

/**
 * StrategyDefinition - Operational strategy for achieving a goal
 * 
 * Strategies are the bridge between goals and execution.
 * They define *how* to achieve a goal.
 */
export type StrategyDefinition = {
  id: string
  strategyName: string
  goalId: string
  tenantId: string
  
  // Strategy characteristics
  description: string
  
  // Tactical components
  requiredTransitions: Array<{
    from: string
    to: string
    event: string
  }>
  
  requiredProviders: Array<{
    action: string
    provider: string
    alternateProviders?: string[]
  }>
  
  // Recovery plan
  fallbackStrategy?: string  // Another strategy to try if this fails
  recoveryActions?: string[]
  
  // Expected characteristics
  expectedExecutionTimeMs?: number
  expectedRetryRate?: number
  expectedConvergence?: number
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

/**
 * OperationalIntent - Runtime representation of a goal being pursued
 * 
 * This binds a goal to a specific execution context.
 */
export type OperationalIntent = {
  id: string
  goalId: string
  tenantId: string
  entityId: string
  
  // Current state
  status: 'pending' | 'planning' | 'executing' | 'completed' | 'failed' | 'abandoned'
  
  // Strategy selection
  selectedStrategy?: string
  strategySelectionReason?: string[]
  strategyConfidence?: number  // 0-1
  
  // Fallback strategies (ranked)
  fallbackStrategies: string[]
  
  // Execution tracking
  executionId?: string
  attempts: number
  
  // Outcome
  goalAchieved?: boolean
  failureReason?: string
  
  // Timestamps
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

/**
 * StrategySelection - Result of strategy planning
 * 
 * This is what GoalPlanner produces.
 */
export type StrategySelection = {
  goalId: string
  selectedStrategy: string
  confidence: number  // 0-1
  
  // Reasoning
  rationale: string[]
  
  // Expected outcomes (based on historical data)
  expectedSuccessProbability: number
  expectedExecutionTimeMs?: number
  expectedRetryRate?: number
  
  // Fallback strategies (ranked by likelihood of success)
  fallbackStrategies: Array<{
    strategy: string
    confidence: number
    rationale: string[]
  }>
  
  // Historical evidence
  historicalData: {
    timesApplied: number
    successRate: number
    averageExecutionTimeMs: number
    averageRetries: number
  }
}

/**
 * GoalOutcome - Recorded outcome of a goal execution
 * 
 * This is what GoalOutcomeEvaluator produces and stores.
 */
export type GoalOutcome = {
  id: string
  intentId: string
  goalId: string
  tenantId: string
  entityId: string
  
  // Strategy used
  strategyUsed: string
  fallbacksAttempted: string[]
  
  // Execution results
  executionId: string
  executionStatus: ExecutionStatus
  goalAchieved: boolean
  
  // Success criteria evaluation
  criteriaResults: Array<{
    criterion: string
    satisfied: boolean
    actualValue?: unknown
  }>
  
  // Performance metrics
  totalExecutionTimeMs: number
  retryCount: number
  providerFailures: number
  
  // Effectiveness
  strategyEffectiveness: {
    score: number  // 0-1
    factors: {
      goalAchieved: boolean
      executionEfficiency: number  // 0-1
      recoveryEffectiveness: number  // 0-1, if fallback was used
      timeEfficiency: number  // 0-1
    }
  }
  
  // Timestamps
  startedAt: Date
  completedAt: Date
}

/**
 * AdaptiveExecutionPlan - Synthesized plan for achieving a goal
 * 
 * This is what OperationalPlanSynthesizer produces.
 * Unlike static ExecutionPlan, this includes recovery logic.
 */
export type AdaptiveExecutionPlan = {
  goalId: string
  primaryStrategy: string
  
  // Primary execution plan
  primaryPlan: ExecutionPlan
  
  // Recovery plans (if primary fails)
  recoveryPlans: Array<{
    trigger: 'provider_failure' | 'timeout' | 'state_drift' | 'convergence_failure'
    strategy: string
    plan: ExecutionPlan
    confidence: number
  }>
  
  // Adaptive characteristics
  canReroute: boolean
  canSubstituteProviders: boolean
  canModifyTransitions: boolean
  
  // Predicted outcomes
  predictedSuccessProbability: number
  predictedExecutionTimeMs: number
}

/**
 * IntentAwareGovernanceDecision - Enhanced governance with goal context
 * 
 * This extends PolicyDecision with goal-oriented reasoning.
 */
export type IntentAwareGovernanceDecision = {
  // Standard policy decision
  policyDecision: PolicyDecision
  
  // Intent-aware enhancements
  goalImpact: {
    likelyToAchieveGoal: boolean
    goalCompletionProbability: number  // 0-1
    reasoning: string[]
  }
  
  // Alternative suggestions
  suggestedAlternatives?: Array<{
    modification: string
    expectedImpact: string
    improvedProbability: number
  }>
}

/**
 * StrategyEffectivenessMetrics - Aggregate effectiveness for a strategy
 * 
 * This is computed by GoalOutcomeEvaluator from historical outcomes.
 */
export type StrategyEffectivenessMetrics = {
  strategyName: string
  goalId: string
  tenantId: string
  
  // Aggregate metrics
  totalAttempts: number
  successfulAttempts: number
  successRate: number  // 0-1
  
  // Performance
  averageExecutionTimeMs: number
  averageRetries: number
  averageProviderFailures: number
  
  // Effectiveness score (0-1)
  effectivenessScore: number
  
  // Trend
  recentTrend: 'improving' | 'stable' | 'declining'
  
  // Confidence
  confidence: number  // 0-1, based on sample size
  
  // Computed at
  computedAt: Date
}

/**
 * GoalCompletionRate - Aggregate completion rate for a goal
 * 
 * This shows how well the runtime is achieving goals.
 */
export type GoalCompletionRate = {
  goalId: string
  tenantId: string
  
  // Completion metrics
  totalAttempts: number
  successfulCompletions: number
  completionRate: number  // 0-1
  
  // Strategy breakdown
  strategyPerformance: Array<{
    strategy: string
    attempts: number
    successRate: number
    effectiveness: number
  }>
  
  // Trends
  trendData: Array<{
    period: string
    completionRate: number
    totalAttempts: number
  }>
  
  // Computed at
  computedAt: Date
}

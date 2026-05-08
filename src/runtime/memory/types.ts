import type { PolicyDecision, EnforcementAction } from '../policy/types.js'
import type { ExecutionStatus } from '../store/execution-record.js'

/**
 * RuntimeMemoryRecord - Record of a governance decision and its outcome
 * 
 * This is the fundamental unit of operational memory.
 * Each record captures:
 * - What triggered the governance decision
 * - What action was taken
 * - What the outcome was
 * - How effective the strategy was
 */
export type RuntimeMemoryRecord = {
  id: string
  tenantId: string

  // Trigger context
  trigger: {
    type: 'provider_instability' | 'high_entropy' | 'low_convergence' | 'canonical_drift'
    context: Record<string, unknown>
    timestamp: Date
  }

  // Governance decision made
  decision: {
    policyDecision: PolicyDecision
    enforcementActions: EnforcementAction[]
    strategyApplied: string  // e.g., "reroute:provider_a->provider_b"
    rationale: string[]
  }

  // Execution outcome
  outcome: {
    executionId: string
    status: ExecutionStatus
    retryCount?: number
    failureReason?: string
    convergenceImprovement?: number  // Change in convergence score
    entropyChange?: number           // Change in entropy
    stabilityImprovement?: number    // Change in provider stability
    completedAt?: Date
  }

  // Strategy effectiveness
  effectiveness: {
    score: number  // 0-1, higher is better
    factors: {
      executionSuccess: boolean
      retryReduction: number      // Reduction in retries compared to baseline
      convergenceGain: number     // Improvement in convergence
      entropyReduction: number    // Reduction in operational entropy
    }
  }

  createdAt: Date
  outcomeCapturedAt?: Date
}

/**
 * StrategyPattern - Learned pattern for a governance strategy
 */
export type StrategyPattern = {
  strategyName: string
  triggerType: string
  
  // Historical effectiveness
  timesApplied: number
  successRate: number        // Percentage of successful executions
  averageRetryReduction: number
  averageConvergenceGain: number
  averageEntropyReduction: number
  
  // Aggregate effectiveness score
  effectivenessScore: number  // 0-1
  
  // Trend
  recentTrend: 'improving' | 'stable' | 'declining'
  
  // Last applied
  lastApplied: Date
}

/**
 * TenantOperationalProfile - Learned operational characteristics for a tenant
 */
export type TenantOperationalProfile = {
  tenantId: string
  
  // Preferred strategies (ranked by effectiveness)
  preferredStrategies: Array<{
    strategy: string
    effectivenessScore: number
    confidence: number  // 0-1, based on sample size
  }>
  
  // Problem patterns
  commonTriggers: Array<{
    triggerType: string
    frequency: number
    lastOccurred: Date
  }>
  
  // Provider preferences (learned from outcomes)
  providerPreferences: Map<string, {
    stability: number
    reliability: number
    preferredFor: string[]  // Actions this provider excels at
  }>
  
  // Learning metadata
  totalMemoryRecords: number
  learningConfidence: number  // 0-1, increases with more data
  profileGeneratedAt: Date
}

/**
 * MemoryQuery - Query parameters for runtime memory
 */
export type MemoryQuery = {
  tenantId: string
  triggerType?: string
  strategyApplied?: string
  minEffectiveness?: number
  startDate?: Date
  endDate?: Date
  limit?: number
}

/**
 * MemoryInsight - Insight derived from runtime memory
 */
export type MemoryInsight = {
  type: 'strategy_recommendation' | 'pattern_detected' | 'effectiveness_change'
  severity: 'info' | 'warning' | 'critical'
  message: string
  data: Record<string, unknown>
  generatedAt: Date
}

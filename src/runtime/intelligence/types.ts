/**
 * Core types for the Emergent Canonical Intelligence Layer
 * 
 * This module defines the data structures for:
 * - Execution patterns
 * - Canonical transitions
 * - Provider patterns
 * - Operational topology snapshots
 */

/**
 * ExecutionPattern - Represents a detected execution path pattern
 */
export type ExecutionPattern = {
  path: string[]              // Sequence of states in the path
  frequency: number           // Number of times this path was executed
  successRate: number         // Percentage of successful executions (0-1)
  averageDurationMs: number   // Average time to complete this path
}

/**
 * CanonicalState - Represents a state with its operational centrality
 */
export type CanonicalState = {
  state: string               // State name
  centrality: number          // How central this state is in the workflow (0-1)
  executionCount: number      // Number of times entities were in this state
}

/**
 * CanonicalTransition - Represents a weighted transition in the operational graph
 */
export type CanonicalTransition = {
  from: string                // Source state
  to: string                  // Destination state
  eventType: string           // Event that triggers this transition
  confidence: number          // Confidence score based on execution frequency (0-1)
  executionCount: number      // Number of times this transition was executed
  successRate: number         // Percentage of successful transitions (0-1)
}

/**
 * ProviderPattern - Represents dominant provider usage for an action
 */
export type ProviderPattern = {
  action: string              // Action name
  provider: string            // Provider name (e.g., 'docuseal')
  usage: number               // Usage percentage (0-1)
  successRate: number         // Success rate for this provider (0-1)
  executionCount: number      // Number of times this provider was used
}

/**
 * OperationalTopologySnapshot - Durable artifact capturing operational behavior
 */
export type OperationalTopologySnapshot = {
  tenantId: string
  generatedAt: string

  canonicalStates: CanonicalState[]
  canonicalTransitions: CanonicalTransition[]
  dominantProviders: ProviderPattern[]
  stablePaths: ExecutionPattern[]

  entropyScore: number              // Measure of operational complexity (0-1)
  operationalComplexity: number     // Number of unique paths / theoretical max
  canonicalConfidence: number       // Overall confidence in canonical inference (0-1)
}

/**
 * DriftAnalysis - Comparison between declared model and observed behavior
 */
export type DriftAnalysis = {
  tenantId: string
  driftDetected: boolean
  unusedTransitions: string[]       // Transitions defined but never used
  shadowTransitions: string[]       // Transitions used but not formally defined
  entropyScore: number              // Measure of behavioral unpredictability
  recommendations: string[]         // Suggested model improvements
}

/**
 * TransitionWeight - Internal representation for weighted graph
 */
export type TransitionWeight = {
  from: string
  to: string
  eventType: string
  weight: number                    // Normalized weight (0-1)
  count: number
  successCount: number
  failureCount: number
}

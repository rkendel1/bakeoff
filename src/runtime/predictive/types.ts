/**
 * Predictive Runtime Intelligence Types
 * 
 * Architectural shift:
 * FROM: observe → adapt
 * TO:   predict → prevent → optimize
 * 
 * This is where the runtime gains anticipatory operational cognition.
 */

/**
 * PredictedRisk - A specific operational risk forecast
 */
export type PredictedRisk = {
  type: 'provider_instability' | 'strategy_decay' | 'convergence_collapse' | 'entropy_expansion' | 'execution_failure' | 'goal_failure'
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Probability value from 0 to 1 (inclusive), where 0 = impossible, 1 = certain */
  probability: number
  forecastWindow: string  // e.g., "24h", "7d"
  
  // Risk details
  description: string
  affectedComponents: string[]  // providers, strategies, goals, etc.
  
  // Trending
  trend: 'increasing' | 'stable' | 'decreasing'
  
  // Evidence
  evidence: Array<{
    signal: string
    value: number
    threshold?: number
  }>
  
  // Recommended actions
  recommendedActions: string[]
  
  // Confidence in prediction
  confidence: number  // 0-1
}

/**
 * PredictiveRiskAssessment - Complete risk forecast for a tenant
 */
export type PredictiveRiskAssessment = {
  tenantId: string
  forecastWindow: string
  
  // All identified risks
  risks: PredictedRisk[]
  
  // Aggregate risk score
  overallRiskScore: number  // 0-1
  
  // Confidence in overall assessment
  confidence: number  // 0-1
  
  // Timestamp
  generatedAt: Date
  
  // Recommendations
  preemptiveActions: Array<{
    action: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    expectedImpact: string
    estimatedRiskReduction: number
  }>
}

/**
 * StrategyDecay - Detection of strategy effectiveness degradation
 */
export type StrategyDecay = {
  tenantId: string
  strategyName: string
  goalId: string
  
  // Historical performance
  historicalSuccessRate: number
  recentSuccessRate: number
  
  // Decay metrics
  decayRate: number  // Rate of decline
  decayVelocity: number  // Speed of decline
  
  // Trend
  trend: 'rapid_decline' | 'gradual_decline' | 'stable' | 'improving'
  
  // Evidence
  dataPoints: Array<{
    timestamp: Date
    successRate: number
    sampleSize: number
  }>
  
  // Forecast
  predictedSuccessRate24h: number
  predictedSuccessRate7d: number
  
  // Confidence
  confidence: number  // 0-1
  
  // Detection timestamp
  detectedAt: Date
}

/**
 * FailureTrajectory - Pattern analysis preceding failures
 */
export type FailureTrajectory = {
  tenantId: string
  
  // Pattern identification
  patternType: 'provider_degradation' | 'entropy_spike' | 'convergence_decline' | 'retry_escalation'
  
  // Current state
  currentState: {
    retryRate: number
    entropyScore: number
    convergenceScore: number
    providerStability: number
  }
  
  // Trajectory
  trajectory: 'stable' | 'degrading' | 'critical'
  
  // Time to predicted failure
  timeToFailure?: string  // e.g., "6h", "2d"
  failureProbability: number  // 0-1
  
  // Evidence
  leadingIndicators: Array<{
    indicator: string
    currentValue: number
    threshold: number
    deviation: number
  }>
  
  // Confidence
  confidence: number  // 0-1
  
  // Timestamp
  analyzedAt: Date
}

/**
 * GoalCompletionForecast - Prediction of goal completion outcomes
 */
export type GoalCompletionForecast = {
  goalId: string
  tenantId: string
  
  // Success prediction
  predictedSuccessProbability: number  // 0-1
  
  // Risk factors
  riskFactors: Array<{
    factor: string
    impact: number  // -1 to 1
    description: string
  }>
  
  // Expected outcomes
  expectedRetries: number
  expectedExecutionTimeMs: number
  expectedConvergenceImpact: number
  
  // Fallback likelihood
  fallbackRequirementProbability: number
  
  // Recommended preemptive actions
  recommendedPreemptiveActions: Array<{
    action: string
    expectedImpact: string
    successProbabilityIncrease: number
  }>
  
  // Confidence
  confidence: number  // 0-1
  
  // Timestamp
  forecastedAt: Date
}

/**
 * EntropyForecast - Prediction of operational fragmentation
 */
export type EntropyForecast = {
  tenantId: string
  
  // Current entropy state
  currentEntropy: number
  
  // Predicted entropy
  predictedEntropy24h: number
  predictedEntropy7d: number
  
  // Trajectory
  entropyTrajectory: 'converging' | 'stable' | 'diverging' | 'fragmenting'
  
  // Fragmentation risks
  fragmentationRisks: Array<{
    riskType: string
    probability: number
    impact: string
  }>
  
  // Convergence forecast
  convergenceVelocity: number  // Positive = converging, negative = diverging
  timeToStableConvergence?: string
  
  // Confidence
  confidence: number  // 0-1
  
  // Timestamp
  forecastedAt: Date
}

/**
 * RuntimeForecast - Comprehensive forecast record
 */
export type RuntimeForecast = {
  id: string
  tenantId: string
  forecastType: 'risk_assessment' | 'strategy_decay' | 'failure_trajectory' | 'goal_completion' | 'entropy_trajectory'
  
  // Forecast data (one of the above types)
  forecastData: PredictiveRiskAssessment | StrategyDecay | FailureTrajectory | GoalCompletionForecast | EntropyForecast
  
  // Metadata
  generatedAt: Date
  forecastHorizon: string
  confidence: number
  
  // Outcome tracking (filled in later)
  actualOutcome?: {
    occurred: boolean
    accuracy: number  // How accurate was the prediction
    actualData?: unknown
    verifiedAt: Date
  }
}

/**
 * PredictiveGovernanceRecommendation - Governance enhanced with forecasts
 */
export type PredictiveGovernanceRecommendation = {
  tenantId: string
  
  // Current execution context
  currentRisks: PredictedRisk[]
  
  // Governance recommendations
  recommendations: Array<{
    type: 'preventive' | 'adaptive' | 'recovery'
    action: string
    rationale: string[]
    expectedImpact: string
    priority: 'low' | 'medium' | 'high' | 'critical'
  }>
  
  // Predicted execution safety
  predictedExecutionSafety: 'safe' | 'risky' | 'unsafe'
  executionRiskScore: number  // 0-1
  
  // Confidence
  confidence: number  // 0-1
  
  // Timestamp
  generatedAt: Date
}

/**
 * ForecastAccuracyMetrics - Track prediction accuracy over time
 */
export type ForecastAccuracyMetrics = {
  forecastType: string
  tenantId: string
  
  // Accuracy stats
  totalForecasts: number
  verifiedForecasts: number
  averageAccuracy: number  // 0-1
  
  // By confidence level
  accuracyByConfidence: Array<{
    confidenceRange: string
    accuracy: number
    sampleSize: number
  }>
  
  // Trend
  accuracyTrend: 'improving' | 'stable' | 'declining'
  
  // Computed at
  computedAt: Date
}

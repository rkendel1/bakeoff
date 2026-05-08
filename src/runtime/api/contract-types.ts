/**
 * Runtime-Core Contract Specification v1
 * 
 * This defines the strict, versioned contract that OperNext uses to communicate
 * with runtime-core (bakeoff).
 * 
 * CORE DESIGN PRINCIPLE (NON-NEGOTIABLE):
 * - OperNext describes INTENT
 * - Runtime-core returns DECISION + REASONING + PREDICTED FUTURE STATE + EXECUTION TRACE
 * - OperNext NEVER instructs execution logic
 * 
 * Contract Version: 1.0.0
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOMAIN A: INTENT INGESTION CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * POST /runtime/v1/intent
 * 
 * This is where OperNext expresses "what it wants to achieve"
 * WITHOUT specifying "how to achieve it"
 */

/**
 * IntentRequest - What OperNext sends to runtime-core
 * 
 * This is a pure expression of intent with context.
 */
export type IntentRequest = {
  tenantId: string

  intent: {
    /** Unique goal identifier (e.g., "obtain_signed_contract") */
    goalId: string
    
    /** Intent type (enables runtime to classify and route) */
    type: string
    
    /** Contextual data about the intent */
    context: Record<string, unknown>
    
    /** Success criteria expressed as constraints */
    successCriteria: string[]
    
    /** Priority hint (not a command) */
    priority?: 'low' | 'medium' | 'high' | 'critical'
    
    /** Optional timeout hint (runtime may adjust) */
    timeoutMs?: number
  }

  /** Current operational state (what OperNext knows) */
  currentState?: {
    entityId: string
    entityType: string
    knownState: Record<string, unknown>
  }

  /** Constraints and preferences (not commands) */
  constraints?: {
    /** Preferred execution characteristics */
    preferences?: {
      speed?: 'fast' | 'balanced' | 'thorough'
      reliability?: 'standard' | 'high' | 'critical'
      cost?: 'optimized' | 'balanced' | 'premium'
    }
    
    /** Hard constraints (runtime must respect) */
    mustAvoid?: string[]  // e.g., ["provider_x", "manual_approval"]
    mustInclude?: string[]  // e.g., ["audit_trail", "encryption"]
    
    /** Compliance requirements */
    complianceRequirements?: string[]
  }

  /** Request metadata */
  metadata?: {
    correlationId?: string
    originatingSystem?: string
    userContext?: Record<string, unknown>
  }
}

/**
 * IntentResponse - What runtime-core returns to OperNext
 * 
 * This includes:
 * - The decision (strategy selection)
 * - The reasoning (why this decision)
 * - Predicted future state (what will likely happen)
 * - Execution trace (how to track progress)
 */
export type IntentResponse = {
  /** Unique request identifier */
  requestId: string
  
  /** Intent acknowledgment */
  intent: {
    goalId: string
    status: 'accepted' | 'rejected' | 'pending'
    rejectionReason?: string
  }

  /** Runtime's decision */
  decision: {
    /** Selected strategy */
    selectedStrategy: {
      strategyName: string
      strategyId: string
      description: string
      
      /** Why this strategy was selected */
      selectionReasoning: Array<{
        factor: string
        weight: number
        rationale: string
      }>
      
      /** Confidence in this selection (0-1) */
      confidence: number
    }

    /** Fallback strategies (ranked) */
    fallbackStrategies: Array<{
      strategyName: string
      strategyId: string
      confidence: number
      triggerConditions: string[]
    }>

    /** Adaptive governance decisions */
    governance: {
      /** Will runtime apply adaptive governance? */
      adaptiveGovernanceEnabled: boolean
      
      /** Policies that will be applied */
      activePolicies: Array<{
        policyId: string
        policyType: string
        description: string
      }>
      
      /** Risk mitigations */
      riskMitigations: Array<{
        riskType: string
        mitigationAction: string
        reasoning: string
      }>
    }
  }

  /** Predicted future state */
  prediction: {
    /** Expected outcome */
    expectedOutcome: {
      /** Will the goal likely be achieved? */
      goalAchievementProbability: number  // 0-1
      
      /** Predicted final state */
      predictedFinalState: Record<string, unknown>
      
      /** Predicted timeline */
      predictedExecutionTimeMs: number
      
      /** Expected resource usage */
      expectedResourceUsage: {
        providerCalls: number
        estimatedCost?: number
        estimatedRetries: number
      }
    }

    /** Predicted risks */
    risks: Array<{
      riskType: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      probability: number  // 0-1
      description: string
      mitigation: string
    }>

    /** Confidence in predictions */
    predictionConfidence: {
      overall: number  // 0-1
      basedOnSamples: number
      historicalAccuracy: number  // 0-1
    }
  }

  /** Execution trace contract */
  execution: {
    /** Unique execution identifier */
    executionId: string
    
    /** How to track execution progress */
    trackingEndpoint: string  // e.g., "/runtime/v1/execution/{executionId}"
    
    /** Expected checkpoints */
    expectedCheckpoints: Array<{
      checkpointId: string
      description: string
      expectedTimestampRelativeMs: number
    }>
    
    /** Real-time updates available */
    supportsRealTimeUpdates: boolean
    websocketEndpoint?: string
  }

  /** Intelligence snapshot */
  intelligence: {
    /** Current runtime intelligence about this goal */
    goalIntelligence: {
      /** Historical success rate */
      historicalSuccessRate: number
      
      /** Total attempts */
      totalAttempts: number
      
      /** Recent trend */
      recentTrend: 'improving' | 'stable' | 'declining'
    }

    /** Strategy effectiveness */
    strategyEffectiveness: Array<{
      strategyName: string
      successRate: number
      averageExecutionTimeMs: number
      effectivenessScore: number
    }>

    /** Current operational health */
    operationalHealth: {
      systemEntropy: number
      convergenceScore: number
      providerStability: number
    }
  }

  /** Response metadata */
  metadata: {
    processedAt: string  // ISO 8601
    runtimeVersion: string
    processingTimeMs: number
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOMAIN B: STRATEGY DECISION CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * GET /runtime/v1/decision/context
 * POST /runtime/v1/decision/evaluate
 * 
 * This exposes the runtime's decision-making intelligence to OperNext
 * WITHOUT giving OperNext control over decisions
 */

/**
 * DecisionContextRequest - Request decision context for a goal
 */
export type DecisionContextRequest = {
  tenantId: string
  goalId: string
  
  /** Optional: current state to evaluate */
  currentState?: Record<string, unknown>
}

/**
 * DecisionContextResponse - Runtime's decision context
 */
export type DecisionContextResponse = {
  goalId: string
  tenantId: string
  
  /** Available strategies */
  availableStrategies: Array<{
    strategyId: string
    strategyName: string
    description: string
    
    /** Strategy characteristics */
    characteristics: {
      expectedSuccessRate: number
      expectedExecutionTimeMs: number
      expectedRetries: number
      providerDependencies: string[]
    }
    
    /** Historical performance */
    historicalPerformance: {
      totalAttempts: number
      successfulAttempts: number
      averageExecutionTimeMs: number
      effectivenessScore: number
    }
    
    /** Current suitability */
    currentSuitability: {
      recommended: boolean
      suitabilityScore: number  // 0-1
      reasoning: string[]
    }
  }>

  /** Current operational context */
  operationalContext: {
    /** Current system health */
    systemHealth: {
      entropy: number
      convergence: number
      providerStability: number
    }
    
    /** Active risks */
    activeRisks: Array<{
      riskType: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      affectedStrategies: string[]
    }>
    
    /** Predictive insights */
    predictiveInsights: {
      strategyDecayDetected: boolean
      failureTrajectoryDetected: boolean
      entropyTrend: 'converging' | 'stable' | 'diverging'
    }
  }

  /** Calibration context */
  calibration: {
    /** Is calibration active? */
    calibrationEnabled: boolean
    
    /** Current prediction accuracy */
    predictionAccuracy: {
      overall: number  // 0-1
      byStrategy: Record<string, number>
    }
    
    /** Confidence adjustments */
    confidenceAdjustments: {
      applied: boolean
      adjustmentFactor: number
      reasoning: string
    }
  }

  metadata: {
    generatedAt: string
    validForMs: number
  }
}

/**
 * DecisionEvaluationRequest - Ask runtime to evaluate a hypothetical decision
 */
export type DecisionEvaluationRequest = {
  tenantId: string
  goalId: string
  
  /** Hypothetical strategy to evaluate */
  hypotheticalStrategy?: string
  
  /** Alternative: evaluate current best */
  evaluateCurrentBest?: boolean
  
  /** Context for evaluation */
  evaluationContext?: Record<string, unknown>
}

/**
 * DecisionEvaluationResponse - Runtime's evaluation
 */
export type DecisionEvaluationResponse = {
  evaluatedStrategy: string
  
  /** Evaluation results */
  evaluation: {
    /** Overall score (0-1) */
    overallScore: number
    
    /** Detailed scoring */
    scoring: {
      successProbability: number
      riskScore: number
      efficiencyScore: number
      reliabilityScore: number
    }
    
    /** Predicted outcome */
    predictedOutcome: {
      goalAchievementProbability: number
      expectedExecutionTimeMs: number
      expectedRetries: number
      riskFactors: string[]
    }
    
    /** Comparative analysis */
    comparedToAlternatives: Array<{
      alternativeStrategy: string
      scoreComparison: number  // -1 to 1 (worse to better)
      reasoning: string
    }>
  }

  /** Recommendation */
  recommendation: {
    recommended: boolean
    confidence: number
    reasoning: string[]
    suggestedAlternatives?: string[]
  }

  metadata: {
    evaluatedAt: string
    evaluationTimeMs: number
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOMAIN C: EXECUTION CONTROL CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * GET /runtime/v1/execution/{executionId}
 * GET /runtime/v1/execution/{executionId}/trace
 * POST /runtime/v1/execution/{executionId}/observe
 * 
 * This enables OperNext to observe execution WITHOUT controlling it
 */

/**
 * ExecutionStatusResponse - Current execution status
 */
export type ExecutionStatusResponse = {
  executionId: string
  goalId: string
  tenantId: string
  
  /** Current status */
  status: {
    /** Current phase */
    phase: 'planning' | 'governing' | 'executing' | 'recovering' | 'completed' | 'failed'
    
    /** Detailed status */
    detailedStatus: string
    
    /** Progress (0-1) */
    progress: number
    
    /** Current checkpoint */
    currentCheckpoint?: {
      checkpointId: string
      reachedAt: string
      description: string
    }
  }

  /** Strategy being executed */
  strategy: {
    strategyName: string
    strategyId: string
    
    /** Is this a fallback? */
    isFallback: boolean
    fallbackReason?: string
    
    /** Attempts made */
    attemptNumber: number
    maxAttempts: number
  }

  /** Current state */
  currentState: {
    /** Entity state */
    entityState: Record<string, unknown>
    
    /** Execution state */
    executionState: {
      completedActions: number
      totalActions: number
      failedActions: number
      retriedActions: number
    }
    
    /** Goal progress */
    goalProgress: {
      criteriaSatisfied: number
      totalCriteria: number
      criteriaDetails: Array<{
        criterion: string
        satisfied: boolean
        currentValue?: unknown
      }>
    }
  }

  /** Real-time predictions */
  predictions: {
    /** Updated success probability */
    goalAchievementProbability: number
    
    /** Estimated time remaining */
    estimatedTimeRemainingMs: number
    
    /** Risk updates */
    emergingRisks: Array<{
      riskType: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      detectedAt: string
      mitigation: string
    }>
  }

  /** Adaptive actions taken */
  adaptiveActions: Array<{
    actionType: string
    takenAt: string
    reasoning: string
    impact: string
  }>

  metadata: {
    startedAt: string
    lastUpdatedAt: string
    elapsedTimeMs: number
  }
}

/**
 * ExecutionTraceResponse - Detailed execution trace
 */
export type ExecutionTraceResponse = {
  executionId: string
  goalId: string
  
  /** Complete execution trace */
  trace: Array<{
    timestamp: string
    phase: string
    event: string
    details: Record<string, unknown>
    
    /** Decision points */
    decisionPoint?: {
      decision: string
      reasoning: string[]
      alternatives: string[]
    }
    
    /** Governance actions */
    governanceAction?: {
      policyApplied: string
      action: string
      reasoning: string
    }
    
    /** Provider interactions */
    providerInteraction?: {
      provider: string
      action: string
      status: 'success' | 'failure' | 'retry'
      duration: number
    }
  }>

  /** Checkpoints reached */
  checkpoints: Array<{
    checkpointId: string
    reachedAt: string
    expectedAt: string
    timeDifferenceMs: number
  }>

  /** Complete timeline */
  timeline: {
    planningDurationMs: number
    governanceDurationMs: number
    executionDurationMs: number
    totalDurationMs: number
  }

  metadata: {
    generatedAt: string
  }
}

/**
 * ObservationRequest - OperNext sends observations back to runtime
 * 
 * This enables runtime to learn from external observations
 */
export type ObservationRequest = {
  executionId: string
  
  /** Observations */
  observations: Array<{
    observationType: string
    observedAt: string
    observedValue: unknown
    confidence: number
    source: string
  }>

  /** External signals */
  externalSignals?: Array<{
    signalType: string
    signalValue: unknown
    timestamp: string
  }>
}

/**
 * ObservationResponse - Runtime acknowledges observations
 */
export type ObservationResponse = {
  executionId: string
  observationsReceived: number
  
  /** How observations affected runtime state */
  impact: {
    predictionUpdated: boolean
    strategyAdjusted: boolean
    governanceTriggered: boolean
    
    changes: Array<{
      changeType: string
      description: string
      reasoning: string
    }>
  }

  metadata: {
    processedAt: string
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOMAIN D: INTELLIGENCE EXPOSURE CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * GET /runtime/v1/intelligence/forecast
 * GET /runtime/v1/intelligence/learning
 * GET /runtime/v1/intelligence/recommendations
 * 
 * This safely exposes runtime intelligence to OperNext
 */

/**
 * IntelligenceForecastRequest - Request predictive intelligence
 */
export type IntelligenceForecastRequest = {
  tenantId: string
  
  /** What to forecast */
  forecastType: 'risk_assessment' | 'strategy_performance' | 'system_health' | 'goal_outcomes'
  
  /** Forecast horizon */
  forecastHorizon: '1h' | '6h' | '24h' | '7d' | '30d'
  
  /** Optional: specific scope */
  scope?: {
    goalIds?: string[]
    strategyNames?: string[]
  }
}

/**
 * IntelligenceForecastResponse - Runtime's predictive intelligence
 */
export type IntelligenceForecastResponse = {
  tenantId: string
  forecastType: string
  forecastHorizon: string
  
  /** Forecasts */
  forecasts: Array<{
    forecastId: string
    forecastType: string
    
    /** Predicted events */
    predictedEvents: Array<{
      eventType: string
      probability: number  // 0-1
      predictedTimeframe: string
      severity?: 'low' | 'medium' | 'high' | 'critical'
      description: string
    }>
    
    /** Predicted metrics */
    predictedMetrics: Record<string, {
      currentValue: number
      predictedValue: number
      trend: 'improving' | 'stable' | 'declining'
      confidence: number
    }>
    
    /** Confidence */
    confidence: number
    
    /** Based on */
    basedOn: {
      historicalSamples: number
      similarPatterns: number
      calibrationAccuracy: number
    }
  }>

  /** Recommended actions */
  recommendedActions: Array<{
    actionType: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    description: string
    expectedImpact: string
    preventsPredictedEvent?: string
  }>

  metadata: {
    generatedAt: string
    validUntil: string
    confidenceLevel: number
  }
}

/**
 * IntelligenceLearningRequest - Request learning insights
 */
export type IntelligenceLearningRequest = {
  tenantId: string
  
  /** What learning to expose */
  learningType: 'strategy_effectiveness' | 'pattern_discovery' | 'convergence_analysis' | 'provider_reliability'
  
  /** Optional: time range */
  timeRange?: {
    from: string
    to: string
  }
}

/**
 * IntelligenceLearningResponse - Runtime's learned knowledge
 */
export type IntelligenceLearningResponse = {
  tenantId: string
  learningType: string
  
  /** Learned patterns */
  learnedPatterns: Array<{
    patternId: string
    patternType: string
    description: string
    
    /** Pattern characteristics */
    characteristics: {
      frequency: number
      reliability: number
      context: string[]
    }
    
    /** Evidence */
    evidence: {
      observations: number
      confidence: number
      firstSeen: string
      lastSeen: string
    }
    
    /** Actionable insights */
    insights: string[]
  }>

  /** Strategy insights */
  strategyInsights: Array<{
    strategyName: string
    
    /** What we learned */
    learnings: Array<{
      learning: string
      confidence: number
      basedOnSamples: number
    }>
    
    /** Effectiveness factors */
    effectivenessFactors: Array<{
      factor: string
      impact: number  // -1 to 1
      description: string
    }>
  }>

  /** System-level learnings */
  systemLearnings: {
    /** Optimal operating conditions */
    optimalConditions: Array<{
      condition: string
      description: string
      observedImpact: string
    }>
    
    /** Anti-patterns discovered */
    antiPatterns: Array<{
      pattern: string
      description: string
      avoidanceRecommendation: string
    }>
  }

  metadata: {
    generatedAt: string
    basedOnSamples: number
    confidenceLevel: number
  }
}

/**
 * IntelligenceRecommendationRequest - Request recommendations
 */
export type IntelligenceRecommendationRequest = {
  tenantId: string
  
  /** Recommendation scope */
  recommendationType: 'optimization' | 'risk_mitigation' | 'cost_reduction' | 'performance_improvement'
  
  /** Optional: specific context */
  context?: {
    goalIds?: string[]
    currentChallenges?: string[]
  }
}

/**
 * IntelligenceRecommendationResponse - Runtime's recommendations
 */
export type IntelligenceRecommendationResponse = {
  tenantId: string
  recommendationType: string
  
  /** Recommendations (ranked by impact) */
  recommendations: Array<{
    recommendationId: string
    type: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    
    /** The recommendation */
    recommendation: {
      title: string
      description: string
      actionableSteps: string[]
    }
    
    /** Expected impact */
    expectedImpact: {
      impactType: string
      estimatedImprovement: number
      affectedGoals: string[]
      confidenceInImpact: number
    }
    
    /** Evidence */
    evidence: {
      basedOn: string[]
      supportingData: Array<{
        dataPoint: string
        value: number
        significance: number
      }>
    }
    
    /** Implementation */
    implementation: {
      complexity: 'low' | 'medium' | 'high'
      estimatedEffort: string
      prerequisites?: string[]
    }
  }>

  /** Strategic insights */
  strategicInsights: Array<{
    insight: string
    category: string
    significance: 'informational' | 'important' | 'critical'
    reasoning: string[]
  }>

  metadata: {
    generatedAt: string
    validUntil: string
    confidenceLevel: number
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRACT VERSION AND EVOLUTION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * ContractVersion - Version metadata
 */
export type ContractVersion = {
  version: string  // Semantic version (e.g., "1.0.0")
  releasedAt: string
  
  /** Breaking changes from previous version */
  breakingChanges?: string[]
  
  /** New features */
  newFeatures?: string[]
  
  /** Deprecations */
  deprecations?: Array<{
    feature: string
    deprecatedAt: string
    removalPlannedFor: string
    replacement: string
  }>
}

/**
 * Current contract version
 */
export const RUNTIME_CORE_CONTRACT_VERSION: ContractVersion = {
  version: '1.0.0',
  releasedAt: '2026-05-08',
  newFeatures: [
    'Intent Ingestion Contract',
    'Strategy Decision Contract',
    'Execution Control Contract',
    'Intelligence Exposure Contract'
  ]
}

# Runtime-Core Contract Specification v1.0.0

**PR-018 — Runtime-Core Contract Specification (OperNext ↔ Bakeoff Interface)**

---

## Goal

Define a strict, versioned contract that OperNext uses to communicate with runtime-core (bakeoff), including:
- what OperNext sends
- what runtime-core guarantees
- what runtime-core returns
- how decisions, forecasts, and executions are expressed
- how evolution (intelligence/prediction/governance) is exposed safely

---

## 1. Core Design Principle (NON-NEGOTIABLE)

**OperNext describes intent.**  
**Runtime-core returns decision + reasoning + predicted future state + execution trace.**

**OperNext NEVER instructs execution logic.**

This is a fundamental architectural constraint that ensures:
- Runtime maintains autonomy over execution decisions
- OperNext focuses on outcomes, not implementation
- Intelligence and learning remain centralized in runtime-core
- Evolution of execution strategies doesn't break OperNext

---

## 2. Contract Overview

You are defining a single unified interface:

**RuntimeCoreContract v1**

Split into 4 domains:

### Domain A: Intent Ingestion Contract
- **Endpoint:** `POST /runtime/v1/intent`
- **Purpose:** OperNext expresses "what it wants to achieve"
- **Returns:** Decision + reasoning + prediction + tracking

### Domain B: Strategy Decision Contract
- **Endpoints:** 
  - `GET /runtime/v1/decision/context`
  - `POST /runtime/v1/decision/evaluate`
- **Purpose:** Expose decision-making intelligence
- **Returns:** Strategy context, evaluations, recommendations

### Domain C: Execution Control Contract
- **Endpoints:**
  - `GET /runtime/v1/execution/{executionId}`
  - `GET /runtime/v1/execution/{executionId}/trace`
  - `POST /runtime/v1/execution/{executionId}/observe`
- **Purpose:** Observe execution WITHOUT controlling it
- **Returns:** Status, trace, adaptive actions

### Domain D: Intelligence Exposure Contract
- **Endpoints:**
  - `GET /runtime/v1/intelligence/forecast`
  - `GET /runtime/v1/intelligence/learning`
  - `GET /runtime/v1/intelligence/recommendations`
- **Purpose:** Safely expose runtime intelligence
- **Returns:** Forecasts, learned patterns, recommendations

---

## 3. Domain A: Intent Ingestion Contract

### POST /runtime/v1/intent

#### What OperNext Sends (IntentRequest)

```typescript
{
  tenantId: string

  intent: {
    goalId: string           // e.g., "obtain_signed_contract"
    type: string             // e.g., "document_lifecycle"
    context: Record<string, unknown>
    successCriteria: string[]  // e.g., ["document.state == signed"]
    priority?: 'low' | 'medium' | 'high' | 'critical'
    timeoutMs?: number
  }

  currentState?: {
    entityId: string
    entityType: string
    knownState: Record<string, unknown>
  }

  constraints?: {
    preferences?: {
      speed?: 'fast' | 'balanced' | 'thorough'
      reliability?: 'standard' | 'high' | 'critical'
      cost?: 'optimized' | 'balanced' | 'premium'
    }
    mustAvoid?: string[]
    mustInclude?: string[]
    complianceRequirements?: string[]
  }

  metadata?: {
    correlationId?: string
    originatingSystem?: string
    userContext?: Record<string, unknown>
  }
}
```

#### What Runtime-Core Returns (IntentResponse)

```typescript
{
  requestId: string
  
  intent: {
    goalId: string
    status: 'accepted' | 'rejected' | 'pending'
    rejectionReason?: string
  }

  // DECISION: What the runtime decided
  decision: {
    selectedStrategy: {
      strategyName: string
      strategyId: string
      description: string
      selectionReasoning: Array<{
        factor: string
        weight: number
        rationale: string
      }>
      confidence: number  // 0-1
    }
    
    fallbackStrategies: Array<{
      strategyName: string
      strategyId: string
      confidence: number
      triggerConditions: string[]
    }>
    
    governance: {
      adaptiveGovernanceEnabled: boolean
      activePolicies: Array<{
        policyId: string
        policyType: string
        description: string
      }>
      riskMitigations: Array<{
        riskType: string
        mitigationAction: string
        reasoning: string
      }>
    }
  }

  // PREDICTION: What the runtime predicts will happen
  prediction: {
    expectedOutcome: {
      goalAchievementProbability: number  // 0-1
      predictedFinalState: Record<string, unknown>
      predictedExecutionTimeMs: number
      expectedResourceUsage: {
        providerCalls: number
        estimatedCost?: number
        estimatedRetries: number
      }
    }
    
    risks: Array<{
      riskType: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      probability: number  // 0-1
      description: string
      mitigation: string
    }>
    
    predictionConfidence: {
      overall: number  // 0-1
      basedOnSamples: number
      historicalAccuracy: number  // 0-1
    }
  }

  // EXECUTION TRACE: How to track what happens
  execution: {
    executionId: string
    trackingEndpoint: string
    expectedCheckpoints: Array<{
      checkpointId: string
      description: string
      expectedTimestampRelativeMs: number
    }>
    supportsRealTimeUpdates: boolean
    websocketEndpoint?: string
  }

  // INTELLIGENCE: What the runtime knows
  intelligence: {
    goalIntelligence: {
      historicalSuccessRate: number
      totalAttempts: number
      recentTrend: 'improving' | 'stable' | 'declining'
    }
    
    strategyEffectiveness: Array<{
      strategyName: string
      successRate: number
      averageExecutionTimeMs: number
      effectivenessScore: number
    }>
    
    operationalHealth: {
      systemEntropy: number
      convergenceScore: number
      providerStability: number
    }
  }

  metadata: {
    processedAt: string  // ISO 8601
    runtimeVersion: string
    processingTimeMs: number
  }
}
```

#### Example Flow

```typescript
// OperNext sends intent
const request: IntentRequest = {
  tenantId: "acme-corp",
  intent: {
    goalId: "obtain_signed_contract",
    type: "document_lifecycle",
    context: {
      documentId: "doc-123",
      documentType: "sales_contract",
      customerTier: "enterprise"
    },
    successCriteria: [
      "document.state == signed",
      "document.signatures.length >= 2"
    ],
    priority: "high"
  },
  constraints: {
    preferences: {
      speed: "fast",
      reliability: "high"
    },
    mustInclude: ["audit_trail"]
  }
}

// Runtime-core responds with decision + prediction + trace
const response: IntentResponse = {
  requestId: "req-789",
  intent: {
    goalId: "obtain_signed_contract",
    status: "accepted"
  },
  decision: {
    selectedStrategy: {
      strategyName: "docusign_fast_path",
      strategyId: "strategy-456",
      description: "Direct DocuSign integration with parallel signature requests",
      selectionReasoning: [
        {
          factor: "historical_success_rate",
          weight: 0.5,
          rationale: "Strategy has 96% success rate for enterprise customers"
        },
        {
          factor: "speed_preference_match",
          weight: 0.3,
          rationale: "Strategy average time (5.2s) matches 'fast' preference"
        },
        {
          factor: "reliability_match",
          weight: 0.2,
          rationale: "Strategy has high provider stability (0.94)"
        }
      ],
      confidence: 0.91
    },
    fallbackStrategies: [
      {
        strategyName: "manual_review_flow",
        strategyId: "strategy-789",
        confidence: 0.78,
        triggerConditions: ["provider_unavailable", "signature_timeout"]
      }
    ],
    governance: {
      adaptiveGovernanceEnabled: true,
      activePolicies: [
        {
          policyId: "policy-123",
          policyType: "provider_stability",
          description: "Monitor DocuSign stability, reroute if degraded"
        }
      ],
      riskMitigations: [
        {
          riskType: "provider_timeout",
          mitigationAction: "enable_auto_retry_with_exponential_backoff",
          reasoning: "Historical timeout rate 0.08, mitigated by retry policy"
        }
      ]
    }
  },
  prediction: {
    expectedOutcome: {
      goalAchievementProbability: 0.94,
      predictedFinalState: {
        "document.state": "signed",
        "document.signatures": [
          { "role": "customer", "status": "signed" },
          { "role": "sales_rep", "status": "signed" }
        ]
      },
      predictedExecutionTimeMs: 5200,
      expectedResourceUsage: {
        providerCalls: 3,
        estimatedCost: 0.15,
        estimatedRetries: 0
      }
    },
    risks: [
      {
        riskType: "signature_abandonment",
        severity: "medium",
        probability: 0.12,
        description: "Customer may not complete signature within timeout",
        mitigation: "Automated reminder email at 80% timeout threshold"
      }
    ],
    predictionConfidence: {
      overall: 0.89,
      basedOnSamples: 150,
      historicalAccuracy: 0.92
    }
  },
  execution: {
    executionId: "exec-321",
    trackingEndpoint: "/runtime/v1/execution/exec-321",
    expectedCheckpoints: [
      {
        checkpointId: "cp-1",
        description: "DocuSign request created",
        expectedTimestampRelativeMs: 500
      },
      {
        checkpointId: "cp-2",
        description: "First signature received",
        expectedTimestampRelativeMs: 3000
      },
      {
        checkpointId: "cp-3",
        description: "All signatures complete",
        expectedTimestampRelativeMs: 5200
      }
    ],
    supportsRealTimeUpdates: true,
    websocketEndpoint: "ws://runtime.bakeoff.io/v1/execution/exec-321/stream"
  },
  intelligence: {
    goalIntelligence: {
      historicalSuccessRate: 0.94,
      totalAttempts: 200,
      recentTrend: "improving"
    },
    strategyEffectiveness: [
      {
        strategyName: "docusign_fast_path",
        successRate: 0.96,
        averageExecutionTimeMs: 5200,
        effectivenessScore: 0.91
      },
      {
        strategyName: "manual_review_flow",
        successRate: 0.88,
        averageExecutionTimeMs: 14000,
        effectivenessScore: 0.75
      }
    ],
    operationalHealth: {
      systemEntropy: 0.23,
      convergenceScore: 0.89,
      providerStability: 0.94
    }
  },
  metadata: {
    processedAt: "2026-05-08T19:31:30.971Z",
    runtimeVersion: "1.0.0",
    processingTimeMs: 45
  }
}
```

---

## 4. Domain B: Strategy Decision Contract

### GET /runtime/v1/decision/context

Get decision context for a goal (what strategies are available and why).

#### Request Parameters

```typescript
{
  tenantId: string
  goalId: string
  currentState?: Record<string, unknown>
}
```

#### Response

```typescript
{
  goalId: string
  tenantId: string
  availableStrategies: Array<{
    strategyId: string
    strategyName: string
    description: string
    characteristics: {
      expectedSuccessRate: number
      expectedExecutionTimeMs: number
      expectedRetries: number
      providerDependencies: string[]
    }
    historicalPerformance: {
      totalAttempts: number
      successfulAttempts: number
      averageExecutionTimeMs: number
      effectivenessScore: number
    }
    currentSuitability: {
      recommended: boolean
      suitabilityScore: number
      reasoning: string[]
    }
  }>
  operationalContext: {
    systemHealth: {
      entropy: number
      convergence: number
      providerStability: number
    }
    activeRisks: Array<{...}>
    predictiveInsights: {...}
  }
  calibration: {...}
  metadata: {...}
}
```

### POST /runtime/v1/decision/evaluate

Evaluate a hypothetical strategy decision.

#### Request

```typescript
{
  tenantId: string
  goalId: string
  hypotheticalStrategy?: string
  evaluateCurrentBest?: boolean
  evaluationContext?: Record<string, unknown>
}
```

#### Response

```typescript
{
  evaluatedStrategy: string
  evaluation: {
    overallScore: number
    scoring: {
      successProbability: number
      riskScore: number
      efficiencyScore: number
      reliabilityScore: number
    }
    predictedOutcome: {...}
    comparedToAlternatives: Array<{...}>
  }
  recommendation: {
    recommended: boolean
    confidence: number
    reasoning: string[]
    suggestedAlternatives?: string[]
  }
  metadata: {...}
}
```

---

## 5. Domain C: Execution Control Contract

### GET /runtime/v1/execution/{executionId}

Get current execution status.

#### Response

```typescript
{
  executionId: string
  goalId: string
  tenantId: string
  status: {
    phase: 'planning' | 'governing' | 'executing' | 'recovering' | 'completed' | 'failed'
    detailedStatus: string
    progress: number  // 0-1
    currentCheckpoint?: {...}
  }
  strategy: {
    strategyName: string
    strategyId: string
    isFallback: boolean
    fallbackReason?: string
    attemptNumber: number
    maxAttempts: number
  }
  currentState: {
    entityState: Record<string, unknown>
    executionState: {...}
    goalProgress: {...}
  }
  predictions: {
    goalAchievementProbability: number
    estimatedTimeRemainingMs: number
    emergingRisks: Array<{...}>
  }
  adaptiveActions: Array<{
    actionType: string
    takenAt: string
    reasoning: string
    impact: string
  }>
  metadata: {...}
}
```

### GET /runtime/v1/execution/{executionId}/trace

Get detailed execution trace.

#### Response

```typescript
{
  executionId: string
  goalId: string
  trace: Array<{
    timestamp: string
    phase: string
    event: string
    details: Record<string, unknown>
    decisionPoint?: {...}
    governanceAction?: {...}
    providerInteraction?: {...}
  }>
  checkpoints: Array<{...}>
  timeline: {
    planningDurationMs: number
    governanceDurationMs: number
    executionDurationMs: number
    totalDurationMs: number
  }
  metadata: {...}
}
```

### POST /runtime/v1/execution/{executionId}/observe

Send observations back to runtime (enables learning).

#### Request

```typescript
{
  executionId: string
  observations: Array<{
    observationType: string
    observedAt: string
    observedValue: unknown
    confidence: number
    source: string
  }>
  externalSignals?: Array<{...}>
}
```

#### Response

```typescript
{
  executionId: string
  observationsReceived: number
  impact: {
    predictionUpdated: boolean
    strategyAdjusted: boolean
    governanceTriggered: boolean
    changes: Array<{...}>
  }
  metadata: {...}
}
```

---

## 6. Domain D: Intelligence Exposure Contract

### GET /runtime/v1/intelligence/forecast

Get predictive intelligence forecasts.

#### Request Parameters

```typescript
{
  tenantId: string
  forecastType: 'risk_assessment' | 'strategy_performance' | 'system_health' | 'goal_outcomes'
  forecastHorizon: '1h' | '6h' | '24h' | '7d' | '30d'
  scope?: {
    goalIds?: string[]
    strategyNames?: string[]
  }
}
```

#### Response

```typescript
{
  tenantId: string
  forecastType: string
  forecastHorizon: string
  forecasts: Array<{
    forecastId: string
    forecastType: string
    predictedEvents: Array<{...}>
    predictedMetrics: Record<string, {...}>
    confidence: number
    basedOn: {...}
  }>
  recommendedActions: Array<{...}>
  metadata: {...}
}
```

### GET /runtime/v1/intelligence/learning

Get learned patterns and insights.

#### Request Parameters

```typescript
{
  tenantId: string
  learningType: 'strategy_effectiveness' | 'pattern_discovery' | 'convergence_analysis' | 'provider_reliability'
  timeRange?: {
    from: string
    to: string
  }
}
```

#### Response

```typescript
{
  tenantId: string
  learningType: string
  learnedPatterns: Array<{
    patternId: string
    patternType: string
    description: string
    characteristics: {...}
    evidence: {...}
    insights: string[]
  }>
  strategyInsights: Array<{...}>
  systemLearnings: {
    optimalConditions: Array<{...}>
    antiPatterns: Array<{...}>
  }
  metadata: {...}
}
```

### GET /runtime/v1/intelligence/recommendations

Get runtime recommendations.

#### Request Parameters

```typescript
{
  tenantId: string
  recommendationType: 'optimization' | 'risk_mitigation' | 'cost_reduction' | 'performance_improvement'
  context?: {
    goalIds?: string[]
    currentChallenges?: string[]
  }
}
```

#### Response

```typescript
{
  tenantId: string
  recommendationType: string
  recommendations: Array<{
    recommendationId: string
    type: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    recommendation: {
      title: string
      description: string
      actionableSteps: string[]
    }
    expectedImpact: {...}
    evidence: {...}
    implementation: {...}
  }>
  strategicInsights: Array<{...}>
  metadata: {...}
}
```

---

## 7. Contract Guarantees

### What Runtime-Core Guarantees

1. **Deterministic Response Structure**: Every response matches the contract schema
2. **Semantic Versioning**: Breaking changes increment major version
3. **Backward Compatibility**: v1.x.x responses remain compatible
4. **Decision Transparency**: Every decision includes reasoning
5. **Prediction Confidence**: Every prediction includes confidence levels
6. **Trace Completeness**: Execution traces capture all decision points
7. **Intelligence Safety**: Intelligence exposure never reveals sensitive internals
8. **Real-time Accuracy**: Status endpoints reflect current state within 100ms

### What OperNext Must Guarantee

1. **Intent Purity**: Never send execution instructions, only intent
2. **Constraint Respect**: Respect runtime's decisions, don't override
3. **Observation Honesty**: Send accurate observations, not manipulated signals
4. **Correlation Tracking**: Include correlationId for debugging
5. **Rate Limiting**: Respect runtime's rate limits (exposed in headers)

---

## 8. Error Handling

### Error Response Format

```typescript
{
  error: {
    code: string          // e.g., "INVALID_INTENT", "GOAL_NOT_FOUND"
    message: string
    details?: Record<string, unknown>
    requestId: string
    timestamp: string
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_INTENT` | 400 | Intent request malformed |
| `GOAL_NOT_FOUND` | 404 | Goal doesn't exist |
| `STRATEGY_UNAVAILABLE` | 503 | No strategies available |
| `EXECUTION_NOT_FOUND` | 404 | Execution doesn't exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Runtime internal error |
| `PREDICTION_UNAVAILABLE` | 503 | Insufficient data for prediction |

---

## 9. Versioning Strategy

### Version Format

`v{major}.{minor}.{patch}`

- **Major**: Breaking changes to contract (incompatible)
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

### Version Negotiation

Clients specify version in URL path: `/runtime/v1/intent`

Runtime returns version in response: `metadata.runtimeVersion`

### Deprecation Policy

1. **Announcement**: Deprecation announced 6 months before removal
2. **Warning**: Deprecated endpoints return `Deprecated` header
3. **Migration Guide**: Documentation provided for migration
4. **Parallel Support**: Old and new versions supported during transition

---

## 10. Performance Characteristics

### Expected Latencies (p95)

| Endpoint | Expected p95 Latency |
|----------|---------------------|
| `POST /runtime/v1/intent` | < 100ms |
| `GET /runtime/v1/decision/context` | < 50ms |
| `POST /runtime/v1/decision/evaluate` | < 75ms |
| `GET /runtime/v1/execution/{id}` | < 25ms |
| `GET /runtime/v1/execution/{id}/trace` | < 100ms |
| `POST /runtime/v1/execution/{id}/observe` | < 50ms |
| `GET /runtime/v1/intelligence/*` | < 150ms |

### Rate Limits (per tenant)

| Endpoint Type | Rate Limit |
|--------------|-----------|
| Intent Ingestion | 100 req/s |
| Decision Context | 200 req/s |
| Execution Status | 500 req/s |
| Intelligence | 50 req/s |

---

## 11. Security

### Authentication

All requests require:
```
Authorization: Bearer <jwt_token>
```

JWT must include:
- `tenantId`: Tenant identifier
- `scope`: Allowed operations
- `exp`: Expiration timestamp

### Authorization

Runtime validates:
- Tenant has access to requested resources
- Operation is within allowed scope
- Rate limits not exceeded

### Data Privacy

- Runtime never logs sensitive payload data
- Traces exclude PII unless explicitly configured
- Intelligence exposure excludes tenant-specific data

---

## 12. Evolution and Learning

### How Intelligence Evolves

1. **Execution Outcomes** → Update strategy effectiveness
2. **Forecast Accuracy** → Self-calibrate predictions
3. **Pattern Discovery** → Learn new patterns
4. **Provider Behavior** → Update reliability metrics
5. **Governance Outcomes** → Refine policies

### Learning Transparency

Runtime exposes:
- What it learned (patterns, insights)
- Confidence in learnings
- Sample sizes used
- Historical accuracy

Runtime never exposes:
- Training algorithms
- Internal weights/parameters
- Raw execution data from other tenants
- Proprietary intelligence mechanics

---

## 13. Migration from Legacy APIs

### Legacy to Contract Mapping

| Legacy Endpoint | Contract Endpoint |
|----------------|------------------|
| `POST /intent/goals` | `POST /runtime/v1/intent` |
| `GET /intent/strategies` | `GET /runtime/v1/decision/context` |
| `POST /intent/plan` | `POST /runtime/v1/intent` (unified) |
| `GET /executions/:id` | `GET /runtime/v1/execution/{id}` |
| `GET /predictive/risks` | `GET /runtime/v1/intelligence/forecast` |
| `GET /intelligence/recommendations` | `GET /runtime/v1/intelligence/recommendations` |

### Migration Guide

1. **Phase 1**: Both APIs available in parallel
2. **Phase 2**: Legacy APIs return deprecation warnings
3. **Phase 3**: Legacy APIs redirect to new contract
4. **Phase 4**: Legacy APIs removed

Current Status: **Phase 1**

---

## 14. Testing and Validation

### Contract Validation

Runtime provides:
- OpenAPI/JSON Schema for all types
- Contract test suite
- Mock server for OperNext development
- Validation endpoint: `POST /runtime/v1/validate`

### Example Validation Request

```typescript
POST /runtime/v1/validate
{
  "validateType": "IntentRequest",
  "payload": { /* your request */ }
}

// Response
{
  "valid": true,
  "errors": []
}
```

---

## 15. Examples and Use Cases

### Example 1: Simple Document Workflow

```typescript
// OperNext: "I want a signed contract"
const response = await fetch('/runtime/v1/intent', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: 'acme',
    intent: {
      goalId: 'signed_contract',
      type: 'document',
      context: { docId: 'doc-123' },
      successCriteria: ['document.signed == true']
    }
  })
})

// Runtime: "I'll use docusign_fast_path, 94% success probability"
const decision = await response.json()
console.log(decision.decision.selectedStrategy.strategyName)
// => "docusign_fast_path"
console.log(decision.prediction.expectedOutcome.goalAchievementProbability)
// => 0.94
```

### Example 2: Monitoring Execution

```typescript
// Track execution progress
const executionId = decision.execution.executionId

const status = await fetch(`/runtime/v1/execution/${executionId}`)
const statusData = await status.json()

console.log(statusData.status.progress)  // => 0.67
console.log(statusData.predictions.goalAchievementProbability)  // => 0.96 (updated!)
```

### Example 3: Learning from Intelligence

```typescript
// Get learned patterns
const learning = await fetch('/runtime/v1/intelligence/learning', {
  method: 'GET',
  params: {
    tenantId: 'acme',
    learningType: 'strategy_effectiveness'
  }
})

const insights = await learning.json()
console.log(insights.strategyInsights[0].learnings)
// => [
//   "Strategy performs best between 9am-5pm EST",
//   "Success rate drops 12% on Fridays",
//   "Retry rate correlates with document size"
// ]
```

---

## 16. Summary

**RuntimeCoreContract v1.0.0** provides a clean, versioned interface between OperNext and runtime-core that:

✅ Separates intent from execution  
✅ Exposes decisions with full transparency  
✅ Provides predictions with confidence levels  
✅ Enables learning without compromising autonomy  
✅ Supports evolution without breaking changes  
✅ Maintains security and privacy  

This contract is the foundation for building intelligent, autonomous runtime systems that scale with organizational needs while remaining predictable and observable.

---

## Appendix A: Complete Type Definitions

See [`src/runtime/api/contract-types.ts`](./src/runtime/api/contract-types.ts) for complete TypeScript type definitions.

## Appendix B: OpenAPI Specification

See [`src/runtime/api/contract-openapi.yaml`](./src/runtime/api/contract-openapi.yaml) (to be generated) for machine-readable API specification.

## Appendix C: Change Log

### v1.0.0 (2026-05-08)
- Initial contract release
- Four domains defined
- Complete type system
- Migration guide from legacy APIs

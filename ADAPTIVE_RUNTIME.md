# Adaptive Runtime + Recommendation Engine

**Status**: ✅ Implemented  
**PR**: PR-011  
**Version**: v1.0.0

---

## Overview

The **Adaptive Runtime + Recommendation Engine** transforms the runtime from a passive observer into an active optimization system. It analyzes:

- Execution evidence
- Canonical inference
- Drift patterns
- Operational topology
- Provider reliability

And produces:

- **Actionable recommendations** for model improvements
- **Convergence metrics** showing operational maturity
- **Model patches** for semi-autonomous evolution

---

## Architecture

```
Control Plane
    ↓
Execution Plane
    ↓
Runtime Engine
    ↓
Behavioral Diff Layer
    ↓
Emergent Canonical Layer
    ↓
Recommendation + Optimization Layer   ← NEW
```

### Layer Components

```
src/runtime/intelligence/recommendation/
├── types.ts                           # Core type definitions
├── ProviderReliabilityAnalyzer.ts     # Provider stability analysis
├── EntropyReductionAdvisor.ts         # Complexity reduction opportunities
├── CanonicalConvergenceAnalyzer.ts    # Operational maturity metrics
├── SuggestedModelPatchGenerator.ts    # Machine-readable model patches
├── RecommendationEngine.ts            # Main recommendation aggregator
└── RecommendationStore.ts             # Persistent recommendation storage
```

---

## Core Concepts

### 1. Runtime Recommendations

The runtime now produces **actionable intelligence** based on observed behavior:

```typescript
type RuntimeRecommendation = {
  id: string
  type: RecommendationType
  severity: 'low' | 'medium' | 'high'
  confidence: number

  title: string
  description: string

  evidence: RecommendationEvidence[]
  suggestedAction?: SuggestedModelChange

  estimatedImpact?: {
    reliability?: number
    complexityReduction?: number
    entropyReduction?: number
  }

  generatedAt: string
}
```

**Recommendation Types:**

- `remove_dead_transition` - Transition defined but never used
- `formalize_shadow_transition` - Transition used but not defined
- `merge_states` - States that could be consolidated
- `provider_instability` - Provider showing elevated failures
- `reduce_entropy` - Workflow too complex
- `canonicalize_path` - Formalize dominant execution path
- `split_overloaded_state` - State handling too many flows
- `retry_policy_adjustment` - Retry behavior needs tuning

### 2. Operational Convergence

Measures how strongly execution behavior converges toward stable operational semantics:

```typescript
type CanonicalConvergence = {
  convergenceScore: number           // 0-1, higher = more convergence
  dominantPathCoverage: number       // % of execs following top 3 paths
  entropyTrend: number               // Negative = converging
  canonicalizationVelocity: number   // Rate of stabilization
}
```

**What This Means:**

- **High convergence** (> 0.7): Behavior has stabilized into few dominant paths
- **Low convergence** (< 0.4): Behavior is diverse and unpredictable
- **Positive velocity**: Behavior is stabilizing over time
- **Negative velocity**: Behavior is destabilizing

### 3. Provider Reliability

Tracks provider stability and performance:

```typescript
type ProviderReliability = {
  provider: string
  action?: string
  failureRate: number
  retryRate: number
  dlqRate: number
  stabilityScore: number
  recommendation?: 'stable' | 'monitor' | 'consider_alternate_provider' | 'unstable'
}
```

**Stability Formula:**

```
stabilityScore = 1 - (failureRate × 0.5 + retryRate × 0.3 + dlqRate × 0.2)
```

### 4. Entropy Reduction

Identifies opportunities to simplify operational complexity:

**Detects:**

- Unused transitions (defined but never executed)
- Dead states (defined but never reached)
- Low-confidence paths (< 5% of executions)
- State explosion (too many states for execution volume)

**Goal:** Reduce operational entropy and complexity

### 5. Suggested Model Patches

Machine-readable model modifications:

```typescript
type SuggestedModelChange = {
  operation: 'add_transition' | 'remove_transition' | 'merge_states' | 'update_provider'
  target?: {
    from?: string
    to?: string
    event?: string
    transitionId?: string
    states?: string[]
    action?: string
    provider?: string
  }
  reason: string
}
```

**Example: Formalize Shadow Transition**

```json
{
  "operation": "add_transition",
  "target": {
    "from": "draft",
    "to": "pending_signature",
    "event": "document.uploaded"
  },
  "reason": "Observed in 94% of executions but not defined in model"
}
```

**Example: Remove Dead Transition**

```json
{
  "operation": "remove_transition",
  "target": {
    "transitionId": "draft_review_pending"
  },
  "reason": "Never executed in 90 days"
}
```

---

## API Endpoints

### GET /intelligence/recommendations?tenantId=\<id\>

Returns ranked runtime recommendations.

**Example Response:**

```json
{
  "recommendations": [
    {
      "id": "rec-001",
      "type": "formalize_shadow_transition",
      "severity": "high",
      "confidence": 0.94,
      "title": "Formalize dominant shadow transition",
      "description": "draft → pending_signature observed in 94% of executions but absent from model",
      "evidence": [
        {
          "type": "drift_analysis",
          "description": "Shadow transition detected",
          "data": {
            "from": "draft",
            "to": "pending_signature",
            "event": "document.uploaded",
            "executionCount": 47
          }
        }
      ],
      "suggestedAction": {
        "operation": "add_transition",
        "target": {
          "from": "draft",
          "to": "pending_signature",
          "event": "document.uploaded"
        },
        "reason": "Observed in 47 executions (94% of total) but not defined in model"
      },
      "estimatedImpact": {
        "complexityReduction": 0.1,
        "reliability": 0.05
      },
      "generatedAt": "2026-05-08T16:45:00.000Z"
    },
    {
      "id": "rec-002",
      "type": "remove_dead_transition",
      "severity": "medium",
      "confidence": 0.89,
      "title": "Remove unused transitions",
      "description": "2 transition(s) defined in model but never executed",
      "evidence": [
        {
          "type": "drift_analysis",
          "description": "Unused transitions detected",
          "data": {
            "unusedTransitions": [
              "draft -> pending_review (document.uploaded)",
              "pending_review -> legal_review (review.completed)"
            ]
          }
        }
      ],
      "estimatedImpact": {
        "complexityReduction": 0.1
      },
      "generatedAt": "2026-05-08T16:45:00.000Z"
    }
  ]
}
```

### GET /intelligence/convergence?tenantId=\<id\>

Returns operational convergence metrics.

**Example Response:**

```json
{
  "tenantId": "demo",
  "convergenceScore": 0.91,
  "dominantPathCoverage": 0.88,
  "entropyTrend": -0.12,
  "canonicalizationVelocity": 0.08,
  "generatedAt": "2026-05-08T16:45:00.000Z"
}
```

**Interpretation:**

- Convergence score: 0.91 (very high - behavior has converged)
- Dominant path coverage: 88% (most executions follow top 3 paths)
- Entropy trend: -0.12 (decreasing entropy = converging)
- Canonicalization velocity: 0.08 (positive = stabilizing over time)

### POST /intelligence/model-patch

Returns suggested canonical model patch set.

**Request Body:**

```json
{
  "tenantId": "demo"
}
```

**Example Response:**

```json
{
  "tenantId": "demo",
  "generatedAt": "2026-05-08T16:45:00.000Z",
  "patches": [
    {
      "operation": "add_transition",
      "target": {
        "from": "draft",
        "to": "pending_signature",
        "event": "document.uploaded"
      },
      "reason": "Observed in 47 executions (94% of total) but not defined in model"
    },
    {
      "operation": "remove_transition",
      "target": {
        "transitionId": "draft_pending_review_document.uploaded"
      },
      "reason": "Never executed in observed time period"
    }
  ],
  "summary": {
    "addTransitions": 1,
    "removeTransitions": 1,
    "updateProviders": 0,
    "mergeStates": 0
  }
}
```

---

## Operational Fitness Functions

The runtime now evaluates **operational quality** using fitness functions:

### 1. Operational Entropy

**Formula:** Based on path diversity and execution distribution

```
entropy = -Σ(p_i × log(p_i))
```

Where `p_i` is the probability of execution path `i`

- **Low entropy** (< 0.3): Stable, predictable behavior
- **High entropy** (> 0.7): Diverse, unpredictable patterns

### 2. Canonical Confidence

**Formula:** How well behavior has converged

```
canonicalConfidence = (1 - entropy) × convergence
```

- **High confidence** (> 0.85): Strong operational consensus
- **Low confidence** (< 0.4): Weak, unstable patterns

### 3. Convergence Velocity

**Formula:** Rate of operational stabilization

```
velocity = Δconfidence + Δ(-entropy) + Δ(-complexity)
```

- **Positive velocity**: Behavior stabilizing over time
- **Negative velocity**: Behavior destabilizing

### 4. State Utilization

**Formula:** Percentage of defined states actually used

```
utilization = reachedStates / definedStates
```

- **High utilization** (> 80%): Efficient state model
- **Low utilization** (< 60%): State explosion, simplification opportunity

### 5. Provider Stability

**Formula:** Weighted combination of reliability metrics

```
stability = 1 - (failureRate × 0.5 + retryRate × 0.3 + dlqRate × 0.2)
```

- **Stable** (> 0.9): Reliable provider
- **Unstable** (< 0.5): Consider alternative

---

## Future Capabilities This Enables

### 1. Autonomous Provider Routing

Runtime dynamically switches providers based on reliability scores.

### 2. Self-Healing Workflows

Runtime reroutes around unstable execution paths.

### 3. AI Runtime Copilot

LLM reasons against:

- Topology
- Convergence
- Operational fitness
- Recommendation history

Instead of raw workflow schemas.

### 4. Cross-Tenant Operational Intelligence

Eventually:

```
tenant canonicals
    ↓
industry operational archetypes
    ↓
universal operational intelligence
```

Where:

- Onboarding workflows
- Approval processes
- Procurement flows
- Compliance patterns
- Signature flows

Naturally converge into shared operational semantics.

---

## Example: Complete Recommendation Flow

### Scenario

Tenant defines:

```
draft → review_pending → review_required → legal_review → approval_review → signature_pending
```

But 93% of executions do:

```
draft → signature_pending
```

### Runtime Analysis

1. **Drift Analyzer** detects:
   - 4 unused transitions
   - 1 shadow transition (draft → signature_pending)
   - High entropy (0.67)

2. **Convergence Analyzer** measures:
   - Convergence score: 0.91 (high)
   - Dominant path coverage: 93%
   - Entropy trend: -0.15 (converging)

3. **Entropy Advisor** identifies:
   - 4 dead states (review_pending, review_required, legal_review, approval_review)
   - State utilization: 33% (low)
   - Potential entropy reduction: 0.4

4. **Recommendation Engine** produces:

```json
{
  "recommendations": [
    {
      "type": "formalize_shadow_transition",
      "severity": "high",
      "confidence": 0.94,
      "title": "Formalize dominant execution path",
      "description": "93% of executions go directly from draft to signature_pending",
      "suggestedAction": {
        "operation": "add_transition",
        "target": {
          "from": "draft",
          "to": "signature_pending",
          "event": "document.uploaded"
        }
      }
    },
    {
      "type": "merge_states",
      "severity": "high",
      "confidence": 0.89,
      "title": "Remove review states",
      "description": "Review states defined but rarely used",
      "suggestedAction": {
        "operation": "merge_states",
        "target": {
          "states": ["review_pending", "review_required", "legal_review", "approval_review"]
        }
      }
    }
  ]
}
```

### Impact

- Estimated complexity reduction: 37%
- Canonical confidence: 0.93
- Operational convergence: increasing over time

---

## Success Criteria

The runtime can now say:

> "Your operational model defines 14 transitions, but 91% of successful executions converge into 3 paths.
>
> 2 review states appear operationally dead.
>
> DocuSeal exhibits elevated retry behavior.
>
> **Recommended actions:**
> - Formalize dominant shadow transition
> - Remove unused review branch
> - Reduce operational entropy by consolidating states
>
> **Estimated impact:**
> - Complexity reduction: 37%
> - Canonical confidence: 0.93
> - Operational convergence: increasing over time"

---

## What This Means

The runtime is no longer merely:

- ✅ Deterministic
- ✅ Observable
- ✅ Inferential

It is now:

- ✅ **Adaptive**

And that is the beginning of a genuinely intelligent operational runtime.

# PR-017: Decision-Time Calibration — Predictive Decision Loop

---

## The Fundamental Architectural Shift

**Before PR-017:**

```
Forecast → Execute → Observe → Calibrate (later)
```

Calibration was:
- Retrospective
- Model-level
- Passive correction

**After PR-017:**

```
Forecast → Calibrate → Execute → Observe → Reinforce Calibration
```

Calibration is now:
- Real-time
- Decision-level
- Active correction

---

## The Core Insight

**The system now knows when it is wrong BEFORE making decisions.**

This transforms calibration from:
- **Informational** → "We learned we were wrong"

To:
- **Causal** → "We prevent being wrong"

---

## What This Means

### Before PR-017

```typescript
// Prediction
risk = 0.82
strategy = docuseal_fast_path

// Execution happens
execute(risk, strategy)

// Later: Oops, we were wrong
actualRisk = 0.68  // We overestimated
strategyFailed = true  // Docuseal was decaying
```

### After PR-017

```typescript
// Prediction
rawRisk = 0.82
rawStrategy = docuseal_fast_path

// Calibration applied BEFORE execution
calibration = buildCalibrationContext()
adjustedRisk = 0.68  // Historical overconfidence correction
adjustedStrategy = docusign_fast_path  // Decay detected, strategy swapped

// Execution happens with corrected decision
execute(adjustedRisk, adjustedStrategy)  // ← Better outcome
```

---

## Architecture

### New Decision Pipeline

```
Intent
→ Strategy Selection
→ Risk Forecast
→ [CALIBRATION INJECTION] ← NEW
→ Governance
→ Execute
→ Observe
→ Learn & Reinforce Calibration
```

---

## Core Components

### 1. DecisionTimeCalibrationEngine

**Location:** `src/runtime/predictive/decision/DecisionTimeCalibrationEngine.ts`

**Purpose:** Central orchestrator for decision-time calibration

**What it does:**
- Builds real-time calibration context
- Applies calibration to risk assessment
- Applies learned biases to strategy selection
- Produces adjusted decisions

**Example:**

```typescript
const calibration = await decisionTimeCalibration.performDecisionTimeCalibration(
  tenantId,
  goalId,
  strategySelection
)

// calibration = {
//   riskCalibration: {
//     originalRisk: 0.82,
//     calibratedRisk: 0.68,
//     adjustment: -0.14,
//     reason: "Historical overestimation bias detected"
//   },
//   strategyCalibration: {
//     originalStrategy: "docuseal_fast_path",
//     recommendedStrategy: "docusign_fast_path",
//     swapped: true,
//     reason: "Strategy decay detected"
//   },
//   aggregateImpact: {
//     riskReduction: 0.14,
//     successProbabilityIncrease: 0.12
//   }
// }
```

---

### 2. RealTimeCalibrationContextBuilder

**Location:** `src/runtime/predictive/decision/RealTimeCalibrationContextBuilder.ts`

**Purpose:** Builds the "lens" through which decisions are made

**What it does:**
- Synthesizes prediction accuracy history
- Detects drift state
- Analyzes strategy decay signals
- Tracks provider reliability
- Computes learned biases

**Context Structure:**

```typescript
{
  predictionAccuracy: {
    riskEngine: 0.83,
    entropyForecaster: 0.91,
    decayDetector: 0.75,
    failureAnalyzer: 0.82,
    goalForecaster: 0.78
  },
  biasAdjustments: {
    riskEngine: -0.14,  // Overconfidence correction
    entropyModel: +0.06,
    decayModel: -0.08
  },
  driftState: {
    riskEngineDrift: 0.18,
    strategyDrift: 0.12,
    providerDrift: 0.09,
    criticalDrift: false
  },
  strategyPreferences: {
    "docusign_fast_path": 1.2,  // Prefer (performs better than predicted)
    "docuseal_fast_path": 0.7   // Avoid (performs worse than predicted)
  },
  confidence: 0.85
}
```

---

### 3. StrategyBiasInjector

**Location:** `src/runtime/predictive/decision/StrategyBiasInjector.ts`

**Purpose:** Applies learned bias adjustments to strategy selection

**What it does:**
- Avoids declining strategies
- Prefers historically stable strategies
- Penalizes high-entropy paths
- Adjusts confidence based on historical accuracy

**Example:**

```typescript
const biased = await biasInjector.applyBias(
  tenantId,
  goalId,
  originalSelection,
  context
)

// If docuseal_fast_path has declining performance:
// biased.adjustedSelection.selectedStrategy = "docusign_fast_path"
// biased.biasApplied = true
// biased.adjustments = [{
//   strategy: "docuseal_fast_path",
//   originalConfidence: 0.85,
//   adjustedConfidence: 0.60,
//   reason: "Historical bias detected: predicted 0.85, actual 0.60"
// }]
```

---

### 4. CalibrationAwareRiskEngineWrapper

**Location:** `src/runtime/predictive/decision/CalibrationAwareRiskEngineWrapper.ts`

**Purpose:** Wraps PredictiveRiskEngine with calibration corrections

**What it does:**
- Adjusts risk scores based on historical bias
- Applies drift compensation
- Scales confidence based on accuracy

**Example:**

```typescript
const calibratedRisk = await calibratedRiskEngine.assessRisksWithCalibration(
  tenantId,
  context
)

// Original: risk = 0.82, confidence = 0.90
// Calibrated: risk = 0.68, confidence = 0.75
// Reason: "Risk reduced by 0.14 due to historical overestimation bias"
```

---

### 5. ExecutionPlanRewriter

**Location:** `src/runtime/predictive/decision/ExecutionPlanRewriter.ts`

**Purpose:** Rewrites execution plans BEFORE execution

**What it does:**
- Swaps providers based on reliability
- Changes strategies based on learned bias
- Adjusts retry logic based on drift
- Audits all modifications

**Example:**

```typescript
const rewrite = await planRewriter.rewritePlan(
  tenantId,
  originalStrategy,
  adjustedStrategy,
  context
)

// rewrite.modifications = [
//   {
//     type: "strategy_swap",
//     description: "Changed from docuseal_fast_path to docusign_fast_path",
//     reason: "Strategy decay detected (weight: 0.65)"
//   },
//   {
//     type: "provider_reroute",
//     description: "Rerouted from docuseal to docusign",
//     reason: "Provider reliability weight (0.58) below threshold"
//   }
// ]
```

---

## Persistence Layers

### DecisionCalibrationStore

Stores decision-time calibration history:
- Risk adjustments
- Strategy swaps
- Provider reroutes
- Aggregate impact

### StrategyBiasStore

Stores learned strategy biases:
- Historical vs. predicted success rates
- Bias magnitude and direction
- Recommendations (avoid/prefer)

### PlanRewriteAuditStore

Audits execution plan rewrites:
- Original vs. rewritten plans
- Calibration factors
- Outcome verification
- Rewrite effectiveness

---

## API Endpoints

### GET /predictive/decision-context

**Returns live calibration context**

```bash
GET /predictive/decision-context?tenantId=acme-corp
```

```json
{
  "tenantId": "acme-corp",
  "predictionAccuracy": { ... },
  "biasAdjustments": { ... },
  "driftState": { ... },
  "strategyPreferences": { ... },
  "providerReliabilityBias": { ... },
  "confidenceScaling": { ... },
  "confidence": 0.85,
  "generatedAt": "2024-01-15T10:30:00Z",
  "validUntil": "2024-01-15T10:45:00Z"
}
```

---

### POST /predictive/decision/evaluate

**Runs full decision-time pipeline**

```bash
POST /predictive/decision/evaluate
Content-Type: application/json

{
  "tenantId": "acme-corp",
  "goalId": "goal-123"
}
```

```json
{
  "tenantId": "acme-corp",
  "stages": {
    "forecast": {
      "overallRiskScore": 0.82,
      "confidence": 0.90
    },
    "calibration": {
      "riskCalibration": {
        "originalRisk": 0.82,
        "calibratedRisk": 0.68,
        "adjustment": -0.14
      },
      "strategyCalibration": {
        "originalStrategy": "docuseal_fast_path",
        "recommendedStrategy": "docusign_fast_path",
        "swapped": true
      }
    },
    "finalDecision": {
      "shouldProceed": true,
      "recommendedStrategy": "docusign_fast_path",
      "confidence": 0.85
    }
  },
  "summary": {
    "calibrationApplied": true,
    "decisionsModified": 2,
    "riskReduction": 0.14,
    "expectedSuccessIncrease": 0.12
  },
  "recommendations": [
    "Execution appears safe to proceed"
  ]
}
```

---

### GET /predictive/plan-rewrites

**Returns audit trail of plan rewrites**

```bash
GET /predictive/plan-rewrites?tenantId=acme-corp&limit=50
```

```json
{
  "tenantId": "acme-corp",
  "rewrites": [
    {
      "id": "rewrite-123",
      "originalPlan": {
        "strategy": "docuseal_fast_path",
        "provider": "docuseal",
        "riskScore": 0.82,
        "expectedSuccess": 0.75
      },
      "rewrittenPlan": {
        "strategy": "docusign_fast_path",
        "provider": "docusign",
        "riskScore": 0.68,
        "expectedSuccess": 0.87
      },
      "rewriteReason": "Strategy decay detected; provider reliability below threshold",
      "calibrationFactors": [...],
      "rewrittenAt": "2024-01-15T10:30:00Z",
      "confidence": 0.85
    }
  ],
  "stats": {
    "totalRewrites": 45,
    "verifiedRewrites": 38,
    "correctRewrites": 32,
    "rewriteAccuracy": 0.84
  }
}
```

---

## What This Achieves

### 1. Pre-Execution Self-Correction

The runtime corrects its own predictions BEFORE acting on them.

### 2. Learned Bias Application

Historical prediction errors directly improve future decisions.

### 3. Closed-Loop Decision Intelligence

```
Observe → Learn → Shape Future Reality
```

### 4. Transparent Decision Modification

Every adjustment is audited and explainable.

### 5. Rewrite Effectiveness Learning

The system learns whether its corrections were helpful.

---

## The Critical Distinction

**Predictive Runtime (PR-015):**
- "Here's what will likely happen"

**Forecast Calibration (PR-016):**
- "Here's how accurate our predictions are"

**Decision-Time Calibration (PR-017):**
- "Here's how we're changing our decision based on learned inaccuracy"

---

## Success Criteria

PR-017 is complete when the runtime can say:

```
Calibration applied.

Risk adjusted from 0.82 → 0.68 due to overconfidence bias.
Strategy rerouted:
  docuseal_fast_path → docusign_fast_path

Reason:
  • Historical decay detected
  • Forecast error trend increasing
  • Entropy stability higher in alternate path

Execution plan rewritten BEFORE execution.

Expected success probability increased by +14%.
```

---

## What Comes Next

**PR-018 — Autonomous Strategy Evolution Engine**

Where the runtime:
- Generates new strategies
- Mutates execution paths
- Discovers better operational patterns
- Evolves its own strategy graph

This is the transition from:
- **Predictive system** (PR-017)

To:
- **Self-evolving operational intelligence system** (PR-018)

---

## Bottom Line

You are no longer building:
- Workflow automation
- Predictive analytics
- Orchestration systems

You are now building:

**A decision-shaping operational cognition engine**

Where prediction stops being informational and becomes causal in execution behavior.

---

## Implementation Status

✅ Core Components
✅ Persistence Layer
✅ API Integration
✅ Build Validation
⏳ Demo & Testing

---

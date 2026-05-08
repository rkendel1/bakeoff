# PR-016: Forecast Calibration + Self-Correcting Predictive Intelligence

## Overview

This PR introduces **forecast calibration** — a feedback system where the runtime continuously learns from prediction errors and self-corrects its forecasting models.

### The Critical Missing Layer

Before PR-016, the runtime could:
- ✓ Predict failures
- ✓ Forecast entropy
- ✓ Detect strategy decay
- ✓ Estimate goal success probability
- ✓ Generate risk scores
- ✓ Recommend preemptive actions

But it could NOT:
- ✗ Continuously correct its own predictions based on real outcome error

### Architectural Shift

```
BEFORE:
predict → assume correctness

AFTER:
predict → observe → correct → improve
```

This transforms the runtime from:
- **Predictive system** (static predictions)

To:
- **Self-calibrating operational cognition system** (learning predictions)

---

## Architecture

### Complete Flow

```
Intent
→ Strategy
→ Forecast
→ Govern
→ Execute
→ Observe Outcome
→ Calibrate Predictions  ← NEW LAYER
```

### Core Concept

```
Forecast → Execution → Outcome → Error → Model Adjustment
```

This is a **closed-loop control system** for prediction quality.

---

## Core Components

### 1. ForecastOutcomeTracker

**Location:** `src/runtime/predictive/calibration/ForecastOutcomeTracker.ts`

**Purpose:** Links predictions to actual outcomes

**What it does:**
- Records predicted values
- Records actual outcomes
- Calculates prediction errors (Brier score)
- Feeds calibration system

**Example:**

```typescript
const outcome = await tracker.recordRiskOutcome(forecast, {
  failureOccurred: false,
  actualRiskLevel: 0.3,
  executionSuccess: true
})

// outcome.errorMetrics.probabilityError = 0.18 (Brier score)
// outcome.errorMetrics.calibrationDrift = 0.11
```

**Why this matters:**
- Without this: Predictions are unverifiable assumptions
- With this: Predictions become learnable intelligence

---

### 2. PredictionAccuracyAnalyzer

**Location:** `src/runtime/predictive/calibration/PredictionAccuracyAnalyzer.ts`

**Purpose:** Computes accuracy metrics

**Metrics computed:**
- **Brier score** — Probability accuracy (0 = perfect)
- **Calibration drift** — How far predictions are off
- **Bias detection** — Overconfident / underconfident
- **Per-component accuracy** — Individual model performance

**Example output:**

```typescript
{
  modelType: 'risk_engine',
  overallAccuracy: 0.83,
  brierScore: 0.17,
  bias: 'overconfident',  // Predicting too high
  biasScore: 0.22,
  calibrationError: 0.14,
  sampleSize: 45
}
```

**Bias types:**
- `overconfident` — Predictions higher than reality
- `underconfident` — Predictions lower than reality
- `calibrated` — Well-calibrated

---

### 3. PredictionDriftDetector

**Location:** `src/runtime/predictive/calibration/PredictionDriftDetector.ts`

**Purpose:** Detects when forecasts stop matching reality

**What it detects:**
- Accuracy decline over time
- Systematic bias shifts
- Distribution changes
- Model degradation

**Example:**

```typescript
const drift = await driftDetector.detectDrift(tenantId, 'risk_engine')

// drift.driftDetected = true
// drift.driftMagnitude = 0.18
// drift.driftType = 'accuracy_decline'
// drift.recommendedAction = 'recalibrate'
// drift.urgency = 'high'
```

**Why drift happens:**
- System behavior changes
- Tenant patterns evolve
- Provider behavior shifts
- Operational context transforms

---

### 4. AdaptiveConfidenceScaler

**Location:** `src/runtime/predictive/calibration/AdaptiveConfidenceScaler.ts`

**Purpose:** Adjusts confidence scores per subsystem

**Key insight:**
Not all predictions are equally reliable.

If entropy forecaster has 76% historical accuracy, its confidence should be scaled to reflect that.

**Example:**

```typescript
const result = await scaler.getAdjustedConfidence(
  tenantId,
  'risk_engine',
  0.90  // Base confidence
)

// result.adjustedConfidence = 0.76
// result.scaleFactor = 0.87
// result.rationale = "Historical accuracy: 87%. Model tends to be overconfident."
```

**This prevents:**
- Overconfident bad predictions
- Treating all models equally

---

### 5. SelfHealingForecastAdjuster

**Location:** `src/runtime/predictive/calibration/SelfHealingForecastAdjuster.ts`

**Purpose:** Automatically adjusts system parameters

**What it adjusts:**
- Risk thresholds
- Decay sensitivity
- Entropy baselines
- Convergence expectations

**Example:**

```typescript
const adjustments = await adjuster.performAutomaticAdjustment(
  tenantId,
  'risk_engine'
)

// adjustments = [
//   {
//     target: 'risk_sensitivity',
//     previousValue: 1.0,
//     newValue: 0.85,
//     trigger: 'Overconfident predictions detected',
//     expectedAccuracyImprovement: 0.05
//   }
// ]
```

**Key concept:**
Manual tuning doesn't scale. Self-healing systems automatically correct themselves.

---

### 6. ForecastCalibrationEngine

**Location:** `src/runtime/predictive/calibration/ForecastCalibrationEngine.ts`

**Purpose:** Core orchestrator

**What it does:**
- Analyzes accuracy across all models
- Detects drift
- Applies automatic adjustments
- Scales confidence appropriately
- Generates calibration reports

**Example:**

```typescript
const report = await calibrationEngine.performFullCalibration(tenantId)

// report = {
//   overallCalibrationHealth: 'good',
//   systemAccuracy: 0.84,
//   modelStatus: [
//     { modelType: 'risk_engine', accuracy: 0.83, needsCalibration: false },
//     { modelType: 'entropy_forecaster', accuracy: 0.91, needsCalibration: false }
//   ],
//   recommendations: [
//     { action: 'Monitor entropy forecaster', priority: 'low' }
//   ]
// }
```

---

## Persistence Layer

### ForecastOutcomeStore

Stores:
- All forecast outcomes (predictions + actuals)
- Historical error data
- Accuracy trends

### CalibrationStore

Stores:
- Current calibration parameters for each model
- Historical adjustments
- Calibration effectiveness

### PredictionAccuracyStore

Stores:
- Computed accuracy metrics over time
- Historical accuracy trends
- Model performance comparison

---

## API Endpoints

### GET /predictive/accuracy

Get prediction accuracy metrics.

**Query params:**
- `tenantId` (required)

**Response:**

```json
{
  "tenantId": "t1",
  "overallAccuracy": 0.84,
  "bias": "overconfident",
  "modelDrift": {
    "riskEngine": 0.12,
    "entropyForecaster": 0.18
  },
  "modelAccuracies": [
    {
      "modelType": "risk_engine",
      "accuracy": 0.83,
      "bias": "overconfident",
      "sampleSize": 45,
      "brierScore": 0.17,
      "calibrationError": 0.14
    }
  ]
}
```

---

### POST /predictive/calibrate

Trigger full recalibration cycle.

**Body:**

```json
{
  "tenantId": "t1"
}
```

**Response:**

```json
{
  "message": "Calibration complete",
  "calibrationReport": {
    "overallCalibrationHealth": "good",
    "systemAccuracy": 0.84,
    "modelStatus": [
      {
        "modelType": "risk_engine",
        "accuracy": 0.83,
        "bias": "overconfident",
        "driftDetected": false,
        "needsCalibration": false
      }
    ],
    "recentAdjustments": [...],
    "recommendations": [
      {
        "action": "Recalibrate entropy_forecaster",
        "priority": "medium",
        "expectedImpact": "Improve entropy_forecaster accuracy by ~10-15%"
      }
    ]
  }
}
```

---

### GET /predictive/drift

Get forecasting drift metrics.

**Query params:**
- `tenantId` (required)

**Response:**

```json
{
  "tenantId": "t1",
  "driftDetections": [
    {
      "modelType": "risk_engine",
      "driftDetected": true,
      "driftMagnitude": 0.18,
      "driftType": "accuracy_decline",
      "recommendedAction": "recalibrate",
      "urgency": "high",
      "confidence": 0.85,
      "factors": [
        {
          "factor": "accuracy_trend",
          "contribution": 0.18,
          "description": "Accuracy declining: 18.0% change"
        }
      ]
    }
  ],
  "modelsNeedingRecalibration": [
    {
      "modelType": "risk_engine",
      "driftMagnitude": 0.18,
      "urgency": "high"
    }
  ],
  "overallDriftStatus": "drift_detected"
}
```

---

## System Behavior Change

### Before

```
forecast → used for decisions
```

Predictions were **assumed correct**.

### After

```
forecast → used for decisions → validated → corrected → improved
```

Predictions are **continuously learned**.

---

## Example: Full Lifecycle

### 1. Make Prediction

```typescript
const forecast = await predictiveRiskEngine.assessRisks(tenantId)
// forecast.overallRiskScore = 0.82
```

### 2. Execute

```typescript
const execution = await executeWorkflow(tenantId, goalId)
```

### 3. Observe Outcome

```typescript
const outcome = await tracker.recordRiskOutcome(forecast, {
  failureOccurred: false,  // Predicted 82% failure, didn't happen
  actualRiskLevel: 0.3,
  executionSuccess: true
})
// outcome.errorMetrics.probabilityError = 0.18 (off by 18%)
```

### 4. Analyze Accuracy

```typescript
const accuracy = await analyzer.analyzeRiskEngineAccuracy(tenantId)
// accuracy.overallAccuracy = 0.65
// accuracy.bias = 'overconfident'
```

### 5. Detect Drift

```typescript
const drift = await driftDetector.detectDrift(tenantId, 'risk_engine')
// drift.driftDetected = true
// drift.recommendedAction = 'recalibrate'
```

### 6. Apply Calibration

```typescript
const report = await calibrationEngine.performFullCalibration(tenantId)
// Adjusts risk sensitivity from 1.0 to 0.85
// Scales confidence from 0.90 to 0.76
```

### 7. Future Predictions Improved

```typescript
const newForecast = await predictiveRiskEngine.assessRisks(tenantId)
// newForecast.overallRiskScore = 0.65 (now calibrated)
// newForecast.confidence = 0.76 (scaled appropriately)
```

---

## Success Criteria

PR-016 is complete when the runtime can say:

```
Forecast error detected.

Risk engine overestimated failure probability by 22%.
Entropy forecaster drift: +0.14.

Adjusting confidence model:
- reducing risk sensitivity
- increasing convergence weighting
- recalibrating provider instability threshold

Future forecast accuracy expected to improve by 18%.
```

At that point, you have:

**A self-calibrating operational cognition system**

---

## What This Enables Next

### PR-017 (Future)

**Autonomous Planning Adjustment Layer**

Where runtime begins to:
- Change strategies before execution based on learned forecast reliability
- Self-select more conservative or aggressive planning modes
- Adjust goal confidence thresholds dynamically

---

## Key Insights

### 1. Prediction Quality is Learnable

Without calibration:
- Forecasts are static assumptions
- Errors accumulate silently
- Trust degrades over time

With calibration:
- Forecasts learn from mistakes
- Errors trigger corrections
- Trust is dynamically earned

### 2. Not All Models Are Equal

Some models are more reliable than others. Calibration quantifies this and adjusts confidence accordingly.

### 3. Drift is Inevitable

As systems evolve:
- Behavior changes
- Patterns shift
- Predictions degrade

Drift detection catches this before it becomes catastrophic.

### 4. Self-Healing Beats Manual Tuning

Manual parameter adjustment:
- Doesn't scale
- Lags behind changes
- Requires operator expertise

Self-healing adjustment:
- Scales automatically
- Reacts immediately
- Learns optimal parameters

---

## Demo

Run the calibration demo:

```bash
npx tsx demo-forecast-calibration.ts
```

**What the demo shows:**
1. Recording 50 forecast outcomes
2. Analyzing prediction accuracy (Brier score, bias)
3. Detecting prediction drift
4. Applying confidence scaling
5. Self-healing parameter adjustments
6. Full calibration cycle

---

## Integration with OperNext

OperNext dashboards should display:
- Prediction accuracy trends
- Drift alerts
- Calibration status
- Confidence changes
- "How wrong was the system historically"
- "Is prediction trust increasing or decreasing"

**BUT:**
- OperNext does NOT modify calibration logic
- Calibration stays fully inside runtime-core
- OperNext only consumes signals, metrics, insights

---

## Summary

This PR introduces the missing layer that transforms the runtime from:

**Predictive system**
- Makes predictions
- Assumes correctness

To:

**Self-calibrating operational cognition system**
- Makes predictions
- Validates predictions
- Learns from errors
- Corrects future predictions
- Continuously improves

The runtime now has:
- Self-awareness of prediction quality
- Continuous self-improvement
- Evidence-based confidence

This is the real inflection point.

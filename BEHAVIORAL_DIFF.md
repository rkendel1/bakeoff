# Behavioral Diff + Migration Analysis Layer

## Overview

The Behavioral Diff + Migration Analysis Layer provides **operational intelligence** for analyzing how tenant model versions evolve over time. This enables safe model evolution by detecting behavioral drift, predicting migration impact, and assessing operational risk.

## Core Concept

**Behavioral Diff** - Not schema diff. Not code diff. **Execution behavior diff**.

This layer analyzes how state machines, actions, and operational behavior change between model versions, enabling you to understand and predict the impact of model evolution on actual execution behavior.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Behavioral Diff + Migration Analysis Layer         │
├─────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌──────────────────────┐  │
│  │ BehavioralDiff     │  │ Migration            │  │
│  │ Engine             │  │ Simulator            │  │
│  └────────────────────┘  └──────────────────────┘  │
│  ┌────────────────────┐  ┌──────────────────────┐  │
│  │ Compatibility      │  │ Risk                 │  │
│  │ Analyzer           │  │ Scoring              │  │
│  └────────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Runtime Kernel (Execution + Versioning)            │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. BehavioralDiffEngine

**Location**: `src/runtime/diff/behavioral-diff-engine.ts`

Compares two tenant model versions semantically, detecting:

- **Transition drift**: Changes in state machine transitions
- **Action drift**: Changes in action definitions and providers
- **State/event changes**: Added or removed states and events
- **Operational risk**: Quantified risk assessment

```typescript
import { BehavioralDiffEngine } from './runtime/diff/behavioral-diff-engine.js'

const diffEngine = new BehavioralDiffEngine()
const diff = diffEngine.diff(modelV1, modelV2)

console.log(diff.changedTransitions)  // Transitions that changed
console.log(diff.changedActions)      // Actions with provider changes
console.log(diff.riskLevel)           // 'low' | 'medium' | 'high'
console.log(diff.riskScore)           // { score: 0-100, factors: [...] }
```

#### Behavioral Diff Output

```typescript
type BehavioralDiff = {
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

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high'
  riskScore: {
    score: number  // 0-100
    factors: RiskFactor[]
  }
}
```

### 2. CompatibilityAnalyzer

**Location**: `src/runtime/migration/compatibility.ts`

Classifies changes as **breaking** or **non-breaking** (warnings).

```typescript
import { CompatibilityAnalyzer } from './runtime/migration/compatibility.js'

const analyzer = new CompatibilityAnalyzer()
const compatibility = analyzer.analyze(diff)

console.log(compatibility.compatible)       // false if breaking changes
console.log(compatibility.breakingChanges)  // Array of breaking change descriptions
console.log(compatibility.warnings)         // Array of warning descriptions
```

#### Breaking Changes

Changes that break existing contracts:

- Removed transitions (execution paths disappear)
- Removed events (external integrations break)
- Removed states (state machine contracts break)
- Changed transition destinations (behavior changes)

#### Warnings

Changes that are non-breaking but risky:

- Provider changes (different execution behavior)
- Additional actions (new side effects)
- New transitions (expanded behavior space)
- New states/events (expanded contracts)

### 3. MigrationSimulator

**Location**: `src/runtime/migration/migration-simulator.ts`

Replays historical executions against a NEW model version to predict behavioral changes.

```typescript
import { MigrationSimulator } from './runtime/migration/migration-simulator.js'

const simulator = new MigrationSimulator()
const results = await simulator.simulateMigration(
  modelV1,     // Old model
  modelV2,     // New model
  {
    tenantId: 'tenant-1',
    fromVersion: 'v1',
    toVersion: 'v2',
    historicalExecutions: executions,
    sampleSize: 100  // Optional: sample for large datasets
  }
)

// Analyze results
results.forEach(result => {
  if (result.changed) {
    console.log(`Execution ${result.executionId}:`)
    console.log(`  Original: ${result.originalOutcome}`)
    console.log(`  Predicted: ${result.predictedOutcome}`)
    console.log(`  State changes:`, result.drift.stateChanges)
    console.log(`  Action changes:`, result.drift.actionChanges)
  }
})
```

#### Migration Simulation Result

```typescript
type MigrationSimulationResult = {
  executionId: string
  
  originalOutcome: string      // Final state in original execution
  predictedOutcome: string      // Final state in simulated execution
  
  changed: boolean              // Did the outcome change?
  
  drift: {
    stateChanges: StateChange[]
    actionChanges: ActionChange[]
  }
}
```

### 4. Operational Risk Scoring

Risk is calculated based on the severity of changes:

| Risk Factor | Points | Example |
|------------|--------|---------|
| Critical transition removed | 30 | Removed path from draft → signed |
| Terminal state removed | 30 | Removed "completed" state |
| Event removed | 20 | Removed "document.uploaded" |
| Provider changed | 20 | docuseal → docusign |
| Action added | 10 | Added "send_notification" |
| Transition added | 5 | Added draft → review |

**Risk Levels:**
- **High**: Score ≥ 70 (critical changes)
- **Medium**: Score ≥ 40 (significant changes)
- **Low**: Score < 40 (minor changes)

## Control Plane API

### GET /models/diff

Compare two model versions.

**Query Parameters:**
- `tenantId`: Tenant identifier
- `from`: Source model version
- `to`: Target model version

**Example:**
```bash
curl "http://localhost:3000/models/diff?tenantId=demo&from=v1.0&to=v2.0"
```

**Response:**
```json
{
  "diff": {
    "changedTransitions": [...],
    "changedActions": [...],
    "riskLevel": "medium",
    "riskScore": {
      "score": 55,
      "factors": ["provider_changed", "transition_removed"]
    }
  },
  "compatibility": {
    "compatible": false,
    "breakingChanges": [
      "Changed transition destination: document draft → pending_signature became → review_required"
    ],
    "warnings": [
      "Provider changed: send_for_signature (docuseal → docusign)"
    ],
    "summary": {
      "totalBreaking": 1,
      "totalWarnings": 1,
      "riskLevel": "medium"
    }
  }
}
```

### POST /models/simulate-migration

Simulate migration impact.

**Request Body:**
```json
{
  "tenantId": "demo",
  "fromVersion": "v1.0",
  "toVersion": "v2.0",
  "sampleSize": 100
}
```

**Response:**
```json
{
  "simulations": [
    {
      "executionId": "exec-123",
      "originalOutcome": "pending_signature",
      "predictedOutcome": "review_required",
      "changed": true,
      "drift": {
        "stateChanges": [...],
        "actionChanges": [...]
      }
    }
  ],
  "summary": {
    "total": 100,
    "changed": 35,
    "unchanged": 65,
    "changeRate": 35.0
  }
}
```

## Use Cases

### 1. Pre-Deployment Safety Check

Before deploying a new model version, check for breaking changes:

```typescript
const diff = diffEngine.diff(currentModel, newModel)
const compatibility = analyzer.analyze(diff)

if (!compatibility.compatible) {
  console.error('Breaking changes detected:')
  compatibility.breakingChanges.forEach(change => {
    console.error(`  - ${change}`)
  })
  throw new Error('Cannot deploy - breaking changes')
}
```

### 2. Migration Impact Analysis

Predict how many executions will change behavior:

```typescript
const results = await simulator.simulateMigration(oldModel, newModel, {
  tenantId: 'tenant-1',
  fromVersion: 'v1',
  toVersion: 'v2',
  historicalExecutions: last30DaysExecutions
})

const changeRate = (results.filter(r => r.changed).length / results.length) * 100
console.log(`${changeRate}% of executions will change behavior`)
```

### 3. Provider Migration Testing

Test the impact of changing providers (e.g., docuseal → docusign):

```typescript
const diff = diffEngine.diff(modelWithDocuSeal, modelWithDocuSign)

// Check if provider change is detected
const providerChanges = diff.changedActions.filter(
  change => change.before.provider !== change.after.provider
)

console.log('Provider changes:', providerChanges)
```

### 4. Operational Drift Monitoring

Monitor how models evolve over time:

```typescript
const versions = registry.listVersions('tenant-1')

for (let i = 0; i < versions.length - 1; i++) {
  const diff = diffEngine.diff(versions[i].model, versions[i+1].model)
  console.log(`${versions[i].version} → ${versions[i+1].version}:`)
  console.log(`  Risk: ${diff.riskLevel} (score: ${diff.riskScore.score})`)
  console.log(`  Factors: ${diff.riskScore.factors.join(', ')}`)
}
```

## Testing

Comprehensive test suite in `src/tests/behavioral-diff.test.ts`:

```bash
# Run all tests
npm test

# Run specific tests
npx tsx --test --test-name-pattern="BehavioralDiffEngine" src/tests/behavioral-diff.test.ts
```

## What This Enables

### Today
- **Safe model evolution**: Know what breaks before deploying
- **Migration confidence**: Predict impact on real executions
- **Operational awareness**: Understand behavioral drift

### Future
- **Automated migration tools**: Generate migration scripts automatically
- **Rollback intelligence**: Detect when to auto-rollback
- **Canonical extraction**: Derive common patterns across tenants
- **Predictive analytics**: Predict failure rates from model changes

## Why This Matters

You are transitioning from:

**BEFORE**: Runtime execution platform

**AFTER**: Operational evolution platform

This is the foundation for:
- v9: Tenant Operational Analytics
- v10: Emergent Canonical Extraction
- v11+: Adaptive operational systems

The bottleneck is no longer the runtime - it's understanding how tenant behavior evolves safely over time. This layer addresses that.

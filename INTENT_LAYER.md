# Intent Layer + Goal-Oriented Runtime Planning

**PR-014**

This is the architectural evolution from:

**adaptive execution engine**

to:

**goal-oriented operational cognition runtime**

⸻

## Architectural Shift

### Previous Phase

Runtime could:
- Learn
- Govern
- Adapt
- Optimize

But it only reacted to:
- Events
- Transitions
- Policies

### Current Phase

Runtime now understands:

**Why an operation exists**

This is the next major architectural threshold.

⸻

## The Missing Layer

Previous pipeline:

```
EVENT → TRANSITION → ACTION
```

Organizations actually operate like:

```
INTENT → OPERATIONAL STRATEGY → EXECUTION PLANS → ADAPTIVE EXECUTION
```

Without intent semantics:
- Recommendations stay local
- Governance stays tactical
- Memory stays reactive

**The runtime could not reason strategically.**

⸻

## New Runtime Architecture

```
Execution Engine
    ↓
Behavioral Intelligence
    ↓
Governance
    ↓
Memory & Strategy
    ↓
Intent & Goal Layer   ← NEW
```

⸻

## Core Concept

**Operational Intent Modeling**

Meaning:
- Transitions become tactics
- Workflows become strategies
- Runtime optimizes toward goals

Instead of merely:
- Replaying state machines

⸻

## Core Components

### 1. IntentGraph

**Location:** `src/runtime/intent/IntentGraph.ts`

Defines operational goals and their relationships.

**Example:**

```typescript
{
  id: "signed_contract_completion",
  goal: "obtain_signed_contract",
  successCriteria: [
    "document.state == signed"
  ],
  operationalStrategies: [
    "provider_signature_flow",
    "manual_review_flow"
  ],
  priority: "high"
}
```

**Critical realization:**
- Workflows become implementation details
- Goals become runtime truth

⸻

### 2. GoalPlanner

**Location:** `src/runtime/intent/GoalPlanner.ts`

Converts operational goals into executable strategies.

This is the beginning of runtime planning systems.

**Example:**

Given:
```
goal = obtain_signed_contract
```

Planner may select:
- Strategy A: DocuSeal fast-path
- Strategy B: Docusign fallback
- Strategy C: Manual approval recovery path

Based on:
- Provider stability
- Historical effectiveness
- Entropy
- Convergence
- Runtime memory

⸻

### 3. StrategyGraph

**Location:** `src/runtime/intent/StrategyGraph.ts`

Maps:
- Goals
- Tactics
- Transitions
- Providers
- Recovery plans

This becomes:

**The runtime operational reasoning graph**

⸻

### 4. IntentAwareGovernanceEngine

**Location:** `src/runtime/intent/IntentAwareGovernanceEngine.ts`

Enhances governance evaluation using:
- Operational goals
- Success priorities
- Strategic context

**Previous governance asked:**
> Is this safe?

**New governance asks:**
> Does this improve likelihood of goal completion?

**Huge difference.**

⸻

### 5. GoalOutcomeEvaluator

**Location:** `src/runtime/intent/GoalOutcomeEvaluator.ts`

Measures:
- Goal completion success
- Strategy effectiveness
- Tactical efficiency
- Recovery effectiveness

This becomes:

**Operational success intelligence**

⸻

### 6. OperationalPlanSynthesizer

**Location:** `src/runtime/intent/OperationalPlanSynthesizer.ts`

Generates adaptive plans dynamically.

Instead of static transition chains, runtime can synthesize:
- Recovery plans
- Alternate strategies
- Provider substitutions
- Fallback execution paths

Based on:
- Operational intent

⸻

## New Execution Pipeline

### OLD:

```
EVENT → PLAN → GOVERN → EXECUTE
```

### NEW:

```
INTENT → STRATEGY → PLAN → GOVERN → EXECUTE
```

Or more explicitly:

```
GOAL
  → STRATEGY SELECTION
    → EXECUTION PLANNING
      → GOVERNANCE
        → EXECUTION
          → LEARNING
```

This is the beginning of:

**Operational planning runtimes**

⸻

## New APIs

### POST /intent/goals

Define operational goals.

**Request:**

```json
{
  "tenantId": "acme-corp",
  "goal": "obtain_signed_contract",
  "description": "Achieve signed contract state",
  "successCriteria": [
    "document.state == signed"
  ],
  "priority": "high",
  "operationalStrategies": [
    "docusign_fast_path",
    "manual_review_flow"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "goal": {
    "id": "goal-123",
    "goal": "obtain_signed_contract",
    ...
  }
}
```

⸻

### GET /intent/strategies

Returns learned operational strategies for goals.

**Query params:**
- `tenantId` (required)
- `goalId` (optional)

**Response:**

```json
{
  "goalId": "goal-123",
  "strategies": [
    {
      "strategy": {
        "strategyName": "docusign_fast_path",
        "requiredTransitions": [...],
        "requiredProviders": [...]
      },
      "metrics": {
        "totalAttempts": 150,
        "successRate": 0.94,
        "averageExecutionTimeMs": 5200,
        "effectivenessScore": 0.91,
        "recentTrend": "improving"
      }
    }
  ]
}
```

⸻

### POST /intent/plan

Generates adaptive execution plans.

**Request:**

```json
{
  "tenantId": "acme-corp",
  "goalId": "goal-123",
  "strategyName": "docusign_fast_path"  // optional - will auto-select best
}
```

**Response:**

```json
{
  "goal": "obtain_signed_contract",
  "primaryStrategy": "docusign_fast_path",
  "primaryPlan": {
    "actions": [...],
    "transition": {...}
  },
  "recoveryPlans": [
    {
      "trigger": "provider_failure",
      "strategy": "manual_review_recovery",
      "confidence": 0.85
    }
  ],
  "predictedSuccessProbability": 0.94,
  "strategySelection": {
    "selectedStrategy": "docusign_fast_path",
    "confidence": 0.91,
    "rationale": [
      "Strategy historically highest completion rate",
      "Lowest entropy",
      "Best convergence score",
      "Provider stability high"
    ],
    "fallbackStrategies": [
      {
        "strategy": "manual_review_recovery",
        "confidence": 0.85
      }
    ]
  }
}
```

⸻

### GET /intent/outcomes

Returns goal completion rates.

**Query params:**
- `tenantId` (required)
- `goalId` (optional)

**Response:**

```json
{
  "goalId": "goal-123",
  "tenantId": "acme-corp",
  "totalAttempts": 200,
  "successfulCompletions": 188,
  "completionRate": 0.94,
  "strategyPerformance": [
    {
      "strategy": "docusign_fast_path",
      "attempts": 150,
      "successRate": 0.96,
      "effectiveness": 0.91
    },
    {
      "strategy": "manual_review_flow",
      "attempts": 50,
      "successRate": 0.88,
      "effectiveness": 0.75
    }
  ],
  "trendData": [
    {
      "period": "2025-W01",
      "completionRate": 0.92,
      "totalAttempts": 50
    },
    {
      "period": "2025-W02",
      "completionRate": 0.94,
      "totalAttempts": 50
    }
  ]
}
```

⸻

## Usage Examples

### Define a Goal

```typescript
import { IntentGraph } from './runtime/intent/IntentGraph.js'

const intentGraph = new IntentGraph()

const goal = {
  id: 'goal-123',
  tenantId: 'acme-corp',
  goal: 'obtain_signed_contract',
  description: 'Achieve signed contract state',
  successCriteria: ['document.state == signed'],
  priority: 'high',
  operationalStrategies: ['docusign_fast_path'],
  createdAt: new Date(),
  updatedAt: new Date()
}

intentGraph.registerGoal(goal)
```

### Define a Strategy

```typescript
const strategy = {
  id: 'strategy-123',
  strategyName: 'docusign_fast_path',
  goalId: 'goal-123',
  tenantId: 'acme-corp',
  description: 'Fast path using DocuSign provider',
  requiredTransitions: [
    {
      from: 'draft',
      to: 'pending_signature',
      event: 'document.submitted_for_signature'
    }
  ],
  requiredProviders: [
    {
      action: 'send_for_signature',
      provider: 'docusign',
      alternateProviders: ['docuseal', 'manual']
    }
  ],
  fallbackStrategy: 'manual_review_flow',
  createdAt: new Date(),
  updatedAt: new Date()
}

intentGraph.registerStrategy(strategy)
```

### Select Best Strategy for Goal

```typescript
import { GoalPlanner } from './runtime/intent/GoalPlanner.js'

const planner = new GoalPlanner(
  intentGraph,
  strategyOutcomeStore
)

const selection = await planner.selectStrategy('acme-corp', 'goal-123')

console.log('Selected:', selection.selectedStrategy)
console.log('Confidence:', selection.confidence)
console.log('Reasoning:', selection.rationale)
console.log('Expected success:', selection.expectedSuccessProbability)
```

### Generate Adaptive Execution Plan

```typescript
import { OperationalPlanSynthesizer } from './runtime/intent/OperationalPlanSynthesizer.js'

const synthesizer = new OperationalPlanSynthesizer(
  intentGraph,
  strategyGraph,
  goalOutcomeEvaluator
)

const plan = await synthesizer.synthesizePlan(
  'acme-corp',
  'goal-123',
  'docusign_fast_path',
  tenantModel
)

console.log('Primary plan:', plan.primaryPlan)
console.log('Recovery plans:', plan.recoveryPlans.length)
console.log('Can reroute:', plan.canReroute)
console.log('Predicted success:', plan.predictedSuccessProbability)
```

### Evaluate Goal Completion

```typescript
import { GoalOutcomeEvaluator } from './runtime/intent/GoalOutcomeEvaluator.js'

const evaluator = new GoalOutcomeEvaluator(
  strategyOutcomeStore,
  intentGraph
)

const completionRate = await evaluator.evaluateGoalCompletionRate(
  'acme-corp',
  'goal-123'
)

console.log('Completion rate:', completionRate.completionRate)
console.log('Total attempts:', completionRate.totalAttempts)
console.log('Strategy performance:', completionRate.strategyPerformance)
```

### Intent-Aware Governance

```typescript
import { IntentAwareGovernanceEngine } from './runtime/intent/IntentAwareGovernanceEngine.js'

const intentGovernance = new IntentAwareGovernanceEngine(
  policyEngine,
  intentGraph,
  goalOutcomeEvaluator
)

const decision = await intentGovernance.evaluateWithGoalContext(
  policyContext,
  'goal-123'
)

console.log('Policy decision:', decision.policyDecision.allowed)
console.log('Likely to achieve goal:', decision.goalImpact.likelyToAchieveGoal)
console.log('Completion probability:', decision.goalImpact.goalCompletionProbability)
console.log('Reasoning:', decision.goalImpact.reasoning)

if (decision.suggestedAlternatives) {
  console.log('Alternatives:', decision.suggestedAlternatives)
}
```

⸻

## Persistence Layer

### IntentStore

Stores goal and strategy definitions.

```typescript
import { IntentStore } from './runtime/intent/IntentStore.js'

const intentStore = new IntentStore()

await intentStore.storeGoal(goalDefinition)
await intentStore.storeStrategy(strategyDefinition)

const goals = await intentStore.getGoalsForTenant('acme-corp')
const strategies = await intentStore.getStrategiesForGoal('goal-123')
```

### GoalExecutionStore

Stores operational intent tracking (active goal executions).

```typescript
import { GoalExecutionStore } from './runtime/intent/GoalExecutionStore.js'

const goalExecStore = new GoalExecutionStore()

await goalExecStore.createIntent(operationalIntent)

const activeIntents = await goalExecStore.getActiveIntents('acme-corp')
const completedIntents = await goalExecStore.getCompletedIntents('acme-corp')
```

### StrategyOutcomeStore

Stores goal execution outcomes for learning.

```typescript
import { StrategyOutcomeStore } from './runtime/intent/StrategyOutcomeStore.js'

const outcomeStore = new StrategyOutcomeStore()

await outcomeStore.storeOutcome(goalOutcome)

const outcomes = await outcomeStore.getOutcomesForStrategy(
  'acme-corp',
  'goal-123',
  'docusign_fast_path'
)

const successful = await outcomeStore.getSuccessfulOutcomes('acme-corp')
```

⸻

## Critical Realization

This PR changes the runtime from:

**adaptive execution engine**

into:

**goal-oriented operational runtime**

This is where:
- Workflows stop being central

and:
- Operational outcomes become central

⸻

## Success Criteria

PR complete when runtime can say:

```
Goal: obtain_signed_contract

Selected strategy: docusign_fast_path

Reasoning:
  • Historically highest completion rate
  • Lowest entropy
  • Best convergence score
  • Provider stability high

Fallback strategy: manual_review_recovery

Predicted success probability: 94%
```

At that point, you no longer have:
- A workflow engine
- A BPM platform
- An orchestration service

You have:

**A goal-oriented operational cognition runtime**

And that is the next real architectural frontier.

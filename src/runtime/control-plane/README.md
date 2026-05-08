# Execution Control Plane + Inspection Layer

The Control Plane transforms the bakeoff runtime from a simple execution engine into an **observable, queryable, and simulatable** system.

## Overview

The Control Plane consists of four key components:

1. **ExecutionQuery** - Query API for executions
2. **RuntimeInspector** - Observability layer
3. **ReplayEngine** - Safe execution replay
4. **SimulationEngine** - Model change simulation

## Components

### 1. ExecutionQuery

Location: `src/runtime/control-plane/execution-query.ts`

Makes executions a first-class query surface.

**API:**

```typescript
import { ExecutionQuery } from './runtime/control-plane/execution-query.js'

const query = new ExecutionQuery(executionStore)

// Get execution by ID
const execution = await query.getById('execution-id')

// Get all executions for an entity
const entityExecutions = await query.getByEntity('tenant-1', 'doc-123')

// Get failed executions for a tenant
const failed = await query.getFailed('tenant-1')

// Get executions by resulting state
const signedDocs = await query.getByState('tenant-1', 'signed')

// Get execution timeline/trace
const timeline = await query.getTimeline('execution-id')
```

### 2. RuntimeInspector

Location: `src/runtime/control-plane/inspector.ts`

Turns raw execution into readable insight.

**Output:**

```typescript
{
  executionId: string
  summary: {
    startState?: string
    endState?: string
    eventChain: string[]
    actionsExecuted: string[]
    providersTouched: string[]
  }
  timeline: ExecutionTrace[]
  stateChanges: StateUpdate[]
  errors?: Array<{
    message: string
    name: string
  }>
}
```

**Usage:**

```typescript
import { RuntimeInspector } from './runtime/control-plane/inspector.js'

const inspector = new RuntimeInspector()

// Inspect single execution
const inspection = inspector.inspect(execution)
console.log(inspection.summary)

// Inspect multiple executions
const inspections = inspector.inspectMany(executions)
```

### 3. ReplayEngine

Location: `src/runtime/replay/replay-engine.ts`

Replay executions using snapshots WITHOUT hitting external providers.

**Key Features:**
- Uses recorded snapshots
- No external provider calls
- Safe for testing and debugging

**Usage:**

```typescript
import { replayExecution, canReplay } from './runtime/replay/replay-engine.js'

// Check if execution can be replayed
if (canReplay(execution)) {
  // Replay execution
  const result = await replayExecution(execution)
  console.log('Replayed:', result.trace)
}
```

### 4. SimulationEngine

Location: `src/runtime/simulate/simulation-engine.ts`

Run tenant model changes safely - "what would happen if we changed this model?"

**Output:**

```typescript
{
  predictedState?: string
  predictedActions: string[]
  executionTrace: ExecutionTrace[]
  sideEffects: {
    emittedEvents: RuntimeEvent[]
    stateChanges: StateUpdate[]
  }
}
```

**Usage:**

```typescript
import { simulate, simulateMany } from './runtime/simulate/simulation-engine.js'

// Simulate single event
const result = await simulate(
  event,
  modelVersion,
  currentState
)

console.log('Predicted state:', result.predictedState)
console.log('Predicted actions:', result.predictedActions)

// Simulate multiple events in sequence
const results = await simulateMany(
  [event1, event2],
  modelVersion,
  initialState
)
```

## Use Cases

### 1. Debugging Executions

```typescript
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()

// Find failed executions
const failed = await query.getFailed('tenant-1')

// Inspect what went wrong
for (const execution of failed) {
  const inspection = inspector.inspect(execution)
  console.log('Failed:', inspection.summary)
  console.log('Errors:', inspection.errors)
}
```

### 2. Testing Model Changes

```typescript
// Test a proposed model change
const newModel = { /* updated model */ }

const simulation = await simulate(
  testEvent,
  newModel,
  currentState
)

// Check if the change produces expected outcomes
if (simulation.predictedState === 'expected_state') {
  console.log('✓ Model change looks good!')
} else {
  console.log('✗ Model change has unexpected effects')
}
```

### 3. Analyzing System Behavior

```typescript
const query = new ExecutionQuery(executionStore)
const inspector = new RuntimeInspector()

// Get all executions for an entity
const executions = await query.getByEntity('tenant-1', 'doc-123')

// Analyze the execution flow
const inspections = inspector.inspectMany(executions)

console.log('Event flow:', inspections.map(i => i.summary.eventChain))
console.log('State transitions:', inspections.map(i => 
  `${i.summary.startState} → ${i.summary.endState}`
))
```

### 4. Replaying for Investigation

```typescript
// Get an execution to investigate
const execution = await query.getById('execution-id')

// Replay it to see what happened
const replayed = await replayExecution(execution)

// The replay won't hit external providers
console.log('Replay trace:', replayed.trace)
```

## Demo

Run the demo to see all features in action:

```bash
npm run build
npx tsx src/examples/control-plane-demo.ts
```

## Testing

All components have comprehensive tests:

```bash
npx tsx --test src/tests/control-plane.test.ts
```

## Architecture Shift

This represents a fundamental shift in the runtime architecture:

**Before:**
- Runtime executes business logic deterministically

**After:**
- Runtime is observable and queryable
- Executions can be inspected and analyzed
- Model changes can be simulated safely
- System behavior is predictable

## Key Benefits

1. **Observability**: Understand what happened during execution
2. **Queryability**: Find and retrieve executions by various criteria
3. **Replayability**: Safely replay executions for debugging
4. **Predictability**: Simulate changes before applying them

## Next Steps

The Control Plane enables:
- Execution viewer UI/API
- Tenant model evolution layer
- Business execution intelligence
- Advanced analytics and insights

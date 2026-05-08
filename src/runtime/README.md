# Runtime Kernel Architecture

This directory contains the v1 runtime kernel implementation with a deterministic staged pipeline architecture.

## Core Concepts

### Execution Pipeline Model

The runtime processes events through a **deterministic staged pipeline**:

```
INGEST → EVALUATE → PLAN → EXECUTE → APPLY → EMIT
```

Each stage is:
- **Isolated**: Clear boundaries and responsibilities
- **Testable**: Can be tested independently
- **Replaceable**: Can be swapped without affecting other stages

### ExecutionContext

The `ExecutionContext` is the core abstraction that carries all runtime state through pipeline stages. It serves as the "control plane working memory" for event processing.

```typescript
type ExecutionContext = {
  // Input
  tenantId: string
  entityId: string
  entityType: string
  event: RuntimeEvent
  model: TenantModel
  
  // Working state
  currentState?: RuntimeState
  transitions: Transition[]
  plannedActions: PlannedAction[]
  
  // Output
  emittedEvents: RuntimeEvent[]
  stateUpdates: StateUpdate[]
  
  // Observability
  trace: ExecutionTrace[]
}
```

## Pipeline Stages

### 1. INGEST
**Purpose**: Receives and logs incoming events

**Responsibilities**:
- Log event receipt
- Append event to event store
- Add trace entry

### 2. EVALUATE
**Purpose**: Evaluates which transitions apply to the current event

**Responsibilities**:
- Retrieve current state from state store
- Find matching transition based on event type, entity type, and current state
- Add matched transition to context
- Log evaluation result

### 3. PLAN
**Purpose**: Plans which actions to execute

**Responsibilities**:
- Extract actions from matched transition
- Look up action definitions from model
- Add planned actions to context

### 4. EXECUTE
**Purpose**: Executes planned actions through adapters

**Responsibilities**:
- Execute actions via executor
- Collect follow-up events from action results
- Add emitted events to context

### 5. APPLY
**Purpose**: Applies state changes

**Responsibilities**:
- Update entity state in state store
- Record state transition in history
- Add state update to context

### 6. EMIT
**Purpose**: Finalizes event emission

**Responsibilities**:
- Complete trace
- Return context with emitted events for dispatcher to enqueue

## Usage

```typescript
const engine = new RuntimeEngine(
  tenantModel,
  stateStore,
  eventStore,
  executor,
  dispatcher
)

await engine.ingest({
  tenantId: 'demo',
  entityId: 'doc-123',
  entityType: 'document',
  type: 'document.uploaded',
  payload: { fileName: 'contract.pdf' }
})
```

## Benefits

### Before (Monolithic)
```typescript
handleEvent() {
  evaluate()
  execute()
  update()
  emit()
}
```

### After (Pipeline)
```typescript
handleEvent(event) {
  const ctx = createContext(event)
  return pipe(ctx, [
    ingest,
    evaluate,
    plan,
    execute,
    apply,
    emit
  ])
}
```

**Advantages**:
- Clear separation of concerns
- Each stage can be tested independently
- Easy to add observability (traces)
- Simple to extend with new stages
- Maintains backward compatibility

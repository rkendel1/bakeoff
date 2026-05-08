# Emergent Canonical Intelligence Layer

## Overview

The **Emergent Canonical Intelligence Layer** is where bakeoff transitions from a deterministic runtime to an adaptive operational intelligence system. This layer analyzes execution history to derive canonical operational behavior, independent of what tenant models declare.

This is a fundamental philosophical shift:

**Before:**
- Tenant model = source of truth
- Runtime executes what the model says
- Behavior is deterministic

**After:**
- Execution behavior = evidence
- Tenant models = hypotheses
- Runtime helps tenants reconcile the two
- Behavior patterns emerge organically

## Core Concept

The runtime now has:
- Execution history
- Versioned models
- Behavioral diffs

The next step is: **derive stable operational semantics from execution behavior itself**

This means the runtime can provide evidence:
- "These transitions are frequently observed" (even if not formally defined)
- "This provider is commonly used for this action" (regardless of model declaration)
- "These states are operationally central" (based on actual usage)
- "This workflow has emerged organically" (from repeated execution patterns)

The runtime then helps tenants reconcile their hypotheses (models) with the evidence (execution).

## Architecture

### Layer Placement

```
Runtime Control Plane
    ↓
Execution Plane
    ↓
Runtime Engine
    ↓
Behavioral Diff Layer
    ↓
Emergent Canonical Intelligence Layer   ← NEW
```

### Module Location

```
src/runtime/intelligence/
├── types.ts                           # Core type definitions
├── CanonicalTransitionGraph.ts        # Weighted operational graph
├── ExecutionPatternAnalyzer.ts        # Pattern detection and analysis
├── CanonicalInferenceEngine.ts        # Main inference engine
└── DriftFromCanonicalAnalyzer.ts      # Drift detection

src/runtime/store/
└── OperationalTopologyStore.ts        # Persistent topology snapshots
```

## Core Components

### 1. CanonicalTransitionGraph

**Purpose:** Build weighted operational graph from execution history

The graph represents the tenant's **observed** operational behavior as evidenced through execution, which may differ from their declared model.

**Key concepts:**
- **Weight:** Based on execution frequency and success rate
- **Confidence:** Normalized weight representing how canonical a transition is
- **Operational topology:** The graph structure becomes the runtime's understanding of the tenant's true operational semantics

**Usage:**
```typescript
const graph = new CanonicalTransitionGraph()
graph.build(executions)

const canonical = graph.getCanonicalTransitions()
// [
//   { from: 'draft', to: 'pending_signature', confidence: 0.94, ... },
//   ...
// ]
```

**Weighting Algorithm:**
```
weight = (execution_count × success_rate) / total_executions
```

Transitions with:
- High frequency + high success rate = high confidence (canonical)
- Low frequency + low success rate = low confidence (unstable)

### 2. ExecutionPatternAnalyzer

**Purpose:** Detect execution patterns, frequencies, and convergence

The analyzer identifies:
- Most common execution paths
- Path frequencies and success rates
- Average durations
- Path convergence (how many executions follow the same paths)
- Execution entropy (measure of path diversity)
- Stable paths (high success rate + high frequency)
- Bottlenecks (states where failures occur)

**Usage:**
```typescript
const analyzer = new ExecutionPatternAnalyzer()
const patterns = analyzer.analyzePatterns(executions)
// [
//   { path: ['draft', 'pending_signature', 'signed'], frequency: 45, successRate: 0.98, ... },
//   ...
// ]

const entropy = analyzer.calculateExecutionEntropy(executions)
// 0.23 (low entropy = converged behavior)

const convergence = analyzer.calculatePathConvergence(executions, 3)
// 0.91 (91% of executions follow top 3 paths)
```

### 3. CanonicalInferenceEngine

**Purpose:** Main intelligence engine that derives canonical behavior from execution history

This is where the runtime transitions from "executing what the model says" to "understanding what actually happens."

The engine analyzes execution history to infer:
- Dominant transitions (what paths are actually taken)
- Dominant providers (which providers are actually used)
- Stable workflow paths (what workflows emerge organically)
- Canonical state clusters (which states are operationally important)
- Operational bottlenecks (where executions fail)

**Output:** `OperationalTopologySnapshot`

```typescript
const engine = new CanonicalInferenceEngine()
const snapshot = engine.generateTopologySnapshot('tenant-id', executions)

// snapshot contains:
// - canonicalStates: states with centrality scores
// - canonicalTransitions: weighted transitions
// - dominantProviders: actual provider usage
// - stablePaths: reliable execution paths
// - entropyScore: measure of complexity
// - operationalComplexity: path diversity
// - canonicalConfidence: convergence confidence
```

**Key Metrics:**

1. **Entropy Score** (0-1): Measure of path diversity
   - Low entropy (< 0.3) = behavior has converged to few stable paths
   - High entropy (> 0.7) = diverse, unpredictable execution patterns

2. **Operational Complexity** (0-1): Ratio of unique paths to total executions
   - Low complexity = simple, predictable workflows
   - High complexity = many different execution patterns

3. **Canonical Confidence** (0-1): How well behavior has converged
   - High confidence = executions converge on few stable paths
   - Low confidence = high diversity, low convergence
   - Formula: `(1 - entropy) × convergence`

### 4. DriftFromCanonicalAnalyzer

**Purpose:** Detect drift between declared model and observed execution behavior

This is where the runtime becomes self-aware.

The analyzer compares:
- What the model declares (transitions, states, actions, providers)
- What actually happens in execution (observed behavior)

And detects:
- **Unused transitions:** Defined in model but never executed
- **Shadow transitions:** Executed but not formally defined
- **Dead states:** Defined but never reached
- **Provider drift:** Different providers used than declared
- **Model coverage:** Percentage of model actually used

**Usage:**
```typescript
const analyzer = new DriftFromCanonicalAnalyzer()
const drift = analyzer.analyzeDrift('tenant-id', model, executions)

// drift contains:
// - driftDetected: boolean
// - unusedTransitions: ["draft -> pending_review"]
// - shadowTransitions: ["draft -> pending_signature"]
// - entropyScore: 0.67
// - recommendations: [...]
```

**Why This Matters:**

This is where:
- Workflow definitions are hypotheses to be tested
- Execution provides empirical evidence
- The runtime helps reconcile hypothesis with evidence
- The runtime can suggest model improvements based on observed behavior
- The runtime can detect when actual behavior diverges from intended behavior

### 5. OperationalTopologyStore

**Purpose:** Persistent storage for topology snapshots over time

This enables:
- Topology evolution tracking
- Operational maturity tracking
- Organizational behavior learning
- Temporal analysis of operational patterns

**Usage:**
```typescript
const store = new OperationalTopologyStore()

// Store snapshot
await store.store(snapshot)

// Get latest
const latest = await store.getLatest('tenant-id')

// Get evolution metrics
const evolution = await store.getEvolutionMetrics('tenant-id')
// {
//   entropyTrend: 'decreasing',
//   complexityTrend: 'decreasing',
//   confidenceTrend: 'increasing',
//   ...
// }
```

## API Endpoints

### GET /intelligence/canonical?tenantId=<id>

Returns inferred canonical model based on execution history.

**Example Response:**
```json
{
  "tenantId": "demo",
  "generatedAt": "2026-05-08T16:25:00Z",
  "canonicalStates": [
    {
      "state": "pending_signature",
      "centrality": 0.92,
      "executionCount": 45
    },
    {
      "state": "signed",
      "centrality": 0.78,
      "executionCount": 42
    }
  ],
  "canonicalTransitions": [
    {
      "from": "draft",
      "to": "pending_signature",
      "eventType": "document.uploaded",
      "confidence": 0.94,
      "executionCount": 45,
      "successRate": 0.98
    },
    {
      "from": "pending_signature",
      "to": "signed",
      "eventType": "signature.completed",
      "confidence": 0.91,
      "executionCount": 42,
      "successRate": 0.95
    }
  ],
  "dominantProviders": [
    {
      "action": "send_for_signature",
      "provider": "docuseal",
      "usage": 0.91,
      "successRate": 0.98,
      "executionCount": 45
    }
  ],
  "stablePaths": [
    {
      "path": ["draft", "pending_signature", "signed"],
      "frequency": 42,
      "successRate": 0.95,
      "averageDurationMs": 1523
    }
  ],
  "entropyScore": 0.23,
  "operationalComplexity": 0.15,
  "canonicalConfidence": 0.91
}
```

**Interpretation:**

This tenant's operational behavior has **converged strongly**:
- 91% canonical confidence (very high)
- 23% entropy (low = stable behavior)
- 15% complexity (simple workflow)
- 94% of executions follow the same path
- DocuSeal is dominant for signatures (91% usage)

### GET /intelligence/drift?tenantId=<id>

Returns operational drift analysis comparing declared model vs observed behavior.

**Example Response:**
```json
{
  "tenantId": "demo",
  "driftDetected": true,
  "unusedTransitions": [
    "draft -> pending_review (document.uploaded)"
  ],
  "shadowTransitions": [],
  "entropyScore": 0.67,
  "recommendations": [
    "Consider removing 1 unused transition(s) from the model",
    "Unused: draft -> pending_review (document.uploaded)",
    "High entropy detected: execution patterns are diverse and unpredictable",
    "Consider simplifying the workflow or adding constraints"
  ]
}
```

**Interpretation:**

This tenant has **model drift**:
- Defined `draft -> pending_review` but never uses it
- All executions go directly to `pending_signature`
- Model should be updated to match reality

### GET /intelligence/topology?tenantId=<id>

Returns weighted operational graph and topology evolution metrics.

**Example Response:**
```json
{
  "tenantId": "demo",
  "currentTopology": { /* latest snapshot */ },
  "evolutionMetrics": {
    "snapshotCount": 5,
    "entropyTrend": "decreasing",
    "complexityTrend": "decreasing",
    "confidenceTrend": "increasing",
    "averageEntropy": 0.34,
    "averageComplexity": 0.21,
    "averageConfidence": 0.78
  },
  "snapshotHistory": [ /* historical snapshots */ ]
}
```

**Interpretation:**

This tenant's operational behavior is **maturing**:
- Entropy decreasing → behavior converging
- Complexity decreasing → workflows simplifying
- Confidence increasing → patterns stabilizing
- The tenant is finding their operational groove

## Use Cases

### 1. Operational Health Monitoring

**Question:** "Is our workflow stable?"

```typescript
const snapshot = engine.generateTopologySnapshot(tenantId, executions)

if (snapshot.canonicalConfidence > 0.85) {
  console.log('✓ Highly stable workflow')
} else if (snapshot.entropyScore > 0.7) {
  console.log('⚠ High entropy - workflow is unpredictable')
}
```

### 2. Model Optimization

**Question:** "What parts of our model are actually used?"

```typescript
const drift = analyzer.analyzeDrift(tenantId, model, executions)

console.log('Unused transitions:', drift.unusedTransitions)
console.log('Shadow transitions:', drift.shadowTransitions)
console.log('Recommendations:', drift.recommendations)
```

### 3. Provider Reliability Analysis

**Question:** "Which providers are reliable?"

```typescript
const snapshot = engine.generateTopologySnapshot(tenantId, executions)

for (const provider of snapshot.dominantProviders) {
  console.log(`${provider.action}: ${provider.provider} (${provider.successRate * 100}% success)`)
}
```

### 4. Workflow Evolution Tracking

**Question:** "How has our workflow evolved?"

```typescript
const evolution = await store.getEvolutionMetrics(tenantId)

console.log('Trends:')
console.log('  Entropy:', evolution.entropyTrend)
console.log('  Complexity:', evolution.complexityTrend)
console.log('  Confidence:', evolution.confidenceTrend)
```

## Success Criteria

The system is successful when the runtime can say:

> "Although the tenant model defines 14 transitions, 92% of successful executions follow only 3 paths. The operational canonical has effectively converged into: **draft → pending_signature → signed**. DocuSeal is dominant for this action. Review states are operationally dead. Entropy is decreasing over time. Canonical confidence is 0.91."

This represents:
- Evidence-based operational understanding
- Runtime-observed semantics
- Behavioral convergence patterns
- Intelligence that helps tenants understand their actual operations

## Future Capabilities Unlocked

This layer enables future systems:

### 1. Adaptive Runtime Suggestions

The runtime can suggest:
- Removing dead transitions
- Consolidating states
- Provider optimization
- Workflow simplification

### 2. Autonomous Operational Optimization

The runtime can automatically:
- Reroute unstable providers
- Optimize execution paths
- Suggest canonical lifecycle reductions

### 3. AI Runtime Reasoning

LLMs can reason against:
- Operational topology
- Canonical transition graphs
- Tenant behavior signatures

Instead of raw schemas.

### 4. Cross-Tenant Canonical Learning

Later:
```
tenant canonicals
  → industry canonicals
  → universal operational patterns
```

This is where:
- Procurement patterns
- Onboarding patterns
- Approval patterns
- Signature patterns

Naturally emerge across all tenants.

## Implementation Notes

### Data Flow

```
1. Executions happen → ExecutionStore
2. Intelligence engine analyzes → OperationalTopologySnapshot
3. Snapshot stored → OperationalTopologyStore
4. API exposes → External systems
5. Over time → Evolution metrics
```

### Performance Considerations

- Analysis runs on-demand (not real-time)
- Snapshots can be cached
- Evolution metrics are incremental
- Graph building is O(n) where n = executions

### Storage Considerations

- In-memory for now (Map-based)
- Future: Persistent storage (database)
- Snapshots are immutable
- History can be pruned

## Philosophical Implications

This PR represents a pivotal architectural shift:

**Old Paradigm:**
- "The tenant defines their workflow"
- "The runtime executes it"
- "Models are the single source of truth"

**New Paradigm:**
- "Tenants hypothesize their workflow (model)"
- "The runtime gathers evidence through execution"
- "The runtime helps tenants reconcile hypothesis with evidence"
- "Models evolve based on observed operational reality"

This is the beginning of:
- Evidence-based operational modeling
- Operational topology inference from execution data
- Adaptive runtime intelligence
- Systems that help organizations understand their actual operations

The runtime is no longer just executing workflows—it's **providing evidence** to help tenants understand and improve them.

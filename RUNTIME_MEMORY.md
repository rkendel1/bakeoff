# Runtime Memory + Learned Execution Strategies

**PR-013 — Runtime Memory & Learned Execution Strategy Engine**

⸻

## Overview

This document describes the **Runtime Memory** architecture — the system's ability to learn which governance decisions produce better outcomes over time.

This represents a fundamental architectural shift from:
- **Policy-driven governance** → **Experience-informed adaptive governance**
- **Stateless decisions** → **History-informed decisions**
- **Static adaptation** → **Learned adaptation**

⸻

## Architectural Evolution

### Previous System

The runtime could:
- Execute
- Observe
- Infer
- Recommend
- Govern
- Adapt execution dynamically

But it was **fundamentally stateless between governance decisions**.

Every execution was evaluated mostly in isolation.

### New System

The runtime now:
- **Remembers** what adaptations occurred
- **Learns** which strategies succeeded
- **Develops** operational intuition over time
- **Informs** future governance decisions with historical effectiveness

⸻

## Core Architectural Shift

### Before

**Policy evaluates current conditions:**

```
if provider stability < threshold
→ reroute
```

### After

**Runtime learns which governance decisions work best:**

```
historically, rerouting docuseal → docusign
reduced retry rates by 63%
and improved convergence by 18%

→ strongly prefer reroute strategy
```

This is massive because:
- Governance becomes **experiential**
- Runtime becomes **history-informed**
- Adaptation becomes **learned** rather than static

⸻

## Runtime Architecture

The architecture now includes a memory & strategy layer:

```
Control Plane
    ↓
Execution Plane
    ↓
Runtime Engine
    ↓
Behavioral Intelligence
    ↓
Recommendation Layer
    ↓
Governance Layer
    ↓
Runtime Memory & Strategy Layer   ← NEW
```

⸻

## Key Concept: Operational Memory

The runtime now maintains **operational memory** that captures:

- What adaptations occurred
- Which strategies succeeded
- Which governance actions reduced failures
- Which provider reroutes stabilized execution
- Which execution paths improve convergence

Over time, the runtime **develops operational intuition**.

⸻

## Core Components

### 1. RuntimeMemoryStore

**Location:** `src/runtime/memory/RuntimeMemoryStore.ts`

Persistent operational memory storage.

**Stores:**
- Governance decisions
- Adaptive actions taken
- Execution outcomes
- Strategy effectiveness metrics
- Convergence improvements
- Provider recovery patterns

**Capabilities:**
- Store and retrieve memory records
- Query by tenant, trigger type, strategy
- Calculate most effective strategies
- Track strategy trends over time
- Index for fast lookups

**Example:**

```typescript
import { RuntimeMemoryStore } from './runtime/memory/RuntimeMemoryStore.js'

const memoryStore = new RuntimeMemoryStore()

// Store governance outcome
await memoryStore.store({
  id: 'mem-123',
  tenantId: 'acme-corp',
  trigger: {
    type: 'provider_instability',
    context: { provider: 'docuseal', stability: 0.35 },
    timestamp: new Date()
  },
  decision: {
    policyDecision: { allowed: true, rationale: [...] },
    enforcementActions: [...],
    strategyApplied: 'reroute:docuseal->docusign',
    rationale: [...]
  },
  outcome: {
    executionId: 'exec-456',
    status: 'completed',
    retryCount: 0
  },
  effectiveness: {
    score: 0.92,
    factors: {
      executionSuccess: true,
      retryReduction: 0.63,
      convergenceGain: 0.18,
      entropyReduction: 0.12
    }
  },
  createdAt: new Date()
})

// Get most effective strategies
const patterns = await memoryStore.getMostEffectiveStrategies(
  'acme-corp',
  'provider_instability',
  5
)
```

⸻

### 2. StrategyEffectivenessAnalyzer

**Location:** `src/runtime/memory/StrategyEffectivenessAnalyzer.ts`

Analyzes strategy effectiveness from historical memory.

**Responsibilities:**
- Build tenant operational profiles
- Recommend best strategies based on history
- Detect declining strategy effectiveness
- Generate operational insights
- Calculate learning confidence

**Key Methods:**

```typescript
// Build complete operational profile
const profile = await analyzer.buildTenantProfile('tenant-id')
// Returns:
// - Preferred strategies (ranked by effectiveness)
// - Common triggers and frequency
// - Provider preferences learned from outcomes
// - Learning confidence (based on data volume)

// Recommend best strategy for a trigger
const recommendation = await analyzer.recommendStrategy(
  'tenant-id',
  'provider_instability'
)
// Returns:
// - Strategy name
// - Effectiveness score
// - Confidence level
// - Historical success rate
// - Times applied

// Generate insights
const insights = await analyzer.generateInsights('tenant-id')
// Returns:
// - Declining strategy warnings
// - Emerging pattern detections
// - High-performing strategy recommendations
```

**Learning Confidence:**

The analyzer calculates confidence based on sample size:
- **< 5 samples:** Low confidence (0.3)
- **5-20 samples:** Medium confidence (0.6)
- **20-50 samples:** Good confidence (0.8)
- **50+ samples:** High confidence (0.95)

⸻

### 3. MemoryInformedGovernanceEngine

**Location:** `src/runtime/memory/MemoryInformedGovernanceEngine.ts`

**The key integration point** — combines policy-driven and experience-informed governance.

**Responsibilities:**
- Evaluate policies with learned strategies
- Enhance decisions with historical effectiveness
- Provide confidence-weighted recommendations
- Explain decisions with historical context

**Usage:**

```typescript
import { MemoryInformedGovernanceEngine } from './runtime/memory/MemoryInformedGovernanceEngine.js'
import { RuntimePolicyEngine } from './runtime/policy/RuntimePolicyEngine.js'
import { RuntimeMemoryStore } from './runtime/memory/RuntimeMemoryStore.js'

const policyEngine = new RuntimePolicyEngine()
const memoryStore = new RuntimeMemoryStore()
const memoryEngine = new MemoryInformedGovernanceEngine(
  policyEngine,
  memoryStore
)

// Evaluate with memory
const decision = await memoryEngine.evaluateWithMemory(context)

// Decision includes both:
// 1. Standard policy evaluation
// 2. Memory-informed recommendations

console.log(decision.memoryInformed)
// {
//   recommendedStrategy: 'reroute:provider_a->provider_b',
//   effectiveness: 0.87,
//   confidence: 0.8,
//   historicalSuccessRate: 0.94,
//   rationale: [
//     'Learned from 30 historical executions',
//     'Effectiveness score: 87%',
//     'Confidence level: 80%'
//   ]
// }
```

**Decision Enhancement:**

When confidence > 0.7 and effectiveness > 0.5, the engine adds `[LEARNED]` rationale:

```
[LEARNED] Historically, reroute:docuseal->docusign has 87% effectiveness
[LEARNED] Applied 30 times with 94% success rate
[LEARNED] Average retry reduction: 63%
```

⸻

## Runtime Memory Record

The fundamental unit of operational memory:

```typescript
type RuntimeMemoryRecord = {
  id: string
  tenantId: string

  // What triggered the governance decision
  trigger: {
    type: 'provider_instability' | 'high_entropy' | 'low_convergence' | 'canonical_drift'
    context: Record<string, unknown>
    timestamp: Date
  }

  // What governance decision was made
  decision: {
    policyDecision: PolicyDecision
    enforcementActions: EnforcementAction[]
    strategyApplied: string
    rationale: string[]
  }

  // What was the outcome
  outcome: {
    executionId: string
    status: ExecutionStatus
    retryCount?: number
    failureReason?: string
    convergenceImprovement?: number
    entropyChange?: number
    stabilityImprovement?: number
    completedAt?: Date
  }

  // How effective was the strategy
  effectiveness: {
    score: number  // 0-1
    factors: {
      executionSuccess: boolean
      retryReduction: number
      convergenceGain: number
      entropyReduction: number
    }
  }

  createdAt: Date
  outcomeCapturedAt?: Date
}
```

⸻

## Strategy Patterns

Learned patterns for governance strategies:

```typescript
type StrategyPattern = {
  strategyName: string
  triggerType: string
  
  // Historical effectiveness
  timesApplied: number
  successRate: number
  averageRetryReduction: number
  averageConvergenceGain: number
  averageEntropyReduction: number
  
  // Aggregate score
  effectivenessScore: number
  
  // Trend analysis
  recentTrend: 'improving' | 'stable' | 'declining'
  
  lastApplied: Date
}
```

⸻

## Tenant Operational Profile

Learned operational characteristics per tenant:

```typescript
type TenantOperationalProfile = {
  tenantId: string
  
  // Preferred strategies (ranked by effectiveness)
  preferredStrategies: Array<{
    strategy: string
    effectivenessScore: number
    confidence: number
  }>
  
  // Common operational problems
  commonTriggers: Array<{
    triggerType: string
    frequency: number
    lastOccurred: Date
  }>
  
  // Provider preferences learned from outcomes
  providerPreferences: Map<string, {
    stability: number
    reliability: number
    preferredFor: string[]
  }>
  
  // Learning metadata
  totalMemoryRecords: number
  learningConfidence: number
  profileGeneratedAt: Date
}
```

⸻

## Usage Examples

### Recording Governance Outcomes

```typescript
// After governance decision and execution
const memoryRecord: RuntimeMemoryRecord = {
  id: randomUUID(),
  tenantId: 'acme-corp',
  trigger: {
    type: 'provider_instability',
    context: {
      provider: 'docuseal',
      stability: 0.35,
      threshold: 0.5
    },
    timestamp: new Date()
  },
  decision: {
    policyDecision: decision,
    enforcementActions: decision.enforcementActions || [],
    strategyApplied: 'reroute:docuseal->docusign',
    rationale: decision.rationale
  },
  outcome: {
    executionId: executionRecord.id,
    status: executionRecord.status,
    retryCount: 0
  },
  effectiveness: {
    score: 0.92,
    factors: {
      executionSuccess: true,
      retryReduction: 0.63,
      convergenceGain: 0.18,
      entropyReduction: 0.12
    }
  },
  createdAt: new Date(),
  outcomeCapturedAt: new Date()
}

await memoryStore.store(memoryRecord)
```

### Querying Strategy Effectiveness

```typescript
// Get most effective strategies for provider instability
const strategies = await memoryStore.getMostEffectiveStrategies(
  'acme-corp',
  'provider_instability',
  5
)

for (const strategy of strategies) {
  console.log(`${strategy.strategyName}: ${strategy.effectivenessScore * 100}% effective`)
  console.log(`  Applied ${strategy.timesApplied} times`)
  console.log(`  Success rate: ${strategy.successRate * 100}%`)
  console.log(`  Trend: ${strategy.recentTrend}`)
}
```

### Building Operational Profile

```typescript
const analyzer = new StrategyEffectivenessAnalyzer(memoryStore)
const profile = await analyzer.buildTenantProfile('acme-corp')

console.log(`Learning confidence: ${profile.learningConfidence * 100}%`)
console.log('Top strategies:')
for (const pref of profile.preferredStrategies.slice(0, 3)) {
  console.log(`  ${pref.strategy}: ${pref.effectivenessScore * 100}% effective`)
}
```

### Memory-Informed Governance

```typescript
const memoryEngine = new MemoryInformedGovernanceEngine(
  policyEngine,
  memoryStore
)

const decision = await memoryEngine.evaluateWithMemory(context)

if (decision.memoryInformed) {
  console.log('Learned recommendation:', decision.memoryInformed.recommendedStrategy)
  console.log('Historical effectiveness:', decision.memoryInformed.effectiveness)
  console.log('Confidence:', decision.memoryInformed.confidence)
}

// Decision rationale now includes [LEARNED] insights
for (const reason of decision.rationale) {
  console.log(reason)
}
```

### Detecting Declining Strategies

```typescript
const insights = await analyzer.generateInsights('acme-corp')

for (const insight of insights) {
  if (insight.type === 'effectiveness_change' && insight.severity === 'warning') {
    console.log(`⚠️  ${insight.message}`)
  }
}
```

⸻

## Effectiveness Scoring

Strategy effectiveness is calculated as a weighted average:

```typescript
effectivenessScore = 
  successRate * 0.4 +
  avgRetryReduction * 0.2 +
  avgConvergenceGain * 0.2 +
  avgEntropyReduction * 0.2
```

This ensures the score considers:
- **Execution success** (40% weight)
- **Retry reduction** (20% weight)
- **Convergence improvement** (20% weight)
- **Entropy reduction** (20% weight)

⸻

## Trend Detection

The system detects strategy trends by comparing first half vs second half of historical data:

- **Improving:** Second half effectiveness > first half + 0.1
- **Declining:** Second half effectiveness < first half - 0.1
- **Stable:** Within ±0.1 range

Trends help identify:
- Strategies that are getting better over time
- Strategies that are becoming less effective
- Need to re-evaluate or adjust strategies

⸻

## Demo

Run the comprehensive demo to see runtime memory in action:

```bash
npx tsx demo-runtime-memory.ts
```

The demo shows:
1. Building operational memory from 50 governance decisions
2. Learning most effective strategies
3. Building tenant operational profiles
4. Memory-informed governance decisions
5. Strategy recommendations
6. Declining strategy detection
7. The architectural evolution comparison

⸻

## Testing

Comprehensive test suite: `src/tests/runtime-memory.test.ts`

**13 tests covering:**
- RuntimeMemoryStore storage and retrieval
- Query by tenant, trigger type, strategy
- Most effective strategies calculation
- Strategy trend detection
- Tenant profile building
- Strategy recommendation
- Declining strategy detection
- Memory-informed governance integration
- Learning confidence calculation

Run tests:

```bash
npx tsx --test src/tests/runtime-memory.test.ts
```

⸻

## Key Insights

### 1. The Runtime Now Answers

**Before:** "Can this transition execute?"

**After:** "Based on 30 historical executions, rerouting to docusign has 92% effectiveness. This strategy reduced retries by 63% and improved convergence by 18%. High confidence."

### 2. Governance Becomes Experiential

The runtime doesn't just follow rules — it **learns from experience**.

### 3. Operational Intuition Emerges

With enough data, the runtime develops a "feel" for what works best in different situations.

### 4. Tenant-Specific Learning

Each tenant's operational profile is learned independently, allowing for organization-specific optimization.

### 5. Confidence-Weighted Decisions

The system knows when it has enough data to be confident, and when it's still learning.

⸻

## Future Enhancements

Potential areas for expansion:

1. **Cross-tenant learning** — Learn from similar patterns across tenants
2. **Time-based patterns** — Detect time-of-day or seasonal effectiveness patterns
3. **Context-aware strategies** — Learn which strategies work best for specific contexts
4. **Automated strategy discovery** — Automatically discover new effective strategies
5. **Memory pruning** — Intelligently forget outdated or irrelevant memories
6. **Multi-dimensional effectiveness** — More sophisticated effectiveness scoring models

⸻

## Conclusion

Runtime Memory represents a fundamental shift in how the system operates:

From **reactive policy enforcement** to **proactive learned optimization**.

The runtime is no longer stateless. It remembers, learns, and continuously improves.

This is the emergence of **operational intelligence**.

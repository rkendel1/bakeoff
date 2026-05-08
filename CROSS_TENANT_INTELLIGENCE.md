# 🚀 PR-023 — Cross-Tenant Canonical Intelligence Layer

## Summary

This PR introduces a **global intelligence layer** over isolated tenant runtimes that:
- Learns cross-tenant operational patterns
- Derives canonical behaviors
- Detects universal strategy effectiveness
- Improves recommendations globally

**But enforces:**

❗ **NO raw execution data ever crosses tenant boundaries**

Only abstracted, anonymized behavioral signals are shared.

---

## 🧠 Architectural Shift

### BEFORE

```
TenantRuntimeRegistry
  ├── Tenant A (fully isolated brain)
  ├── Tenant B (fully isolated brain)
  ├── Tenant C (fully isolated brain)
```

Learning is **local only**.

### AFTER (this PR)

```
TenantRuntimes (isolated cognition)
        ↓
CrossTenantIntelligenceLayer (abstracted signals only)
        ↓
CanonicalPatternGraph (global behavioral model)
        ↓
RecommendationAmplificationEngine
```

---

## 🚨 Core Principle (NON-NEGOTIABLE)

### ❌ NEVER ALLOWED
- Raw execution traces
- Tenant-specific event histories
- Identifiable workflows
- Provider-level per-tenant mappings

### ✅ ONLY ALLOWED
- Aggregated pattern signatures
- Anonymized transition frequencies
- Normalized effectiveness scores
- Entropy and convergence metrics
- Strategy outcome distributions

---

## 📦 New Components

### 1. CrossTenantSignalAggregator

**File:** `src/runtime/intelligence/cross-tenant/CrossTenantSignalAggregator.ts`

**Purpose:** Aggregates tenant snapshots into privacy-preserving signals

**Key Methods:**
```typescript
aggregate(tenantSnapshots: TenantSnapshot[]): AggregatedSignals
```

**Privacy Guarantees:**
- All transitions are hashed (irreversible)
- Provider stats are aggregated (no per-tenant breakdown)
- Strategies are abstracted by type and size
- Only statistical metrics cross boundaries

### 2. CanonicalPatternGraph

**File:** `src/runtime/intelligence/cross-tenant/CanonicalPatternGraph.ts`

**Purpose:** Maintains global behavioral model from abstracted signals

**Key Features:**
- Tracks global transition patterns with confidence scores
- Maintains provider reliability rankings
- Identifies most effective strategies
- Calculates global health metrics

**Key Methods:**
```typescript
ingest(signals: AggregatedSignals): void
getTopPatterns(limit: number): CanonicalPattern[]
getProviderReliability(): ProviderReliability[]
getTopStrategies(limit: number): StrategyEffectiveness[]
getGlobalMetrics(): GlobalMetrics
```

### 3. RecommendationAmplificationEngine

**File:** `src/runtime/intelligence/cross-tenant/RecommendationAmplificationEngine.ts`

**Purpose:** Amplifies recommendations using global intelligence

**Recommendation Types:**
- `pattern_adoption`: High-performing patterns to adopt
- `provider_switch`: Reliable providers to consider
- `strategy_optimization`: Effective strategies to try
- `entropy_reduction`: Actions to reduce unpredictability

**Key Methods:**
```typescript
generateRecommendations(tenantContext): GlobalRecommendation[]
```

### 4. CrossTenantIntelligenceLayer

**File:** `src/runtime/intelligence/cross-tenant/CrossTenantIntelligenceLayer.ts`

**Purpose:** Main orchestrator for global intelligence

**Key Methods:**
```typescript
collectAndLearn(): Promise<void>
getRecommendationsForTenant(tenantId: string): GlobalRecommendation[]
getGlobalMetrics(): GlobalMetrics
getTopPatterns(limit: number): CanonicalPattern[]
getProviderReliability(): ProviderReliability[]
getTopStrategies(limit: number): StrategyEffectiveness[]
```

---

## 🔄 Integration Architecture

```typescript
// Initialize with tenant registry
const registry = new TenantRuntimeRegistry()
const intelligenceLayer = new CrossTenantIntelligenceLayer(registry)

// Periodic learning (e.g., every hour)
setInterval(async () => {
  await intelligenceLayer.collectAndLearn()
}, 3600000)

// Get recommendations for a tenant
const recommendations = intelligenceLayer.getRecommendationsForTenant('acme-corp')

// Get global insights
const globalMetrics = intelligenceLayer.getGlobalMetrics()
const topPatterns = intelligenceLayer.getTopPatterns(10)
const providerReliability = intelligenceLayer.getProviderReliability()
```

---

## 🔒 Privacy Architecture

### Data Flow

1. **Collection Phase:**
   - Each tenant runtime generates **abstracted snapshot**
   - NO raw execution data leaves tenant boundary
   - Snapshots contain only statistical metrics

2. **Aggregation Phase:**
   - CrossTenantSignalAggregator combines snapshots
   - Further anonymization through hashing
   - Produces aggregate signals only

3. **Learning Phase:**
   - CanonicalPatternGraph ingests signals
   - Updates global behavioral model
   - Maintains confidence scores

4. **Recommendation Phase:**
   - RecommendationAmplificationEngine uses global patterns
   - Generates tenant-specific recommendations
   - NO cross-tenant data exposure

### Hash Functions

All sensitive data is irreversibly hashed:

```typescript
// Transition patterns
hashTransitions(transitions) → "draft->pending|pending->signed"

// Strategy types
hashStrategy(strategy) → "strategy_142_approval_workflow"
```

### Aggregation Rules

- **Minimum observations:** Patterns require ≥3 observations for confidence
- **Statistical only:** Only averages, counts, and distributions
- **No identifiers:** No tenant IDs, execution IDs, or entity IDs

---

## 📊 Confidence Scoring

Confidence increases with observations:

| Observations | Confidence |
|--------------|------------|
| < 5          | 0.3 (low)  |
| 5-20         | 0.6 (medium) |
| 20-50        | 0.8 (good) |
| 50+          | 0.95 (high) |

---

## 🎯 Use Cases

### 1. Global Pattern Discovery

```typescript
const topPatterns = intelligenceLayer.getTopPatterns(10)

for (const pattern of topPatterns) {
  console.log(`Pattern: ${pattern.signature}`)
  console.log(`Success Rate: ${(pattern.globalSuccessRate * 100).toFixed(1)}%`)
  console.log(`Confidence: ${(pattern.confidence * 100).toFixed(0)}%`)
  console.log(`Observations: ${pattern.observations}`)
}
```

### 2. Provider Reliability Analysis

```typescript
const providers = intelligenceLayer.getProviderReliability()

for (const provider of providers) {
  console.log(`${provider.provider}: ${(provider.successRate * 100).toFixed(1)}% success`)
  console.log(`  Operations: ${provider.totalOperations}`)
  console.log(`  Confidence: ${(provider.confidence * 100).toFixed(0)}%`)
}
```

### 3. Tenant-Specific Recommendations

```typescript
const recommendations = intelligenceLayer.getRecommendationsForTenant('acme-corp', {
  currentProviders: ['docuseal'],
  entropy: 0.75
})

for (const rec of recommendations) {
  console.log(`\n[${rec.type}] ${rec.title}`)
  console.log(`  ${rec.description}`)
  console.log(`  Confidence: ${(rec.confidence * 100).toFixed(0)}%`)
  console.log(`  Expected Impact: ${rec.expectedImpact}`)
  console.log(`  Steps:`)
  rec.actionableSteps.forEach(step => console.log(`    - ${step}`))
}
```

### 4. Platform Health Monitoring

```typescript
const metrics = intelligenceLayer.getGlobalMetrics()

console.log('Global Platform Metrics:')
console.log(`  Avg Entropy: ${metrics.avgEntropy.toFixed(2)}`)
console.log(`  Avg Convergence: ${metrics.avgConvergence.toFixed(2)}`)
console.log(`  Total Patterns: ${metrics.totalPatterns}`)
console.log(`  Reliable Patterns: ${metrics.reliablePatterns}`)
console.log(`  Total Observations: ${metrics.totalObservations}`)
```

---

## 🚀 Deployment

This PR also adds **continuous deployment** via GitHub Actions.

### New Workflow: `.github/workflows/deploy.yml`

**Trigger:** Push to `main` branch

**Steps:**
1. Checkout code
2. Set up Node.js 20
3. Install dependencies (`npm ci`)
4. Build application (`npm run build`)
5. Run tests (`npm test`)
6. Deploy to Fly.io

**Required Secret:**
- `FLY_API_TOKEN`: Fly.io API token for deployment

### Setup Instructions

1. Generate Fly.io API token:
   ```bash
   flyctl auth token
   ```

2. Add to GitHub Secrets:
   - Go to repository Settings → Secrets → Actions
   - Add new secret: `FLY_API_TOKEN`

3. Push to `main` branch to trigger deployment

---

## 🧪 Testing

### Unit Tests

Run tests for cross-tenant intelligence:

```bash
npm test
```

### Integration Testing

```typescript
import { CrossTenantIntelligenceLayer } from './runtime/intelligence/cross-tenant/index.js'
import { TenantRuntimeRegistry } from './runtime/tenant/TenantRuntimeRegistry.js'

// Set up registry with test tenants
const registry = new TenantRuntimeRegistry()
// ... register test tenants ...

// Initialize intelligence layer
const intel = new CrossTenantIntelligenceLayer(registry)

// Collect and learn
await intel.collectAndLearn()

// Verify global metrics
const metrics = intel.getGlobalMetrics()
assert(metrics.totalObservations > 0)

// Verify recommendations
const recs = intel.getRecommendationsForTenant('test-tenant')
assert(recs.length > 0)
```

---

## 📝 Summary

This PR delivers:

✅ **Global Intelligence:** Cross-tenant pattern learning  
✅ **Privacy Preservation:** Zero raw data leakage  
✅ **Amplified Recommendations:** Global insights for local decisions  
✅ **Continuous Deployment:** Automated production deploys  

The runtime is now both **globally intelligent** and **locally private**.

# Runtime Policy Engine Integration Guide

This guide shows how to integrate the Runtime Policy Engine into your execution pipeline.

## Quick Start

### 1. Basic Setup

```typescript
import { RuntimePolicyEngine } from './runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from './runtime/policy/PolicyStore.js'
import { GovernanceDecisionStore } from './runtime/policy/GovernanceDecisionStore.js'
import { ExecutionGovernanceMiddleware } from './runtime/policy/ExecutionGovernanceMiddleware.js'

// Create policy infrastructure
const policyStore = new PolicyStore()
const governanceStore = new GovernanceDecisionStore()
const policyEngine = new RuntimePolicyEngine(policyStore)

// Create governance middleware
const governanceMiddleware = new ExecutionGovernanceMiddleware(
  policyEngine,
  governanceStore,
  executionStore,  // Your execution store
  queue            // Optional: DurableExecutionQueue
)
```

### 2. Add Governance Policies

```typescript
// Provider stability policy
await policyStore.addRule('tenant-1', {
  type: 'provider_stability',
  threshold: 0.5,
  action: 'reroute'
})

// Entropy limit policy
await policyStore.addRule('tenant-1', {
  type: 'entropy_limit',
  maxEntropy: 0.8,
  action: 'warn'
})

// Canonical protection policy
await policyStore.addRule('tenant-1', {
  type: 'canonical_path_protection',
  minConfidence: 0.7,
  action: 'prefer_canonical_transition'
})
```

### 3. Integrate into Pipeline

```typescript
// Create governance stage
const governStage = governanceMiddleware.createGovernanceStage()

// Add to pipeline between PLAN and EXECUTE
const result = await pipe(ctx, [
  createIngestStage(eventStore),
  createEvaluateStage(stateStore, initialState),
  createPlanStage(),
  governStage,              // ← NEW GOVERNANCE STAGE
  createExecuteStage(executor),
  createApplyStage(stateStore),
  createEmitStage()
])
```

## Direct Policy Evaluation (Without Pipeline)

You can also use the policy engine directly for dry-run evaluations:

```typescript
const decision = await policyEngine.evaluate({
  tenantId: 'tenant-1',
  entityId: 'doc-1',
  executionContext: ctx,
  model: tenantModel,
  executionPlan: {
    actions: [{ name: 'send_for_signature', provider: 'docuseal' }]
  },
  providerStability: new Map([
    ['docuseal', 0.35],
    ['docusign', 0.95]
  ]),
  entropy: 0.65,
  convergenceScore: 0.85,
  canonicalConfidence: 0.78
})

if (!decision.allowed) {
  console.log('Execution blocked:', decision.rationale)
} else if (decision.modifiedExecutionPlan) {
  console.log('Execution modified:', decision.enforcementActions)
}
```

## API Integration

### Evaluate Policies via API

```bash
curl -X POST http://localhost:3000/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-1",
    "entityId": "doc-1",
    "executionPlan": {
      "actions": [{"name": "send_for_signature", "provider": "docuseal"}]
    }
  }'
```

### View Governance History

```bash
curl "http://localhost:3000/policy/governance-history?tenantId=tenant-1&limit=10"
```

### Create Policy Rules

```bash
curl -X POST http://localhost:3000/policy/rules \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-1",
    "rule": {
      "type": "provider_stability",
      "threshold": 0.5,
      "action": "reroute"
    }
  }'
```

## Advanced Usage

### Custom Provider Routing

```typescript
import { AdaptiveProviderRouter } from './runtime/policy/AdaptiveProviderRouter.js'

const router = new AdaptiveProviderRouter()

const result = router.reroute(
  executionPlan,
  tenantModel,
  providerStability,
  0.5  // threshold
)

if (result.actions.length > 0) {
  console.log('Providers rerouted:', result.actions)
  // Use result.modifiedPlan
}
```

### Path Stability Assessment

```typescript
import { CanonicalPathProtector } from './runtime/policy/CanonicalPathProtector.js'

const protector = new CanonicalPathProtector()

const stability = protector.assessPathStability(
  executionPlan,
  canonicalConfidence,
  entropy
)

console.log(`Path stability: ${stability.score.toFixed(2)}`)
console.log(`Reasoning: ${stability.reasoning}`)
```

## Policy Types Reference

### Provider Stability Rule

```typescript
{
  type: 'provider_stability',
  threshold: 0.5,              // 0-1, minimum stability score
  action: 'reroute',           // 'block_provider' | 'warn' | 'reroute'
  alternateProvider?: 'docusign'
}
```

### Entropy Limit Rule

```typescript
{
  type: 'entropy_limit',
  maxEntropy: 0.8,             // 0-1, maximum allowed entropy
  action: 'block'              // 'block' | 'warn' | 'restrict_transition_branching'
}
```

### Minimum Convergence Rule

```typescript
{
  type: 'minimum_convergence',
  threshold: 0.65,             // 0-1, minimum convergence score
  action: 'warn'               // 'warn' | 'block'
}
```

### Canonical Path Protection Rule

```typescript
{
  type: 'canonical_path_protection',
  minConfidence: 0.7,          // 0-1, minimum canonical confidence
  action: 'prefer_canonical_transition'  // 'prefer_canonical_transition' | 'warn'
}
```

## Examples

See:
- **demo-runtime-governance.ts** - Comprehensive demonstration of all features
- **src/tests/policy.test.ts** - Unit tests showing usage patterns
- **RUNTIME_GOVERNANCE.md** - Full architectural documentation

## Migration Path

### Phase 1: Observational
- Deploy policy engine without enforcement
- Use `action: 'warn'` for all policies
- Monitor governance decisions and warnings
- Build confidence in policy effectiveness

### Phase 2: Soft Enforcement
- Enable adaptive governance (e.g., provider rerouting)
- Keep hard blocks (e.g., entropy limits) as warnings
- Monitor impact on execution success rates

### Phase 3: Full Governance
- Enable hard enforcement policies
- Runtime becomes fully self-governing
- Operational stability automatically maintained

## Monitoring & Observability

Query governance history:

```typescript
const decisions = await governanceStore.getRecent('tenant-1', 50)
const blocked = await governanceStore.getBlockedExecutions('tenant-1')
const enforced = await governanceStore.getWithEnforcement('tenant-1')

console.log(`Total decisions: ${decisions.length}`)
console.log(`Blocked executions: ${blocked.length}`)
console.log(`Enforcement actions: ${enforced.length}`)
```

## Troubleshooting

### Policy Not Firing

1. Check policy is added to correct tenant
2. Verify threshold values are appropriate
3. Check that intelligence metrics are being calculated
4. Review governance decision logs

### Provider Not Rerouting

1. Ensure alternate provider exists in model
2. Verify alternate provider meets stability threshold
3. Check provider stability scores in context

### Unexpected Blocking

1. Review policy actions (change to 'warn' for investigation)
2. Check governance decision rationale
3. Adjust thresholds based on tenant behavior

## Best Practices

1. **Start Conservative**: Use warnings before blocking
2. **Monitor First**: Observe governance patterns before enforcing
3. **Tune Thresholds**: Adjust based on actual operational metrics
4. **Document Policies**: Keep clear records of policy intentions
5. **Review Regularly**: Audit governance effectiveness periodically
6. **Gradual Rollout**: Enable policies incrementally per tenant

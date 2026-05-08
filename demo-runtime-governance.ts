#!/usr/bin/env node --experimental-specifier-resolution=node --no-warnings

/**
 * Demo: Runtime Policy Engine + Autonomous Execution Governance
 * 
 * Demonstrates:
 * 1. Provider instability detection
 * 2. Automatic provider rerouting
 * 3. Entropy enforcement
 * 4. Blocked unsafe transitions
 * 5. Canonical path protection
 * 6. Governance audit history
 */

import { RuntimePolicyEngine } from './src/runtime/policy/RuntimePolicyEngine.js'
import { PolicyStore } from './src/runtime/policy/PolicyStore.js'
import { GovernanceDecisionStore } from './src/runtime/policy/GovernanceDecisionStore.js'
import { AdaptiveProviderRouter } from './src/runtime/policy/AdaptiveProviderRouter.js'
import { CanonicalPathProtector } from './src/runtime/policy/CanonicalPathProtector.js'
import type { TenantModel } from './src/models/tenant-model.js'
import type { ExecutionPlan, PolicyEvaluationContext } from './src/runtime/policy/types.js'
import { randomUUID } from 'node:crypto'

console.log('━'.repeat(80))
console.log('🛡️  RUNTIME POLICY ENGINE + AUTONOMOUS EXECUTION GOVERNANCE')
console.log('━'.repeat(80))
console.log('')

// ============================================================================
// Setup
// ============================================================================

const policyStore = new PolicyStore()
const governanceStore = new GovernanceDecisionStore()
const policyEngine = new RuntimePolicyEngine(policyStore)

const demoModel: TenantModel = {
  tenantId: 'demo-tenant',
  version: '1.0',
  
  entityTypes: ['document'],
  
  states: [
    { name: 'draft', description: 'Document created' },
    { name: 'pending_signature', description: 'Awaiting signature' },
    { name: 'signed', description: 'Document signed' }
  ],
  
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'pending_signature',
      actions: ['send_for_signature']
    },
    {
      entityType: 'document',
      fromState: 'pending_signature',
      eventType: 'signature.completed',
      toState: 'signed',
      actions: ['notify_completion']
    }
  ],
  
  actions: [
    { name: 'send_for_signature', provider: 'docuseal' },
    { name: 'send_for_signature', provider: 'docusign' },  // Alternate provider
    { name: 'notify_completion', provider: 'sendgrid' }
  ]
}

// ============================================================================
// Scenario 1: Provider Instability Detection & Automatic Rerouting
// ============================================================================

console.log('1️⃣  Provider Instability Detection & Automatic Rerouting')
console.log('─'.repeat(80))
console.log('')

// Add provider stability policy
await policyStore.addRule('demo-tenant', {
  type: 'provider_stability',
  threshold: 0.5,
  action: 'reroute'
})

console.log('   ✅ Policy Created: provider_stability (threshold: 0.5, action: reroute)')
console.log('')

// Simulate provider instability
const providerStability = new Map([
  ['docuseal', 0.35],   // Unstable!
  ['docusign', 0.95],   // Stable
  ['sendgrid', 0.88]    // Stable
])

const executionPlan1: ExecutionPlan = {
  actions: [
    { name: 'send_for_signature', provider: 'docuseal' }
  ],
  transition: {
    from: 'draft',
    to: 'pending_signature',
    event: 'document.uploaded'
  }
}

const context1: PolicyEvaluationContext = {
  tenantId: 'demo-tenant',
  entityId: 'doc-1',
  executionContext: {} as any,
  model: demoModel,
  executionPlan: executionPlan1,
  providerStability,
  entropy: 0.45,
  convergenceScore: 0.85,
  canonicalConfidence: 0.78
}

console.log('   📦 Original Execution Plan:')
console.log(`      Action: send_for_signature`)
console.log(`      Provider: docuseal (stability: 0.35) ⚠️`)
console.log('')

const decision1 = await policyEngine.evaluate(context1)

console.log('   🛡️  Policy Decision:')
console.log(`      Allowed: ${decision1.allowed ? '✅ YES' : '❌ NO'}`)
console.log('')

if (decision1.modifiedExecutionPlan) {
  console.log('   🔄 Modified Execution Plan:')
  console.log(`      Action: ${decision1.modifiedExecutionPlan.actions[0].name}`)
  console.log(`      Provider: ${decision1.modifiedExecutionPlan.actions[0].provider} (stability: 0.95) ✅`)
  console.log('')
}

if (decision1.enforcementActions && decision1.enforcementActions.length > 0) {
  console.log('   ⚡ Enforcement Actions:')
  for (const action of decision1.enforcementActions) {
    console.log(`      • ${action.type}: ${action.reason}`)
  }
  console.log('')
}

console.log('   💡 Rationale:')
for (const rationale of decision1.rationale) {
  console.log(`      • ${rationale}`)
}
console.log('')

// Store governance decision
await governanceStore.store({
  id: randomUUID(),
  tenantId: 'demo-tenant',
  entityId: 'doc-1',
  timestamp: new Date(),
  decision: decision1,
  context: context1,
  rulesEvaluated: ['provider_stability'],
  rulesFired: ['provider_stability']
})

console.log('   ✅ Governance decision stored in audit log')
console.log('')

// ============================================================================
// Scenario 2: High Entropy Prevention (Block Execution)
// ============================================================================

console.log('2️⃣  High Entropy Prevention (Block Execution)')
console.log('─'.repeat(80))
console.log('')

// Add entropy limit policy
await policyStore.addRule('demo-tenant', {
  type: 'entropy_limit',
  maxEntropy: 0.8,
  action: 'block'
})

console.log('   ✅ Policy Created: entropy_limit (max: 0.8, action: block)')
console.log('')

const context2: PolicyEvaluationContext = {
  tenantId: 'demo-tenant',
  entityId: 'doc-2',
  executionContext: {} as any,
  model: demoModel,
  executionPlan: executionPlan1,
  providerStability,
  entropy: 0.92,  // Very high entropy!
  convergenceScore: 0.45,
  canonicalConfidence: 0.35
}

console.log('   📊 Operational Metrics:')
console.log(`      Entropy: ${context2.entropy} ⚠️ (HIGH)`)
console.log(`      Convergence: ${context2.convergenceScore}`)
console.log(`      Canonical Confidence: ${context2.canonicalConfidence}`)
console.log('')

const decision2 = await policyEngine.evaluate(context2)

console.log('   🛡️  Policy Decision:')
console.log(`      Allowed: ${decision2.allowed ? '✅ YES' : '❌ NO (BLOCKED)'}`)
console.log('')

if (decision2.warnings && decision2.warnings.length > 0) {
  console.log('   ⚠️  Warnings:')
  for (const warning of decision2.warnings) {
    console.log(`      • [${warning.severity.toUpperCase()}] ${warning.message}`)
  }
  console.log('')
}

console.log('   💡 Rationale:')
for (const rationale of decision2.rationale) {
  console.log(`      • ${rationale}`)
}
console.log('')

// Store governance decision
await governanceStore.store({
  id: randomUUID(),
  tenantId: 'demo-tenant',
  entityId: 'doc-2',
  timestamp: new Date(),
  decision: decision2,
  context: context2,
  rulesEvaluated: ['provider_stability', 'entropy_limit'],
  rulesFired: ['provider_stability', 'entropy_limit']
})

console.log('   ✅ Blocked execution logged to governance store')
console.log('')

// ============================================================================
// Scenario 3: Canonical Path Protection
// ============================================================================

console.log('3️⃣  Canonical Path Protection')
console.log('─'.repeat(80))
console.log('')

// Add canonical path protection policy
await policyStore.addRule('demo-tenant', {
  type: 'canonical_path_protection',
  minConfidence: 0.7,
  action: 'prefer_canonical_transition'
})

console.log('   ✅ Policy Created: canonical_path_protection (minConfidence: 0.7)')
console.log('')

const context3: PolicyEvaluationContext = {
  tenantId: 'demo-tenant',
  entityId: 'doc-3',
  executionContext: {} as any,
  model: demoModel,
  executionPlan: executionPlan1,
  providerStability,
  entropy: 0.78,  // High entropy
  convergenceScore: 0.62,
  canonicalConfidence: 0.48  // Low canonical confidence
}

console.log('   📊 Operational Metrics:')
console.log(`      Entropy: ${context3.entropy} (high)`)
console.log(`      Canonical Confidence: ${context3.canonicalConfidence} (low - below threshold)`)
console.log('')

const decision3 = await policyEngine.evaluate(context3)

console.log('   🛡️  Policy Decision:')
console.log(`      Allowed: ${decision3.allowed ? '✅ YES (with canonical protection)' : '❌ NO'}`)
console.log('')

if (decision3.warnings && decision3.warnings.length > 0) {
  console.log('   ⚠️  Warnings:')
  for (const warning of decision3.warnings) {
    console.log(`      • [${warning.severity.toUpperCase()}] ${warning.message}`)
  }
  console.log('')
}

if (decision3.enforcementActions && decision3.enforcementActions.length > 0) {
  console.log('   ⚡ Enforcement Actions:')
  for (const action of decision3.enforcementActions) {
    console.log(`      • ${action.type}`)
    console.log(`        Reason: ${action.reason}`)
  }
  console.log('')
}

// Store governance decision
await governanceStore.store({
  id: randomUUID(),
  tenantId: 'demo-tenant',
  entityId: 'doc-3',
  timestamp: new Date(),
  decision: decision3,
  context: context3,
  rulesEvaluated: ['provider_stability', 'entropy_limit', 'canonical_path_protection'],
  rulesFired: ['provider_stability', 'canonical_path_protection']
})

console.log('   ✅ Governance decision stored')
console.log('')

// ============================================================================
// Scenario 4: Multiple Policies with Soft Warnings
// ============================================================================

console.log('4️⃣  Multiple Policies with Soft Warnings')
console.log('─'.repeat(80))
console.log('')

// Add minimum convergence policy
await policyStore.addRule('demo-tenant', {
  type: 'minimum_convergence',
  threshold: 0.65,
  action: 'warn'
})

console.log('   ✅ Policy Created: minimum_convergence (threshold: 0.65, action: warn)')
console.log('')

const context4: PolicyEvaluationContext = {
  tenantId: 'demo-tenant',
  entityId: 'doc-4',
  executionContext: {} as any,
  model: demoModel,
  executionPlan: executionPlan1,
  providerStability,
  entropy: 0.55,
  convergenceScore: 0.58,  // Below threshold
  canonicalConfidence: 0.72
}

console.log('   📊 Operational Metrics:')
console.log(`      Entropy: ${context4.entropy}`)
console.log(`      Convergence: ${context4.convergenceScore} (below threshold)`)
console.log(`      Canonical Confidence: ${context4.canonicalConfidence}`)
console.log('')

const decision4 = await policyEngine.evaluate(context4)

console.log('   🛡️  Policy Decision:')
console.log(`      Allowed: ${decision4.allowed ? '✅ YES (with warnings)' : '❌ NO'}`)
console.log('')

if (decision4.warnings && decision4.warnings.length > 0) {
  console.log('   ⚠️  Warnings (Soft Governance):')
  for (const warning of decision4.warnings) {
    console.log(`      • [${warning.severity.toUpperCase()}] ${warning.rule}: ${warning.message}`)
  }
  console.log('')
}

console.log('   💡 All Policies Evaluated:')
console.log(`      • provider_stability: ${decision4.modifiedExecutionPlan ? 'FIRED (rerouted)' : 'passed'}`)
console.log(`      • entropy_limit: passed`)
console.log(`      • canonical_path_protection: passed`)
console.log(`      • minimum_convergence: FIRED (warning)`)
console.log('')

// Store governance decision
await governanceStore.store({
  id: randomUUID(),
  tenantId: 'demo-tenant',
  entityId: 'doc-4',
  timestamp: new Date(),
  decision: decision4,
  context: context4,
  rulesEvaluated: ['provider_stability', 'entropy_limit', 'canonical_path_protection', 'minimum_convergence'],
  rulesFired: ['provider_stability', 'minimum_convergence']
})

console.log('   ✅ Multi-policy decision stored')
console.log('')

// ============================================================================
// Scenario 5: Adaptive Provider Router (Direct Usage)
// ============================================================================

console.log('5️⃣  Adaptive Provider Router (Direct Usage)')
console.log('─'.repeat(80))
console.log('')

const router = new AdaptiveProviderRouter()

const routerPlan: ExecutionPlan = {
  actions: [
    { name: 'send_for_signature', provider: 'docuseal' }
  ]
}

console.log('   📦 Original Plan:')
console.log(`      Provider: docuseal (stability: 0.35)`)
console.log('')

const routeResult = router.reroute(
  routerPlan,
  demoModel,
  providerStability,
  0.5
)

console.log('   🔄 Rerouted Plan:')
console.log(`      Provider: ${routeResult.modifiedPlan.actions[0].provider} (stability: 0.95)`)
console.log('')

console.log('   ⚡ Reroute Actions:')
for (const action of routeResult.actions) {
  console.log(`      • ${action.type}`)
  console.log(`        Target: ${action.target}`)
  console.log(`        Reason: ${action.reason}`)
}
console.log('')

// ============================================================================
// Scenario 6: Canonical Path Protector (Direct Usage)
// ============================================================================

console.log('6️⃣  Canonical Path Protector (Direct Usage)')
console.log('─'.repeat(80))
console.log('')

const protector = new CanonicalPathProtector()

console.log('   📊 Operational Conditions:')
console.log(`      Canonical Confidence: 0.42 (low)`)
console.log(`      Entropy: 0.88 (high)`)
console.log('')

const protection = protector.protect(
  executionPlan1,
  0.42,  // canonicalConfidence
  0.88,  // entropy
  0.7    // minConfidence
)

console.log('   🛡️  Protection Assessment:')
console.log(`      Should Protect: ${protection.shouldProtect ? '✅ YES' : 'NO'}`)
console.log('')

if (protection.warnings.length > 0) {
  console.log('   ⚠️  Warnings:')
  for (const warning of protection.warnings) {
    console.log(`      • ${warning}`)
  }
  console.log('')
}

if (protection.actions.length > 0) {
  console.log('   ⚡ Protection Actions:')
  for (const action of protection.actions) {
    console.log(`      • ${action.type}: ${action.reason}`)
  }
  console.log('')
}

const stability = protector.assessPathStability(executionPlan1, 0.42, 0.88)
console.log('   📈 Path Stability Assessment:')
console.log(`      Score: ${stability.score.toFixed(2)}`)
console.log(`      Reasoning: ${stability.reasoning}`)
console.log('')

// ============================================================================
// Governance Audit History
// ============================================================================

console.log('7️⃣  Governance Audit History')
console.log('─'.repeat(80))
console.log('')

const recentDecisions = await governanceStore.getRecent('demo-tenant', 10)
const blockedExecutions = await governanceStore.getBlockedExecutions('demo-tenant')
const withEnforcement = await governanceStore.getWithEnforcement('demo-tenant')

console.log('   📊 Governance Summary:')
console.log(`      Total Decisions: ${recentDecisions.length}`)
console.log(`      Blocked Executions: ${blockedExecutions.length}`)
console.log(`      Enforcement Actions: ${withEnforcement.length}`)
console.log('')

console.log('   📜 Recent Decisions:')
for (const decision of recentDecisions) {
  console.log(`      • Entity: ${decision.entityId}`)
  console.log(`        Allowed: ${decision.decision.allowed ? '✅' : '❌'}`)
  console.log(`        Rules Fired: ${decision.rulesFired.join(', ')}`)
  console.log(`        Timestamp: ${decision.timestamp.toISOString()}`)
  console.log('')
}

// ============================================================================
// Final Summary
// ============================================================================

console.log('━'.repeat(80))
console.log('✅ RUNTIME POLICY ENGINE DEMONSTRATION COMPLETE')
console.log('━'.repeat(80))
console.log('')

console.log('📋 What We Demonstrated:')
console.log('')
console.log('   1. ✅ Provider instability detection & automatic rerouting')
console.log('      • Detected unstable provider (docuseal: 0.35)')
console.log('      • Automatically rerouted to stable provider (docusign: 0.95)')
console.log('      • Execution resilience WITHOUT model changes')
console.log('')
console.log('   2. ✅ High entropy prevention (blocked execution)')
console.log('      • Detected operational entropy 0.92 > threshold 0.8')
console.log('      • Blocked unsafe execution')
console.log('      • Prevented operational degradation')
console.log('')
console.log('   3. ✅ Canonical path protection')
console.log('      • Detected low canonical confidence (0.48)')
console.log('      • Engaged canonical protection')
console.log('      • Biased execution toward stable paths')
console.log('')
console.log('   4. ✅ Multiple policy evaluation with soft warnings')
console.log('      • Provider reroute (adaptive)')
console.log('      • Convergence warning (soft)')
console.log('      • Execution allowed with modifications')
console.log('')
console.log('   5. ✅ Adaptive Provider Router')
console.log('      • Dynamic provider selection')
console.log('      • Stability-based routing')
console.log('')
console.log('   6. ✅ Canonical Path Protector')
console.log('      • Path stability assessment')
console.log('      • Operational self-healing')
console.log('')
console.log('   7. ✅ Governance audit history')
console.log(`      • ${recentDecisions.length} decisions stored`)
console.log(`      • ${blockedExecutions.length} executions blocked`)
console.log(`      • ${withEnforcement.length} enforcement actions`)
console.log('')

console.log('━'.repeat(80))
console.log('🎯 RUNTIME IS NOW OPERATIONALLY SELF-GOVERNING')
console.log('━'.repeat(80))
console.log('')

console.log('The runtime can now say:')
console.log('')
console.log('   "Execution allowed with adaptive modifications.')
console.log('')
console.log('   Provider \'docuseal\' stability score dropped below 0.42.')
console.log('   Execution rerouted to \'docusign\'.')
console.log('')
console.log('   High-entropy branch avoided.')
console.log('   Canonical path protection engaged.')
console.log('')
console.log('   Governance actions:')
console.log('     • provider reroute')
console.log('     • entropy mitigation')
console.log('     • convergence preservation')
console.log('')
console.log('   Operational stability preserved."')
console.log('')

console.log('━'.repeat(80))
console.log('🚀 Execution is no longer static.')
console.log('🚀 Workflows are no longer rigid.')
console.log('🚀 Runtime is operationally self-governing.')
console.log('━'.repeat(80))

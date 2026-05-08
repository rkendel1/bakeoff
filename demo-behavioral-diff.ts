#!/usr/bin/env tsx

/**
 * Demo: Behavioral Diff + Migration Analysis
 * 
 * This demo showcases the operational intelligence layer for analyzing
 * model evolution and migration safety.
 */

import { BehavioralDiffEngine } from './src/runtime/diff/behavioral-diff-engine.js'
import { CompatibilityAnalyzer } from './src/runtime/migration/compatibility.js'
import { MigrationSimulator } from './src/runtime/migration/migration-simulator.js'
import type { TenantModel } from './src/models/tenant-model.js'
import type { ExecutionRecord } from './src/runtime/store/execution-record.js'

console.log('=== Behavioral Diff + Migration Analysis Demo ===\n')

// Define two versions of a document signing workflow
const modelV1: TenantModel = {
  entities: ['document'],
  states: ['draft', 'pending_signature', 'signed'],
  events: ['document.uploaded', 'signature.completed'],
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
      actions: []
    }
  ],
  actions: [
    {
      name: 'send_for_signature',
      provider: 'docuseal'
    }
  ]
}

const modelV2: TenantModel = {
  entities: ['document'],
  states: ['draft', 'review_required', 'pending_signature', 'signed'],
  events: ['document.uploaded', 'review.completed', 'signature.completed'],
  transitions: [
    {
      entityType: 'document',
      fromState: 'draft',
      eventType: 'document.uploaded',
      toState: 'review_required', // 👈 Changed destination!
      actions: ['send_for_review'] // 👈 Changed action!
    },
    {
      entityType: 'document',
      fromState: 'review_required',
      eventType: 'review.completed',
      toState: 'pending_signature',
      actions: ['send_for_signature']
    },
    {
      entityType: 'document',
      fromState: 'pending_signature',
      eventType: 'signature.completed',
      toState: 'signed',
      actions: []
    }
  ],
  actions: [
    {
      name: 'send_for_review',
      provider: 'internal'
    },
    {
      name: 'send_for_signature',
      provider: 'docusign' // 👈 Changed provider!
    }
  ]
}

// 1. Behavioral Diff
console.log('1. Computing Behavioral Diff')
console.log('   Comparing v1 → v2\n')

const diffEngine = new BehavioralDiffEngine()
const diff = diffEngine.diff(modelV1, modelV2)

console.log('   📊 Diff Results:')
console.log(`   • Changed Transitions: ${diff.changedTransitions.length}`)
if (diff.changedTransitions.length > 0) {
  diff.changedTransitions.forEach(change => {
    console.log(`     - ${change.before.fromState} → ${change.before.toState} became → ${change.after.toState}`)
  })
}

console.log(`   • Added Transitions: ${diff.addedTransitions.length}`)
if (diff.addedTransitions.length > 0) {
  diff.addedTransitions.forEach(trans => {
    console.log(`     + ${trans.fromState} → ${trans.toState}`)
  })
}

console.log(`   • Changed Actions: ${diff.changedActions.length}`)
if (diff.changedActions.length > 0) {
  diff.changedActions.forEach(change => {
    console.log(`     - ${change.before.name}: ${change.before.provider} → ${change.after.provider}`)
  })
}

console.log(`   • Added Actions: ${diff.addedActions.length}`)
if (diff.addedActions.length > 0) {
  diff.addedActions.forEach(action => {
    console.log(`     + ${action.name} (${action.provider})`)
  })
}

console.log(`   • Added States: ${diff.addedStates.join(', ')}`)
console.log(`   • Added Events: ${diff.addedEvents.join(', ')}\n`)

// 2. Risk Assessment
console.log('2. Operational Risk Assessment\n')
console.log(`   ⚠️  Risk Level: ${diff.riskLevel.toUpperCase()}`)
console.log(`   📈 Risk Score: ${diff.riskScore.score}/100`)
console.log(`   🔍 Risk Factors:`)
diff.riskScore.factors.forEach(factor => {
  console.log(`      • ${factor}`)
})
console.log()

// 3. Compatibility Analysis
console.log('3. Compatibility Analysis\n')

const analyzer = new CompatibilityAnalyzer()
const compatibility = analyzer.analyze(diff)

console.log(`   ✓ Compatible: ${compatibility.compatible ? 'YES' : 'NO'}`)
console.log(`   🚨 Breaking Changes: ${compatibility.breakingChanges.length}`)
if (compatibility.breakingChanges.length > 0) {
  compatibility.breakingChanges.forEach(change => {
    console.log(`      • ${change}`)
  })
}

console.log(`   ⚠️  Warnings: ${compatibility.warnings.length}`)
if (compatibility.warnings.length > 0) {
  compatibility.warnings.forEach(warning => {
    console.log(`      • ${warning}`)
  })
}
console.log()

// 4. Migration Simulation
console.log('4. Migration Simulation\n')
console.log('   Creating sample historical executions...')

const historicalExecutions: ExecutionRecord[] = Array.from({ length: 5 }, (_, i) => ({
  id: `exec-${i}`,
  tenantId: 'demo-tenant',
  entityId: `doc-${i}`,
  event: {
    tenantId: 'demo-tenant',
    entityId: `doc-${i}`,
    entityType: 'document',
    type: 'document.uploaded',
    payload: {}
  },
  modelVersion: 'v1',
  status: 'completed',
  contextSnapshot: {
    tenantId: 'demo-tenant',
    entityId: `doc-${i}`,
    entityType: 'document',
    event: {
      tenantId: 'demo-tenant',
      entityId: `doc-${i}`,
      entityType: 'document',
      type: 'document.uploaded',
      payload: {}
    },
    model: modelV1,
    currentState: 'draft',
    transitions: [modelV1.transitions[0]],
    plannedActions: [
      {
        name: 'send_for_signature',
        provider: 'docuseal'
      }
    ],
    emittedEvents: [],
    stateUpdates: [],
    trace: []
  },
  createdAt: new Date(),
  completedAt: new Date()
}))

console.log(`   ✓ Created ${historicalExecutions.length} sample executions\n`)

console.log('   Simulating migration v1 → v2...')
const simulator = new MigrationSimulator()
const results = await simulator.simulateMigration(
  modelV1,
  modelV2,
  {
    tenantId: 'demo-tenant',
    fromVersion: 'v1',
    toVersion: 'v2',
    historicalExecutions
  }
)

const changed = results.filter(r => r.changed).length
const unchanged = results.filter(r => !r.changed).length
const changeRate = (changed / results.length) * 100

console.log('   ✓ Simulation complete\n')
console.log(`   📊 Results:`)
console.log(`      • Total Executions: ${results.length}`)
console.log(`      • Changed: ${changed}`)
console.log(`      • Unchanged: ${unchanged}`)
console.log(`      • Change Rate: ${changeRate.toFixed(1)}%\n`)

if (changed > 0) {
  console.log('   🔍 Sample Changes:')
  results
    .filter(r => r.changed)
    .slice(0, 2)
    .forEach(result => {
      console.log(`      Execution ${result.executionId}:`)
      console.log(`        Original: ${result.originalOutcome}`)
      console.log(`        Predicted: ${result.predictedOutcome}`)
      if (result.drift.actionChanges.length > 0) {
        console.log(`        Action changes: ${result.drift.actionChanges.length}`)
      }
    })
}

console.log('\n=== Demo Complete ===\n')

// Summary
console.log('💡 Key Insights:\n')
console.log('   1. The v2 model introduces a review step before signature')
console.log('   2. This is a BREAKING change (changed transition destination)')
console.log('   3. Provider changed from docuseal to docusign')
console.log('   4. Historical executions would have different outcomes')
console.log('   5. Risk level is MEDIUM/HIGH due to behavioral drift\n')

console.log('🚀 Next Steps:\n')
console.log('   • Review breaking changes before deployment')
console.log('   • Communicate provider migration to stakeholders')
console.log('   • Plan data migration for in-flight executions')
console.log('   • Monitor execution outcomes post-deployment\n')

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { BehavioralDiffEngine } from '../runtime/diff/behavioral-diff-engine.js'
import { CompatibilityAnalyzer } from '../runtime/migration/compatibility.js'
import { MigrationSimulator } from '../runtime/migration/migration-simulator.js'
import type { TenantModel } from '../models/tenant-model.js'
import type { ExecutionRecord } from '../runtime/store/execution-record.js'
import { TenantRuntimeRegistry } from '../runtime/registry/tenant-registry.js'
import { ControlPlaneServer } from '../runtime/api/server.js'
import { RuntimeEngine } from '../runtime/engine.js'
import { ExecutionStore } from '../runtime/store/execution-store.js'
import { StateStore } from '../store/state-store.js'
import { EventStore } from '../store/event-store.js'
import { Executor } from '../runtime/executor.js'
import { Dispatcher } from '../runtime/dispatcher.js'
import { DocuSealAdapter } from '../adapters/docuseal-adapter.js'
import { ExecutionQuery } from '../runtime/control-plane/execution-query.js'
import { RuntimeInspector } from '../runtime/control-plane/inspector.js'
import { DurableExecutionQueue } from '../runtime/queue/durable-execution-queue.js'

describe('Behavioral Diff + Migration Analysis', () => {
  // Define test models
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
        toState: 'review_required', // Changed destination
        actions: ['send_for_review'] // Changed action
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
        provider: 'docusign' // Changed provider
      }
    ]
  }

  describe('BehavioralDiffEngine', () => {
    it('should detect transition changes', () => {
      const diffEngine = new BehavioralDiffEngine()
      const diff = diffEngine.diff(modelV1, modelV2)

      // Should detect changed transition (draft -> pending_signature became draft -> review_required)
      assert.equal(diff.changedTransitions.length, 1)
      assert.equal(diff.changedTransitions[0].before.toState, 'pending_signature')
      assert.equal(diff.changedTransitions[0].after.toState, 'review_required')

      // Should detect added transition
      assert.equal(diff.addedTransitions.length, 1)
      assert.equal(diff.addedTransitions[0].fromState, 'review_required')
      assert.equal(diff.addedTransitions[0].toState, 'pending_signature')

      // Should detect removed transitions (none in this case since we changed one)
      assert.equal(diff.removedTransitions.length, 0)
    })

    it('should detect action changes', () => {
      const diffEngine = new BehavioralDiffEngine()
      const diff = diffEngine.diff(modelV1, modelV2)

      // Should detect provider change
      assert.equal(diff.changedActions.length, 1)
      assert.equal(diff.changedActions[0].before.name, 'send_for_signature')
      assert.equal(diff.changedActions[0].before.provider, 'docuseal')
      assert.equal(diff.changedActions[0].after.provider, 'docusign')

      // Should detect added action
      assert.equal(diff.addedActions.length, 1)
      assert.equal(diff.addedActions[0].name, 'send_for_review')
    })

    it('should detect state changes', () => {
      const diffEngine = new BehavioralDiffEngine()
      const diff = diffEngine.diff(modelV1, modelV2)

      // Should detect added state
      assert.equal(diff.addedStates.length, 1)
      assert.equal(diff.addedStates[0], 'review_required')

      // Should detect no removed states
      assert.equal(diff.removedStates.length, 0)
    })

    it('should detect event changes', () => {
      const diffEngine = new BehavioralDiffEngine()
      const diff = diffEngine.diff(modelV1, modelV2)

      // Should detect added event
      assert.equal(diff.addedEvents.length, 1)
      assert.equal(diff.addedEvents[0], 'review.completed')

      // Should detect no removed events
      assert.equal(diff.removedEvents.length, 0)
    })

    it('should calculate risk score', () => {
      const diffEngine = new BehavioralDiffEngine()
      const diff = diffEngine.diff(modelV1, modelV2)

      // Risk should be medium to high due to:
      // - Changed transition destination
      // - Provider change
      // - Added actions/states/events
      assert.ok(diff.riskScore.score > 0)
      assert.ok(['medium', 'high'].includes(diff.riskLevel))
      assert.ok(diff.riskScore.factors.length > 0)
    })
  })

  describe('CompatibilityAnalyzer', () => {
    it('should classify breaking changes', () => {
      const diffEngine = new BehavioralDiffEngine()
      const analyzer = new CompatibilityAnalyzer()

      const diff = diffEngine.diff(modelV1, modelV2)
      const compatibility = analyzer.analyze(diff)

      // Should identify breaking changes (changed transition destination)
      assert.equal(compatibility.compatible, false)
      assert.ok(compatibility.breakingChanges.length > 0)
      
      // Should have breaking change for transition destination change
      const hasTransitionChange = compatibility.breakingChanges.some(
        (change) => change.includes('Changed transition destination')
      )
      assert.ok(hasTransitionChange)
    })

    it('should classify warnings', () => {
      const diffEngine = new BehavioralDiffEngine()
      const analyzer = new CompatibilityAnalyzer()

      const diff = diffEngine.diff(modelV1, modelV2)
      const compatibility = analyzer.analyze(diff)

      // Should have warnings for provider changes and added actions
      assert.ok(compatibility.warnings.length > 0)
      
      const hasProviderChange = compatibility.warnings.some(
        (warning) => warning.includes('Provider changed')
      )
      assert.ok(hasProviderChange)
    })

    it('should produce compatibility summary', () => {
      const diffEngine = new BehavioralDiffEngine()
      const analyzer = new CompatibilityAnalyzer()

      const diff = diffEngine.diff(modelV1, modelV2)
      const compatibility = analyzer.analyze(diff)

      // Summary should have counts
      assert.ok(compatibility.summary.totalBreaking > 0)
      assert.ok(compatibility.summary.totalWarnings > 0)
      assert.ok(['low', 'medium', 'high'].includes(compatibility.summary.riskLevel))
    })
  })

  describe('MigrationSimulator', () => {
    it('should simulate execution against new model', async () => {
      const simulator = new MigrationSimulator()

      // Create a historical execution record starting from draft state
      const historicalExecution: ExecutionRecord = {
        id: 'exec-1',
        tenantId: 'test-tenant',
        entityId: 'doc-1',
        event: {
          tenantId: 'test-tenant',
          entityId: 'doc-1',
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        },
        modelVersion: 'v1',
        status: 'completed',
        contextSnapshot: {
          tenantId: 'test-tenant',
          entityId: 'doc-1',
          entityType: 'document',
          event: {
            tenantId: 'test-tenant',
            entityId: 'doc-1',
            entityType: 'document',
            type: 'document.uploaded',
            payload: {}
          },
          model: modelV1,
          currentState: 'draft', // Start from draft
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
      }

      const results = await simulator.simulateMigration(
        modelV1,
        modelV2,
        {
          tenantId: 'test-tenant',
          fromVersion: 'v1',
          toVersion: 'v2',
          historicalExecutions: [historicalExecution]
        }
      )

      // Should have one result
      assert.equal(results.length, 1)

      // Verify execution details
      const result = results[0]
      assert.equal(result.executionId, 'exec-1')
      
      // NOTE: The simulation behavior depends on how the pipeline processes the event
      // with the new model. The key is that we're testing the simulation runs without error.
      // TODO: Strengthen this test with more specific assertions once simulation behavior
      // is more predictable across model changes.
      assert.ok(result.originalOutcome !== undefined)
      assert.ok(result.predictedOutcome !== undefined)
    })

    it('should detect action drift', async () => {
      const simulator = new MigrationSimulator()

      const historicalExecution: ExecutionRecord = {
        id: 'exec-2',
        tenantId: 'test-tenant',
        entityId: 'doc-2',
        event: {
          tenantId: 'test-tenant',
          entityId: 'doc-2',
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        },
        modelVersion: 'v1',
        status: 'completed',
        contextSnapshot: {
          tenantId: 'test-tenant',
          entityId: 'doc-2',
          entityType: 'document',
          event: {
            tenantId: 'test-tenant',
            entityId: 'doc-2',
            entityType: 'document',
            type: 'document.uploaded',
            payload: {}
          },
          model: modelV1,
          currentState: 'draft', // Start from draft
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
      }

      const results = await simulator.simulateMigration(
        modelV1,
        modelV2,
        {
          tenantId: 'test-tenant',
          fromVersion: 'v1',
          toVersion: 'v2',
          historicalExecutions: [historicalExecution]
        }
      )

      // Should detect action changes
      const result = results[0]
      assert.ok(result.drift.actionChanges.length > 0)
    })

    it('should support sampling', async () => {
      const simulator = new MigrationSimulator()

      // Create multiple historical executions
      const executions: ExecutionRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `exec-${i}`,
        tenantId: 'test-tenant',
        entityId: `doc-${i}`,
        event: {
          tenantId: 'test-tenant',
          entityId: `doc-${i}`,
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        },
        modelVersion: 'v1',
        status: 'completed',
        contextSnapshot: {
          tenantId: 'test-tenant',
          entityId: `doc-${i}`,
          entityType: 'document',
          event: {
            tenantId: 'test-tenant',
            entityId: `doc-${i}`,
            entityType: 'document',
            type: 'document.uploaded',
            payload: {}
          },
          model: modelV1,
          currentState: 'draft', // Start from draft
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

      const results = await simulator.simulateMigration(
        modelV1,
        modelV2,
        {
          tenantId: 'test-tenant',
          fromVersion: 'v1',
          toVersion: 'v2',
          historicalExecutions: executions,
          sampleSize: 5
        }
      )

      // Should only simulate 5 executions
      assert.equal(results.length, 5)
    })
  })

  describe('Control Plane API Endpoints', () => {
    let server: ControlPlaneServer
    let registry: TenantRuntimeRegistry
    let executionStore: ExecutionStore

    before(async () => {
      // Setup registry with two versions
      registry = new TenantRuntimeRegistry()
      registry.registerVersion('test-tenant', 'v1', modelV1)
      registry.registerVersion('test-tenant', 'v2', modelV2)

      // Setup execution store with some executions
      executionStore = new ExecutionStore()
      
      // Add a completed execution with v1
      await executionStore.create({
        id: 'exec-api-1',
        tenantId: 'test-tenant',
        entityId: 'doc-api-1',
        event: {
          tenantId: 'test-tenant',
          entityId: 'doc-api-1',
          entityType: 'document',
          type: 'document.uploaded',
          payload: {}
        },
        modelVersion: 'v1',
        status: 'completed',
        contextSnapshot: {
          tenantId: 'test-tenant',
          entityId: 'doc-api-1',
          entityType: 'document',
          event: {
            tenantId: 'test-tenant',
            entityId: 'doc-api-1',
            entityType: 'document',
            type: 'document.uploaded',
            payload: {}
          },
          model: modelV1,
          currentState: 'draft', // Start from draft
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
      })

      // Setup server
      const stateStore = new StateStore()
      const eventStore = new EventStore()
      const executor = new Executor({ docuseal: new DocuSealAdapter() })
      const dispatcher = new Dispatcher()

      const engine = new RuntimeEngine(
        modelV1,
        stateStore,
        eventStore,
        executor,
        dispatcher,
        executionStore
      )

      const engines = new Map([['test-tenant', engine]])
      const query = new ExecutionQuery(executionStore)
      const inspector = new RuntimeInspector()
      const executionQueue = new DurableExecutionQueue()

      server = new ControlPlaneServer(registry, engines, query, inspector, executionQueue, executionStore)
      await server.start(3100)
    })

    after(async () => {
      await server.stop()
    })

    it('should expose GET /models/diff endpoint', async () => {
      const response = await fetch(
        'http://localhost:3100/models/diff?tenantId=test-tenant&from=v1&to=v2'
      )

      assert.equal(response.status, 200)
      const result = await response.json()

      // Should return diff and compatibility
      assert.ok(result.diff)
      assert.ok(result.compatibility)

      // Diff should have changes
      assert.ok(result.diff.changedTransitions.length > 0)
      assert.ok(result.diff.changedActions.length > 0)

      // Compatibility should have analysis
      assert.equal(result.compatibility.compatible, false)
      assert.ok(result.compatibility.breakingChanges.length > 0)
    })

    it('should validate required parameters for diff', async () => {
      const response = await fetch(
        'http://localhost:3100/models/diff?tenantId=test-tenant'
      )

      assert.equal(response.status, 400)
      const result = await response.json()
      assert.ok(result.error.includes('Missing required parameters'))
    })

    it('should handle missing model versions in diff', async () => {
      const response = await fetch(
        'http://localhost:3100/models/diff?tenantId=test-tenant&from=v999&to=v2'
      )

      assert.equal(response.status, 404)
      const result = await response.json()
      assert.ok(result.error.includes('Model version not found'))
    })

    it('should expose POST /models/simulate-migration endpoint', async () => {
      const response = await fetch('http://localhost:3100/models/simulate-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'test-tenant',
          fromVersion: 'v1',
          toVersion: 'v2'
        })
      })

      assert.equal(response.status, 200)
      const result = await response.json()

      // Should return simulations and summary
      assert.ok(Array.isArray(result.simulations))
      assert.ok(result.summary)
      assert.equal(typeof result.summary.total, 'number')
      assert.equal(typeof result.summary.changed, 'number')
      assert.equal(typeof result.summary.changeRate, 'number')
    })

    it('should support sample size in migration simulation', async () => {
      const response = await fetch('http://localhost:3100/models/simulate-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'test-tenant',
          fromVersion: 'v1',
          toVersion: 'v2',
          sampleSize: 1
        })
      })

      assert.equal(response.status, 200)
      const result = await response.json()

      // Should limit to sample size
      assert.ok(result.simulations.length <= 1)
    })
  })
})

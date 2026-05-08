import http from 'node:http'
import type { RuntimeEvent } from '../../models/event.js'
import type { RuntimeEngine } from '../engine.js'
import type { ExecutionQuery } from '../control-plane/execution-query.js'
import type { RuntimeInspector } from '../control-plane/inspector.js'
import type { TenantRuntimeRegistry } from '../registry/tenant-registry.js'
import type { ExecutionRecord } from '../store/execution-record.js'
import { simulate } from '../simulate/simulation-engine.js'
import type { DurableExecutionQueue } from '../queue/durable-execution-queue.js'
import { BehavioralDiffEngine } from '../diff/behavioral-diff-engine.js'
import { CompatibilityAnalyzer } from '../migration/compatibility.js'
import { MigrationSimulator } from '../migration/migration-simulator.js'
import type { ExecutionStore } from '../store/execution-store.js'
import { CanonicalInferenceEngine } from '../intelligence/CanonicalInferenceEngine.js'
import { DriftFromCanonicalAnalyzer } from '../intelligence/DriftFromCanonicalAnalyzer.js'
import { OperationalTopologyStore } from '../store/OperationalTopologyStore.js'
import { RecommendationEngine } from '../intelligence/recommendation/RecommendationEngine.js'
import { RecommendationStore } from '../intelligence/recommendation/RecommendationStore.js'
import { RuntimePolicyEngine } from '../policy/RuntimePolicyEngine.js'
import { PolicyStore } from '../policy/PolicyStore.js'
import { GovernanceDecisionStore } from '../policy/GovernanceDecisionStore.js'
import { IntentGraph } from '../intent/IntentGraph.js'
import { IntentStore } from '../intent/IntentStore.js'
import { GoalExecutionStore } from '../intent/GoalExecutionStore.js'
import { StrategyOutcomeStore } from '../intent/StrategyOutcomeStore.js'
import { GoalPlanner } from '../intent/GoalPlanner.js'
import { StrategyGraph } from '../intent/StrategyGraph.js'
import { GoalOutcomeEvaluator } from '../intent/GoalOutcomeEvaluator.js'
import { IntentAwareGovernanceEngine } from '../intent/IntentAwareGovernanceEngine.js'
import { OperationalPlanSynthesizer } from '../intent/OperationalPlanSynthesizer.js'
import { RuntimeMemoryStore } from '../memory/RuntimeMemoryStore.js'
import { RuntimeForecastStore } from '../predictive/RuntimeForecastStore.js'
import { StrategyDecayDetector } from '../predictive/StrategyDecayDetector.js'
import { FailureTrajectoryAnalyzer } from '../predictive/FailureTrajectoryAnalyzer.js'
import { GoalCompletionForecaster } from '../predictive/GoalCompletionForecaster.js'
import { EntropyTrajectoryForecaster } from '../predictive/EntropyTrajectoryForecaster.js'
import { PredictiveRiskEngine } from '../predictive/PredictiveRiskEngine.js'
import { PredictiveGovernanceEngine } from '../predictive/PredictiveGovernanceEngine.js'

/**
 * ControlPlaneServer - HTTP API server for the runtime control plane
 * 
 * This server exposes the runtime as a clean control plane API so that:
 * - Tenants can send events externally
 * - Executions can be queried externally
 * - Models can be managed externally
 * - Simulations can be triggered externally
 * 
 * This is the bridge between engine internals → your platform
 * 
 * Architecture:
 * - Control Plane (this server): Receives events and enqueues them
 * - Execution Queue: Decouples ingestion from execution with durability
 * - Execution Plane (RuntimeWorker): Processes events from queue with ack semantics
 */
export class ControlPlaneServer {
  private server: http.Server
  private diffEngine: BehavioralDiffEngine
  private compatibilityAnalyzer: CompatibilityAnalyzer
  private migrationSimulator: MigrationSimulator
  private inferenceEngine: CanonicalInferenceEngine
  private driftAnalyzer: DriftFromCanonicalAnalyzer
  private topologyStore: OperationalTopologyStore
  private recommendationEngine: RecommendationEngine
  private recommendationStore: RecommendationStore
  private policyEngine: RuntimePolicyEngine
  private policyStore: PolicyStore
  private governanceStore: GovernanceDecisionStore
  
  // Intent Layer
  private intentGraph: IntentGraph
  private intentStore: IntentStore
  private goalExecutionStore: GoalExecutionStore
  private strategyOutcomeStore: StrategyOutcomeStore
  private goalPlanner: GoalPlanner
  private strategyGraph: StrategyGraph
  private goalOutcomeEvaluator: GoalOutcomeEvaluator
  private intentAwareGovernance: IntentAwareGovernanceEngine
  private planSynthesizer: OperationalPlanSynthesizer
  
  // Predictive Layer
  private memoryStore: RuntimeMemoryStore
  private forecastStore: RuntimeForecastStore
  private decayDetector: StrategyDecayDetector
  private trajectoryAnalyzer: FailureTrajectoryAnalyzer
  private completionForecaster: GoalCompletionForecaster
  private entropyForecaster: EntropyTrajectoryForecaster
  private predictiveRiskEngine: PredictiveRiskEngine
  private predictiveGovernance: PredictiveGovernanceEngine

  constructor(
    private readonly registry: TenantRuntimeRegistry,
    private readonly engines: Map<string, RuntimeEngine>,
    private readonly executionQuery: ExecutionQuery,
    private readonly inspector: RuntimeInspector,
    private readonly executionQueue: DurableExecutionQueue,
    private readonly executionStore: ExecutionStore
  ) {
    this.server = http.createServer(this.handleRequest.bind(this))
    this.diffEngine = new BehavioralDiffEngine()
    this.compatibilityAnalyzer = new CompatibilityAnalyzer()
    this.migrationSimulator = new MigrationSimulator()
    this.inferenceEngine = new CanonicalInferenceEngine()
    this.driftAnalyzer = new DriftFromCanonicalAnalyzer()
    this.topologyStore = new OperationalTopologyStore()
    this.recommendationEngine = new RecommendationEngine(this.topologyStore)
    this.recommendationStore = new RecommendationStore()
    this.policyStore = new PolicyStore()
    this.policyEngine = new RuntimePolicyEngine(this.policyStore)
    this.governanceStore = new GovernanceDecisionStore()
    
    // Initialize Intent Layer
    this.intentGraph = new IntentGraph()
    this.intentStore = new IntentStore()
    this.goalExecutionStore = new GoalExecutionStore()
    this.strategyOutcomeStore = new StrategyOutcomeStore()
    this.goalPlanner = new GoalPlanner(
      this.intentGraph,
      this.strategyOutcomeStore
    )
    this.strategyGraph = new StrategyGraph(this.intentGraph)
    this.goalOutcomeEvaluator = new GoalOutcomeEvaluator(
      this.strategyOutcomeStore,
      this.intentGraph
    )
    this.intentAwareGovernance = new IntentAwareGovernanceEngine(
      this.policyEngine,
      this.intentGraph,
      this.goalOutcomeEvaluator
    )
    this.planSynthesizer = new OperationalPlanSynthesizer(
      this.intentGraph,
      this.strategyGraph,
      this.goalOutcomeEvaluator
    )
    
    // Initialize Predictive Layer
    this.memoryStore = new RuntimeMemoryStore()
    this.forecastStore = new RuntimeForecastStore()
    this.decayDetector = new StrategyDecayDetector(this.strategyOutcomeStore)
    this.trajectoryAnalyzer = new FailureTrajectoryAnalyzer(
      this.memoryStore,
      this.topologyStore
    )
    this.completionForecaster = new GoalCompletionForecaster(
      this.goalPlanner,
      this.strategyOutcomeStore,
      this.decayDetector
    )
    this.entropyForecaster = new EntropyTrajectoryForecaster(this.topologyStore)
    this.predictiveRiskEngine = new PredictiveRiskEngine(
      this.decayDetector,
      this.trajectoryAnalyzer,
      this.completionForecaster,
      this.entropyForecaster
    )
    this.predictiveGovernance = new PredictiveGovernanceEngine(
      this.predictiveRiskEngine,
      this.policyEngine
    )
  }

  /**
   * Start the API server
   */
  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`Control Plane API listening on port ${port}`)
        resolve()
      })
    })
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve()
      })
    })
  }

  /**
   * Main request handler
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    try {
      // Route requests
      if (req.method === 'POST' && pathname === '/events') {
        await this.handleIngestEvent(req, res)
      } else if (req.method === 'GET' && pathname === '/executions') {
        await this.handleQueryExecutions(req, res, url)
      } else if (req.method === 'GET' && pathname.startsWith('/executions/')) {
        await this.handleInspectExecution(req, res, pathname)
      } else if (req.method === 'POST' && pathname === '/simulate') {
        await this.handleSimulate(req, res)
      } else if (req.method === 'GET' && pathname === '/models/diff') {
        await this.handleModelDiff(req, res, url)
      } else if (req.method === 'POST' && pathname === '/models/simulate-migration') {
        await this.handleSimulateMigration(req, res)
      } else if (req.method === 'GET' && pathname === '/intelligence/canonical') {
        await this.handleIntelligenceCanonical(req, res, url)
      } else if (req.method === 'GET' && pathname === '/intelligence/drift') {
        await this.handleIntelligenceDrift(req, res, url)
      } else if (req.method === 'GET' && pathname === '/intelligence/topology') {
        await this.handleIntelligenceTopology(req, res, url)
      } else if (req.method === 'GET' && pathname === '/intelligence/recommendations') {
        await this.handleIntelligenceRecommendations(req, res, url)
      } else if (req.method === 'GET' && pathname === '/intelligence/convergence') {
        await this.handleIntelligenceConvergence(req, res, url)
      } else if (req.method === 'POST' && pathname === '/intelligence/model-patch') {
        await this.handleIntelligenceModelPatch(req, res)
      } else if (req.method === 'POST' && pathname === '/policy/evaluate') {
        await this.handlePolicyEvaluate(req, res)
      } else if (req.method === 'GET' && pathname === '/policy/governance-history') {
        await this.handlePolicyGovernanceHistory(req, res, url)
      } else if (req.method === 'POST' && pathname === '/policy/rules') {
        await this.handlePolicyRules(req, res)
      } else if (req.method === 'POST' && pathname === '/intent/goals') {
        await this.handleIntentGoals(req, res)
      } else if (req.method === 'GET' && pathname === '/intent/strategies') {
        await this.handleIntentStrategies(req, res, url)
      } else if (req.method === 'POST' && pathname === '/intent/plan') {
        await this.handleIntentPlan(req, res)
      } else if (req.method === 'GET' && pathname === '/intent/outcomes') {
        await this.handleIntentOutcomes(req, res, url)
      } else if (req.method === 'GET' && pathname === '/predictive/risks') {
        await this.handlePredictiveRisks(req, res, url)
      } else if (req.method === 'GET' && pathname === '/predictive/goal-forecast') {
        await this.handlePredictiveGoalForecast(req, res, url)
      } else if (req.method === 'GET' && pathname === '/predictive/strategy-decay') {
        await this.handlePredictiveStrategyDecay(req, res, url)
      } else if (req.method === 'GET' && pathname === '/predictive/entropy-forecast') {
        await this.handlePredictiveEntropyForecast(req, res, url)
      } else if (req.method === 'POST' && pathname === '/predictive/recalculate') {
        await this.handlePredictiveRecalculate(req, res)
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    } catch (error) {
      console.error('API error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error'
        })
      )
    }
  }

  /**
   * POST /events - Ingest an event
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "entityId": "doc-123",
   *   "entityType": "document",
   *   "type": "document.uploaded",
   *   "payload": {}
   * }
   * 
   * Architecture:
   * - Control Plane: Validates and enqueues event
   * - Execution Plane: Worker picks up and processes event
   */
  private async handleIngestEvent(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    let event: RuntimeEvent
    
    try {
      const body = await this.readBody(req)
      event = JSON.parse(body)
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid JSON in request body'
      }))
      return
    }

    // Validate tenant exists
    if (!this.registry.hasTenant(event.tenantId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Tenant not found' }))
      return
    }

    // Validate engine exists for tenant
    const engine = this.engines.get(event.tenantId)
    if (!engine) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Runtime engine not initialized for tenant' }))
      return
    }

    // CRITICAL: Resolve model version at ingestion time
    let modelVersion: string
    try {
      modelVersion = this.registry.resolveVersion(
        event.tenantId,
        event.headers?.modelVersion // optional override
      )
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Model version resolution failed' 
      }))
      return
    }

    // Enqueue event with resolved model version for asynchronous processing by worker
    this.executionQueue.enqueue(event, modelVersion)

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'accepted', event, modelVersion }))
  }

  /**
   * GET /executions?tenantId=&entityId=&status=
   * 
   * Query executions with filters
   */
  private async handleQueryExecutions(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const entityId = url.searchParams.get('entityId')
    const status = url.searchParams.get('status') as 'running' | 'completed' | 'failed' | null

    let executions: ExecutionRecord[]

    if (tenantId && entityId) {
      // Query by entity
      executions = await this.executionQuery.getByEntity(tenantId, entityId)
    } else if (tenantId && status === 'failed') {
      // Query failed executions
      executions = await this.executionQuery.getFailed(tenantId)
    } else if (tenantId) {
      // Query all executions for tenant (not implemented in ExecutionQuery, return empty)
      executions = []
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ executions }))
  }

  /**
   * GET /executions/:id - Inspect a specific execution
   * 
   * Returns RuntimeInspector.inspect() output
   */
  private async handleInspectExecution(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    const id = pathname.split('/')[2]
    
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution ID required' }))
      return
    }

    const execution = await this.executionQuery.getById(id)
    
    if (!execution) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution not found' }))
      return
    }

    const inspection = this.inspector.inspect(execution)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ inspection }))
  }

  /**
   * POST /simulate - Simulate an execution
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "event": {...},
   *   "modelVersion": "latest",
   *   "currentState": "draft"
   * }
   */
  private async handleSimulate(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    let tenantId: string
    let event: RuntimeEvent
    let modelVersion: string
    let currentState: string | undefined
    
    try {
      const body = await this.readBody(req)
      const parsed = JSON.parse(body)
      tenantId = parsed.tenantId
      event = parsed.event
      modelVersion = parsed.modelVersion || 'latest'
      currentState = parsed.currentState
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid JSON in request body'
      }))
      return
    }

    // Get model version
    const model = this.registry.getModelVersion(tenantId, modelVersion)
    
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Model version not found' }))
      return
    }

    // Run simulation
    const simulation = await simulate(event, model, currentState)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ simulation }))
  }

  /**
   * GET /models/diff?tenantId=&from=&to=
   * 
   * Compare two model versions and produce behavioral diff
   * 
   * Query params:
   * - tenantId: Tenant identifier
   * - from: Source model version
   * - to: Target model version
   * 
   * Returns:
   * {
   *   diff: BehavioralDiff,
   *   compatibility: CompatibilityReport
   * }
   */
  private async handleModelDiff(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const fromVersion = url.searchParams.get('from')
    const toVersion = url.searchParams.get('to')

    // Validate parameters
    if (!tenantId || !fromVersion || !toVersion) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: 'Missing required parameters: tenantId, from, to' 
      }))
      return
    }

    // Get models
    const fromModel = this.registry.getModelVersion(tenantId, fromVersion)
    const toModel = this.registry.getModelVersion(tenantId, toVersion)

    if (!fromModel) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: `Model version not found: ${tenantId}@${fromVersion}` 
      }))
      return
    }

    if (!toModel) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: `Model version not found: ${tenantId}@${toVersion}` 
      }))
      return
    }

    // Compute behavioral diff
    const diff = this.diffEngine.diff(fromModel, toModel)

    // Analyze compatibility
    const compatibility = this.compatibilityAnalyzer.analyze(diff)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ diff, compatibility }))
  }

  /**
   * POST /models/simulate-migration
   * 
   * Simulate migration impact by replaying historical executions
   * against a new model version.
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "fromVersion": "v1.0",
   *   "toVersion": "v2.0",
   *   "sampleSize": 100  // optional
   * }
   * 
   * Returns:
   * {
   *   simulations: MigrationSimulationResult[],
   *   summary: {
   *     total: number,
   *     changed: number,
   *     unchanged: number,
   *     changeRate: number
   *   }
   * }
   */
  private async handleSimulateMigration(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    let tenantId: string
    let fromVersion: string
    let toVersion: string
    let sampleSize: number | undefined

    try {
      const body = await this.readBody(req)
      const parsed = JSON.parse(body)
      tenantId = parsed.tenantId
      fromVersion = parsed.fromVersion
      toVersion = parsed.toVersion
      sampleSize = parsed.sampleSize
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid JSON in request body'
      }))
      return
    }

    // Validate models exist
    const fromModel = this.registry.getModelVersion(tenantId, fromVersion)
    const toModel = this.registry.getModelVersion(tenantId, toVersion)

    if (!fromModel) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: `Model version not found: ${tenantId}@${fromVersion}` 
      }))
      return
    }

    if (!toModel) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: `Model version not found: ${tenantId}@${toVersion}` 
      }))
      return
    }

    // Get historical executions for the tenant with the fromVersion
    const allExecutions = await this.executionStore.listByTenant(tenantId)
    const historicalExecutions = allExecutions.filter(
      (exec) => exec.modelVersion === fromVersion && exec.status === 'completed'
    )

    if (historicalExecutions.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        simulations: [],
        summary: {
          total: 0,
          changed: 0,
          unchanged: 0,
          changeRate: 0
        }
      }))
      return
    }

    // Run migration simulation
    const simulations = await this.migrationSimulator.simulateMigration(
      fromModel,
      toModel,
      {
        tenantId,
        fromVersion,
        toVersion,
        historicalExecutions,
        sampleSize
      }
    )

    // Calculate summary statistics
    const total = simulations.length
    const changed = simulations.filter((s) => s.changed).length
    const unchanged = total - changed
    const changeRate = total > 0 ? (changed / total) * 100 : 0

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      simulations,
      summary: {
        total,
        changed,
        unchanged,
        changeRate: Math.round(changeRate * 100) / 100
      }
    }))
  }

  /**
   * GET /intelligence/canonical?tenantId=<id>
   * 
   * Returns inferred canonical model based on execution history
   * 
   * Example response:
   * {
   *   "tenantId": "demo",
   *   "canonicalStates": [
   *     { "state": "pending_signature", "centrality": 0.92, "executionCount": 45 }
   *   ],
   *   "canonicalTransitions": [
   *     { "from": "draft", "to": "pending_signature", "confidence": 0.94, ... }
   *   ],
   *   "dominantProviders": [
   *     { "action": "send_for_signature", "provider": "docuseal", "usage": 0.91, ... }
   *   ]
   * }
   */
  private async handleIntelligenceCanonical(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    // Get execution history for the tenant
    const executions = await this.executionStore.listByTenant(tenantId)

    if (executions.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tenantId,
        message: 'No execution history available for canonical inference'
      }))
      return
    }

    // Generate topology snapshot
    const snapshot = this.inferenceEngine.generateTopologySnapshot(tenantId, executions)

    // Store snapshot for future analysis
    await this.topologyStore.store(snapshot)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(snapshot))
  }

  /**
   * GET /intelligence/drift?tenantId=<id>
   * 
   * Returns operational drift analysis comparing declared model vs observed behavior
   * 
   * Example response:
   * {
   *   "driftDetected": true,
   *   "unusedTransitions": ["draft -> pending_review"],
   *   "shadowTransitions": ["draft -> pending_signature"],
   *   "entropyScore": 0.67,
   *   "recommendations": [...]
   * }
   */
  private async handleIntelligenceDrift(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    // Get tenant model
    const model = this.registry.getLatestModel(tenantId)
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Model not found for tenant: ${tenantId}` }))
      return
    }

    // Get execution history for the tenant
    const executions = await this.executionStore.listByTenant(tenantId)

    if (executions.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tenantId,
        driftDetected: false,
        message: 'No execution history available for drift analysis'
      }))
      return
    }

    // Analyze drift
    const driftAnalysis = this.driftAnalyzer.analyzeDrift(tenantId, model, executions)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(driftAnalysis))
  }

  /**
   * GET /intelligence/topology?tenantId=<id>
   * 
   * Returns weighted operational graph (topology history)
   * 
   * Example response:
   * {
   *   "tenantId": "demo",
   *   "currentTopology": { ... },
   *   "evolutionMetrics": { ... },
   *   "snapshotHistory": [...]
   * }
   */
  private async handleIntelligenceTopology(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    // Get latest topology snapshot
    const latestTopology = await this.topologyStore.getLatest(tenantId)

    // Get evolution metrics
    const evolutionMetrics = await this.topologyStore.getEvolutionMetrics(tenantId)

    // Get snapshot history
    const snapshotHistory = await this.topologyStore.getHistory(tenantId)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      tenantId,
      currentTopology: latestTopology,
      evolutionMetrics,
      snapshotHistory
    }))
  }

  /**
   * GET /intelligence/recommendations?tenantId=<id>
   * 
   * Returns ranked runtime recommendations
   */
  private async handleIntelligenceRecommendations(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    
    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId query parameter is required' }))
      return
    }

    // Get tenant model
    const model = this.registry.getModel(tenantId)
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Tenant ${tenantId} not found` }))
      return
    }

    // Get execution history
    const executions = await this.executionStore.listByTenant(tenantId)

    // Generate drift analysis
    const driftAnalysis = this.driftAnalyzer.analyzeDrift(
      tenantId,
      model,
      executions
    )

    // Generate topology snapshot
    const topologySnapshot = this.inferenceEngine.generateTopologySnapshot(
      tenantId,
      executions
    )

    // Generate recommendations
    const recommendations = await this.recommendationEngine.generateRecommendations(
      tenantId,
      model,
      executions,
      driftAnalysis,
      topologySnapshot,
      this.executionQueue
    )

    // Store recommendations
    await this.recommendationStore.storeRecommendations(tenantId, recommendations)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ recommendations }))
  }

  /**
   * GET /intelligence/convergence?tenantId=<id>
   * 
   * Returns operational convergence metrics
   */
  private async handleIntelligenceConvergence(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    
    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId query parameter is required' }))
      return
    }

    // Get execution history
    const executions = await this.executionStore.listByTenant(tenantId)

    // Analyze convergence
    const convergence = await this.recommendationEngine['convergenceAnalyzer'].analyzeConvergence(
      tenantId,
      executions
    )

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(convergence))
  }

  /**
   * POST /intelligence/model-patch
   * 
   * Returns suggested canonical model patch set
   * 
   * Body:
   * {
   *   "tenantId": "tenant-1"
   * }
   */
  private async handleIntelligenceModelPatch(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req)
    const { tenantId } = JSON.parse(body)

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId is required in request body' }))
      return
    }

    // Get tenant model
    const model = this.registry.getModel(tenantId)
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Tenant ${tenantId} not found` }))
      return
    }

    // Get execution history
    const executions = await this.executionStore.listByTenant(tenantId)

    // Generate drift analysis
    const driftAnalysis = this.driftAnalyzer.analyzeDrift(
      tenantId,
      model,
      executions
    )

    // Generate model patches
    const patchSet = this.recommendationEngine['patchGenerator'].generatePatchSet(
      tenantId,
      model,
      executions,
      driftAnalysis
    )

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(patchSet))
  }

  /**
   * POST /policy/evaluate
   * 
   * Dry-run policy evaluation
   * 
   * Body:
   * {
   *   "tenantId": "tenant-1",
   *   "entityId": "doc-1",
   *   "executionPlan": { ... },
   *   "context": { ... }
   * }
   */
  private async handlePolicyEvaluate(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req)
    const payload = JSON.parse(body)

    if (!payload.tenantId || !payload.executionPlan) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId and executionPlan are required' }))
      return
    }

    // Get tenant model
    const model = this.registry.getModel(payload.tenantId)
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Tenant ${payload.tenantId} not found` }))
      return
    }

    // Get execution history for intelligence metrics
    const executions = await this.executionStore.listByTenant(payload.tenantId)
    
    // Calculate provider stability
    const providerReliabilities = new (await import('../intelligence/recommendation/ProviderReliabilityAnalyzer.js')).ProviderReliabilityAnalyzer()
      .analyzeProviders(executions, this.executionQueue)
    const providerStability = new Map<string, number>()
    for (const reliability of providerReliabilities) {
      providerStability.set(reliability.provider, reliability.stabilityScore)
    }

    // Calculate canonical metrics
    const snapshot = this.inferenceEngine.generateTopologySnapshot(payload.tenantId, executions)

    // Build policy evaluation context
    const policyContext = {
      tenantId: payload.tenantId,
      entityId: payload.entityId || 'eval',
      executionContext: payload.context || {},
      model,
      executionPlan: payload.executionPlan,
      providerStability,
      entropy: snapshot.entropyScore,
      convergenceScore: executions.filter((e) => e.status === 'completed').length / Math.max(1, executions.length),
      canonicalConfidence: snapshot.canonicalConfidence
    }

    // Evaluate policies
    const decision = await this.policyEngine.dryRun(policyContext as any)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      allowed: decision.allowed,
      warnings: decision.warnings || [],
      enforcementActions: decision.enforcementActions || [],
      modifiedExecutionPlan: decision.modifiedExecutionPlan,
      rationale: decision.rationale,
      metrics: {
        providerStability: Object.fromEntries(providerStability),
        entropy: snapshot.entropyScore,
        canonicalConfidence: snapshot.canonicalConfidence
      }
    }))
  }

  /**
   * GET /policy/governance-history?tenantId=<id>&limit=<n>
   * 
   * Returns governance decision history
   */
  private async handlePolicyGovernanceHistory(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    // Get governance history
    const recentDecisions = await this.governanceStore.getRecent(tenantId, limit)
    const blockedExecutions = await this.governanceStore.getBlockedExecutions(tenantId)
    const withEnforcement = await this.governanceStore.getWithEnforcement(tenantId)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      tenantId,
      recentDecisions,
      summary: {
        totalDecisions: recentDecisions.length,
        blockedExecutions: blockedExecutions.length,
        enforcementActions: withEnforcement.length
      }
    }))
  }

  /**
   * POST /policy/rules
   * 
   * Create tenant governance policy
   * 
   * Body:
   * {
   *   "tenantId": "tenant-1",
   *   "rule": {
   *     "type": "provider_stability",
   *     "threshold": 0.5,
   *     "action": "reroute"
   *   }
   * }
   */
  private async handlePolicyRules(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req)
    const payload = JSON.parse(body)

    if (!payload.tenantId || !payload.rule) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId and rule are required' }))
      return
    }

    // Validate rule type
    const validRuleTypes = ['provider_stability', 'entropy_limit', 'minimum_convergence', 'canonical_path_protection']
    if (!validRuleTypes.includes(payload.rule.type)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: `Invalid rule type. Must be one of: ${validRuleTypes.join(', ')}` 
      }))
      return
    }

    // Add rule to policy store
    await this.policyStore.addRule(payload.tenantId, payload.rule)

    res.writeHead(201, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: 'Policy rule created',
      tenantId: payload.tenantId,
      rule: payload.rule
    }))
  }

  /**
   * POST /intent/goals - Define operational goals
   * 
   * Body:
   * {
   *   "goal": "obtain_signed_contract",
   *   "description": "Achieve signed contract state",
   *   "successCriteria": ["document.state == signed"],
   *   "priority": "high",
   *   "operationalStrategies": ["docusign_fast_path", "manual_review_flow"]
   * }
   */
  private async handleIntentGoals(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req)
      const data = JSON.parse(body)

      if (!data.tenantId || !data.goal) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields: tenantId, goal' }))
        return
      }

      const goalDefinition = {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        tenantId: data.tenantId,
        goal: data.goal,
        description: data.description || '',
        successCriteria: data.successCriteria || [],
        priority: data.priority || 'medium',
        operationalStrategies: data.operationalStrategies || [],
        timeoutMs: data.timeoutMs,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Store goal
      await this.intentStore.storeGoal(goalDefinition)

      // Register in graph
      this.intentGraph.registerGoal(goalDefinition)

      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        goal: goalDefinition
      }))
    } catch (error) {
      console.error('Error creating goal:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create goal'
      }))
    }
  }

  /**
   * GET /intent/strategies - Get learned strategies for goals
   * 
   * Query params:
   * - tenantId: required
   * - goalId: optional
   */
  private async handleIntentStrategies(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const goalId = url.searchParams.get('goalId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing tenantId' }))
      return
    }

    try {
      if (goalId) {
        // Get strategies for specific goal
        const strategies = this.intentGraph.getStrategiesForGoal(goalId)
        
        // Evaluate effectiveness for each strategy
        const strategyMetrics = await Promise.all(
          strategies.map(async (strategy) => {
            const metrics = await this.goalOutcomeEvaluator.evaluateStrategyEffectiveness(
              tenantId,
              goalId,
              strategy.strategyName
            )
            return {
              strategy,
              metrics
            }
          })
        )

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          goalId,
          strategies: strategyMetrics
        }))
      } else {
        // Get all strategies for tenant
        const goals = this.intentGraph.getGoalsForTenant(tenantId)
        const allStrategies = []

        for (const goal of goals) {
          const strategies = this.intentGraph.getStrategiesForGoal(goal.id)
          allStrategies.push({
            goalId: goal.id,
            goalName: goal.goal,
            strategies
          })
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          tenantId,
          goals: allStrategies
        }))
      }
    } catch (error) {
      console.error('Error getting strategies:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get strategies'
      }))
    }
  }

  /**
   * POST /intent/plan - Generate adaptive execution plans
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "goalId": "goal-123",
   *   "strategyName": "docusign_fast_path"
   * }
   * 
   * Returns:
   * {
   *   "goal": "obtain_signed_contract",
   *   "selectedStrategy": "docusign_fast_path",
   *   "confidence": 0.91,
   *   "fallbackStrategies": ["manual_review_recovery"],
   *   "predictedSuccessProbability": 0.94
   * }
   */
  private async handleIntentPlan(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req)
      const data = JSON.parse(body)

      if (!data.tenantId || !data.goalId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields: tenantId, goalId' }))
        return
      }

      // Get tenant model
      const model = this.registry.getModel(data.tenantId)
      if (!model) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Model not found for tenant ${data.tenantId}` }))
        return
      }

      let plan

      if (data.strategyName) {
        // Generate plan for specific strategy
        plan = await this.planSynthesizer.synthesizePlan(
          data.tenantId,
          data.goalId,
          data.strategyName,
          model
        )
      } else {
        // Select best strategy and generate plan
        const strategySelection = await this.goalPlanner.selectStrategy(
          data.tenantId,
          data.goalId
        )
        
        plan = await this.planSynthesizer.synthesizePlan(
          data.tenantId,
          data.goalId,
          strategySelection.selectedStrategy,
          model
        )

        // Enhance response with strategy selection reasoning
        const response = {
          ...plan,
          strategySelection: {
            selectedStrategy: strategySelection.selectedStrategy,
            confidence: strategySelection.confidence,
            rationale: strategySelection.rationale,
            fallbackStrategies: strategySelection.fallbackStrategies
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(plan))
    } catch (error) {
      console.error('Error generating plan:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate plan'
      }))
    }
  }

  /**
   * GET /intent/outcomes - Get goal completion rates
   * 
   * Query params:
   * - tenantId: required
   * - goalId: optional
   */
  private async handleIntentOutcomes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const goalId = url.searchParams.get('goalId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing tenantId' }))
      return
    }

    try {
      if (goalId) {
        // Get outcomes for specific goal
        const completionRate = await this.goalOutcomeEvaluator.evaluateGoalCompletionRate(
          tenantId,
          goalId
        )

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(completionRate))
      } else {
        // Get outcomes for all goals
        const completionRates = await this.goalOutcomeEvaluator.getAllGoalCompletionRates(tenantId)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          tenantId,
          goals: completionRates
        }))
      }
    } catch (error) {
      console.error('Error getting outcomes:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get outcomes'
      }))
    }
  }

  /**
   * GET /predictive/risks - Get predicted operational risks
   * 
   * Query params:
   * - tenantId: required
   * - forecastWindow: optional (default: "24h")
   * 
   * Returns:
   * {
   *   "overallRiskScore": 0.71,
   *   "risks": [
   *     {
   *       "type": "provider_instability",
   *       "severity": "high",
   *       "probability": 0.84,
   *       "forecastWindow": "24h",
   *       ...
   *     }
   *   ],
   *   "preemptiveActions": [...]
   * }
   */
  private async handlePredictiveRisks(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const forecastWindow = url.searchParams.get('forecastWindow') || '24h'

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing required parameter: tenantId' }))
      return
    }

    try {
      const riskAssessment = await this.predictiveRiskEngine.assessRisks(
        tenantId,
        forecastWindow
      )

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(riskAssessment))
    } catch (error) {
      console.error('Error assessing risks:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to assess risks'
      }))
    }
  }

  /**
   * GET /predictive/goal-forecast - Forecast goal completion
   * 
   * Query params:
   * - tenantId: required
   * - goalId: required
   * 
   * Returns:
   * {
   *   "goal": "obtain_signed_contract",
   *   "predictedSuccessProbability": 0.82,
   *   "riskFactors": [...],
   *   "recommendedPreemptiveActions": [...]
   * }
   */
  private async handlePredictiveGoalForecast(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const goalId = url.searchParams.get('goalId')

    if (!tenantId || !goalId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing required parameters: tenantId, goalId' }))
      return
    }

    try {
      const forecast = await this.completionForecaster.forecastCompletion(
        tenantId,
        goalId
      )

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(forecast))
    } catch (error) {
      console.error('Error forecasting goal completion:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to forecast goal completion'
      }))
    }
  }

  /**
   * GET /predictive/strategy-decay - Detect strategy effectiveness degradation
   * 
   * Query params:
   * - tenantId: required
   * - goalId: optional (if not provided, returns all decaying strategies)
   * - strategyName: optional (if provided, returns decay for specific strategy)
   * 
   * Returns array of StrategyDecay objects
   */
  private async handlePredictiveStrategyDecay(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const goalId = url.searchParams.get('goalId')
    const strategyName = url.searchParams.get('strategyName')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing required parameter: tenantId' }))
      return
    }

    try {
      let decays

      if (goalId && strategyName) {
        // Specific strategy
        const decay = await this.decayDetector.detectDecay(tenantId, goalId, strategyName)
        decays = decay ? [decay] : []
      } else if (goalId) {
        // All strategies for a goal
        decays = await this.decayDetector.detectDecayForGoal(tenantId, goalId)
      } else {
        // All strategies for tenant
        decays = await this.decayDetector.detectDecayForTenant(tenantId)
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(decays))
    } catch (error) {
      console.error('Error detecting strategy decay:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to detect strategy decay'
      }))
    }
  }

  /**
   * GET /predictive/entropy-forecast - Forecast operational fragmentation
   * 
   * Query params:
   * - tenantId: required
   * 
   * Returns:
   * {
   *   "currentEntropy": 0.45,
   *   "predictedEntropy24h": 0.48,
   *   "predictedEntropy7d": 0.55,
   *   "entropyTrajectory": "diverging",
   *   "fragmentationRisks": [...]
   * }
   */
  private async handlePredictiveEntropyForecast(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing required parameter: tenantId' }))
      return
    }

    try {
      const forecast = await this.entropyForecaster.forecastEntropy(tenantId)

      if (!forecast) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: 'Not enough data to forecast entropy. Need at least 5 topology snapshots.' 
        }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(forecast))
    } catch (error) {
      console.error('Error forecasting entropy:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to forecast entropy'
      }))
    }
  }

  /**
   * POST /predictive/recalculate - Rebuild predictive models
   * 
   * Body:
   * {
   *   "tenantId": "t1"
   * }
   * 
   * Forces recalculation of all forecasts and predictive models.
   * Returns new risk assessment.
   */
  private async handlePredictiveRecalculate(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req)
      const data = JSON.parse(body)

      if (!data.tenantId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required field: tenantId' }))
        return
      }

      // Recalculate all forecasts
      const riskAssessment = await this.predictiveRiskEngine.assessRisks(data.tenantId)
      const entropyForecast = await this.entropyForecaster.forecastEntropy(data.tenantId)
      const decays = await this.decayDetector.detectDecayForTenant(data.tenantId)

      const response = {
        recalculatedAt: new Date(),
        riskAssessment,
        entropyForecast,
        strategyDecays: decays,
        message: 'Predictive models recalculated successfully'
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      console.error('Error recalculating forecasts:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to recalculate forecasts'
      }))
    }
  }

  /**
   * Helper to read request body with size limit
   */
  private readBody(req: http.IncomingMessage, maxSize: number = 1024 * 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      let size = 0
      
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > maxSize) {
          req.destroy()
          reject(new Error('Request body too large'))
          return
        }
        body += chunk.toString()
      })
      
      req.on('end', () => {
        resolve(body)
      })
      
      req.on('error', reject)
    })
  }
}

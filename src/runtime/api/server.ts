import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
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
import { ForecastOutcomeStore } from '../predictive/calibration/ForecastOutcomeStore.js'
import { CalibrationStore } from '../predictive/calibration/CalibrationStore.js'
import { PredictionAccuracyStore } from '../predictive/calibration/PredictionAccuracyStore.js'
import { ForecastOutcomeTracker } from '../predictive/calibration/ForecastOutcomeTracker.js'
import { PredictionAccuracyAnalyzer } from '../predictive/calibration/PredictionAccuracyAnalyzer.js'
import { AdaptiveConfidenceScaler } from '../predictive/calibration/AdaptiveConfidenceScaler.js'
import { PredictionDriftDetector } from '../predictive/calibration/PredictionDriftDetector.js'
import { SelfHealingForecastAdjuster } from '../predictive/calibration/SelfHealingForecastAdjuster.js'
import { ForecastCalibrationEngine } from '../predictive/calibration/ForecastCalibrationEngine.js'
import { DecisionCalibrationStore } from '../predictive/decision/DecisionCalibrationStore.js'
import { StrategyBiasStore } from '../predictive/decision/StrategyBiasStore.js'
import { PlanRewriteAuditStore } from '../predictive/decision/PlanRewriteAuditStore.js'
import { RealTimeCalibrationContextBuilder } from '../predictive/decision/RealTimeCalibrationContextBuilder.js'
import { CalibrationAwareRiskEngineWrapper } from '../predictive/decision/CalibrationAwareRiskEngineWrapper.js'
import { StrategyBiasInjector } from '../predictive/decision/StrategyBiasInjector.js'
import { DecisionTimeCalibrationEngine } from '../predictive/decision/DecisionTimeCalibrationEngine.js'
import { ExecutionPlanRewriter } from '../predictive/decision/ExecutionPlanRewriter.js'
import { RuntimeCoreContractHandler } from './contract-handler.js'
import type {
  IntentRequest,
  DecisionContextRequest,
  DecisionEvaluationRequest,
  ObservationRequest,
  IntelligenceForecastRequest,
  IntelligenceLearningRequest,
  IntelligenceRecommendationRequest
} from './contract-types.js'

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
  private readonly runtimeApiKey: string | null
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
  
  // Calibration Layer
  private forecastOutcomeStore: ForecastOutcomeStore
  private calibrationStore: CalibrationStore
  private predictionAccuracyStore: PredictionAccuracyStore
  private forecastOutcomeTracker: ForecastOutcomeTracker
  private predictionAccuracyAnalyzer: PredictionAccuracyAnalyzer
  private adaptiveConfidenceScaler: AdaptiveConfidenceScaler
  private predictionDriftDetector: PredictionDriftDetector
  private selfHealingAdjuster: SelfHealingForecastAdjuster
  private forecastCalibrationEngine: ForecastCalibrationEngine
  
  // Decision-Time Calibration Layer
  private decisionCalibrationStore: DecisionCalibrationStore
  private strategyBiasStore: StrategyBiasStore
  private planRewriteAuditStore: PlanRewriteAuditStore
  private calibrationContextBuilder: RealTimeCalibrationContextBuilder
  private calibratedRiskEngine: CalibrationAwareRiskEngineWrapper
  private strategyBiasInjector: StrategyBiasInjector
  private decisionTimeCalibration: DecisionTimeCalibrationEngine
  private executionPlanRewriter: ExecutionPlanRewriter

  // Runtime-Core Contract v1 Handler
  private contractHandler: RuntimeCoreContractHandler

  constructor(
    private readonly registry: TenantRuntimeRegistry,
    private readonly engines: Map<string, RuntimeEngine>,
    private readonly executionQuery: ExecutionQuery,
    private readonly inspector: RuntimeInspector,
    private readonly executionQueue: DurableExecutionQueue,
    private readonly executionStore: ExecutionStore,
    runtimeApiKey?: string
  ) {
    this.server = http.createServer(this.handleRequest.bind(this))
    const configuredRuntimeApiKey = runtimeApiKey ?? process.env.RUNTIME_API_KEY
    const normalizedRuntimeApiKey = configuredRuntimeApiKey?.trim()
    this.runtimeApiKey = normalizedRuntimeApiKey ? normalizedRuntimeApiKey : null
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
    
    // Initialize Calibration Layer
    this.forecastOutcomeStore = new ForecastOutcomeStore()
    this.calibrationStore = new CalibrationStore()
    this.predictionAccuracyStore = new PredictionAccuracyStore()
    this.forecastOutcomeTracker = new ForecastOutcomeTracker(this.forecastOutcomeStore)
    this.predictionAccuracyAnalyzer = new PredictionAccuracyAnalyzer(
      this.forecastOutcomeStore,
      this.predictionAccuracyStore
    )
    this.adaptiveConfidenceScaler = new AdaptiveConfidenceScaler(
      this.calibrationStore,
      this.predictionAccuracyStore
    )
    this.predictionDriftDetector = new PredictionDriftDetector(
      this.forecastOutcomeStore,
      this.predictionAccuracyStore
    )
    this.selfHealingAdjuster = new SelfHealingForecastAdjuster(
      this.calibrationStore,
      this.predictionDriftDetector,
      this.predictionAccuracyStore
    )
    this.forecastCalibrationEngine = new ForecastCalibrationEngine(
      this.forecastOutcomeTracker,
      this.predictionAccuracyAnalyzer,
      this.adaptiveConfidenceScaler,
      this.predictionDriftDetector,
      this.selfHealingAdjuster,
      this.calibrationStore
    )
    
    // Initialize Decision-Time Calibration Layer
    this.decisionCalibrationStore = new DecisionCalibrationStore()
    this.strategyBiasStore = new StrategyBiasStore()
    this.planRewriteAuditStore = new PlanRewriteAuditStore()
    this.calibrationContextBuilder = new RealTimeCalibrationContextBuilder(
      this.predictionAccuracyStore,
      this.calibrationStore,
      this.decayDetector,
      this.strategyBiasStore
    )
    this.calibratedRiskEngine = new CalibrationAwareRiskEngineWrapper(
      this.predictiveRiskEngine
    )
    this.strategyBiasInjector = new StrategyBiasInjector(
      this.strategyBiasStore
    )
    this.decisionTimeCalibration = new DecisionTimeCalibrationEngine(
      this.calibrationContextBuilder,
      this.calibratedRiskEngine,
      this.strategyBiasInjector,
      this.decisionCalibrationStore
    )
    this.executionPlanRewriter = new ExecutionPlanRewriter(
      this.planRewriteAuditStore
    )
    
    // Initialize Runtime-Core Contract v1 Handler
    this.contractHandler = new RuntimeCoreContractHandler(
      this.goalPlanner,
      this.planSynthesizer,
      this.predictiveRiskEngine,
      this.completionForecaster,
      this.executionStore,
      this.intentGraph,
      this.memoryStore,
      this.recommendationEngine,
      this.registry,
      this.forecastStore,
      this.strategyOutcomeStore
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Runtime-Api-Key, X-API-Key')

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    try {
      // Health check endpoint
      if (req.method === 'GET' && pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, service: 'bakeoff-runtime-core' }))
        return
      }
      
      // Root endpoint - API info
      if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          service: 'bakeoff-runtime-core',
          version: '1.0.0',
          status: 'operational',
          endpoints: {
            health: 'GET /health',
            events: 'POST /events',
            executions: 'GET /executions',
            intent: 'POST /runtime/v1/intent',
            intelligence: 'GET /intelligence/*',
            policy: 'POST /policy/*',
            predictive: 'GET /predictive/*'
          },
          documentation: 'https://github.com/rkendel1/bakeoff'
        }))
        return
      }

      // Runtime API key protection for non-public endpoints when configured
      if (this.requiresApiKey(pathname) && !this.isAuthorizedRequest(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
      
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
      } else if (req.method === 'GET' && pathname === '/predictive/accuracy') {
        await this.handlePredictiveAccuracy(req, res, url)
      } else if (req.method === 'POST' && pathname === '/predictive/calibrate') {
        await this.handlePredictiveCalibrate(req, res)
      } else if (req.method === 'GET' && pathname === '/predictive/drift') {
        await this.handlePredictiveDrift(req, res, url)
      } else if (req.method === 'GET' && pathname === '/predictive/decision-context') {
        await this.handleDecisionContext(req, res, url)
      } else if (req.method === 'POST' && pathname === '/predictive/decision/evaluate') {
        await this.handleDecisionEvaluate(req, res)
      } else if (req.method === 'GET' && pathname === '/predictive/plan-rewrites') {
        await this.handlePlanRewrites(req, res, url)
      
      // ═══════════════════════════════════════════════════════════════════════
      // Runtime-Core Contract v1 Endpoints
      // ═══════════════════════════════════════════════════════════════════════
      } else if (req.method === 'POST' && pathname === '/runtime/v1/intent') {
        await this.handleContractIntent(req, res)
      } else if (req.method === 'GET' && pathname === '/runtime/v1/decision/context') {
        await this.handleContractDecisionContext(req, res, url)
      } else if (req.method === 'POST' && pathname === '/runtime/v1/decision/evaluate') {
        await this.handleContractDecisionEvaluate(req, res)
      } else if (req.method === 'GET' && pathname.startsWith('/runtime/v1/execution/') && pathname.endsWith('/trace')) {
        await this.handleContractExecutionTrace(req, res, pathname)
      } else if (req.method === 'POST' && pathname.match(/^\/runtime\/v1\/execution\/[^/]+\/observe$/)) {
        await this.handleContractExecutionObserve(req, res, pathname)
      } else if (req.method === 'GET' && pathname.startsWith('/runtime/v1/execution/')) {
        await this.handleContractExecutionStatus(req, res, pathname)
      } else if (req.method === 'GET' && pathname === '/runtime/v1/intelligence/forecast') {
        await this.handleContractIntelligenceForecast(req, res, url)
      } else if (req.method === 'GET' && pathname === '/runtime/v1/intelligence/learning') {
        await this.handleContractIntelligenceLearning(req, res, url)
      } else if (req.method === 'GET' && pathname === '/runtime/v1/intelligence/recommendations') {
        await this.handleContractIntelligenceRecommendations(req, res, url)
      
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
   * GET /predictive/accuracy - Get prediction accuracy metrics
   * 
   * Query params:
   * - tenantId: required
   * 
   * Returns:
   * {
   *   "overallAccuracy": 0.84,
   *   "bias": "overconfident",
   *   "modelDrift": {
   *     "riskEngine": 0.12,
   *     "entropyForecaster": 0.18
   *   },
   *   "modelAccuracies": [
   *     {
   *       "modelType": "risk_engine",
   *       "accuracy": 0.83,
   *       "bias": "overconfident",
   *       "sampleSize": 45
   *     }
   *   ]
   * }
   */
  private async handlePredictiveAccuracy(
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
      // Get accuracy metrics for all models
      const accuracyMetrics = await this.predictionAccuracyAnalyzer.analyzeAllModels(tenantId)

      // Get drift information
      const driftResults = await this.predictionDriftDetector.detectAllDrift(tenantId)

      // Calculate overall accuracy
      const overallAccuracy = accuracyMetrics.length > 0
        ? accuracyMetrics.reduce((sum, m) => sum + m.overallAccuracy, 0) / accuracyMetrics.length
        : 0

      // Determine overall bias (majority)
      const biasCounts = accuracyMetrics.reduce((counts, m) => {
        counts[m.bias] = (counts[m.bias] || 0) + 1
        return counts
      }, {} as Record<string, number>)
      const overallBias = Object.entries(biasCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'calibrated'

      // Build model drift map
      const modelDrift: Record<string, number> = {}
      for (const drift of driftResults) {
        modelDrift[drift.modelType] = drift.driftMagnitude
      }

      const response = {
        tenantId,
        overallAccuracy,
        bias: overallBias,
        modelDrift,
        modelAccuracies: accuracyMetrics.map((m) => ({
          modelType: m.modelType,
          accuracy: m.overallAccuracy,
          bias: m.bias,
          sampleSize: m.sampleSize,
          brierScore: m.brierScore,
          calibrationError: m.calibrationError
        })),
        computedAt: new Date()
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      console.error('Error getting accuracy metrics:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get accuracy metrics'
      }))
    }
  }

  /**
   * POST /predictive/calibrate - Trigger full recalibration cycle
   * 
   * Body:
   * {
   *   "tenantId": "t1"
   * }
   * 
   * Returns:
   * {
   *   "calibrationReport": {
   *     "overallCalibrationHealth": "good",
   *     "systemAccuracy": 0.84,
   *     "modelStatus": [...],
   *     "recentAdjustments": [...],
   *     "recommendations": [...]
   *   }
   * }
   */
  private async handlePredictiveCalibrate(
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

      // Perform full calibration
      const calibrationReport = await this.forecastCalibrationEngine.performFullCalibration(
        data.tenantId
      )

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        message: 'Calibration complete',
        calibrationReport
      }))
    } catch (error) {
      console.error('Error performing calibration:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to perform calibration'
      }))
    }
  }

  /**
   * GET /predictive/drift - Get forecasting drift metrics
   * 
   * Query params:
   * - tenantId: required
   * 
   * Returns:
   * {
   *   "tenantId": "t1",
   *   "driftDetections": [
   *     {
   *       "modelType": "risk_engine",
   *       "driftDetected": true,
   *       "driftMagnitude": 0.18,
   *       "driftType": "accuracy_decline",
   *       "recommendedAction": "recalibrate",
   *       "urgency": "high"
   *     }
   *   ],
   *   "modelsNeedingRecalibration": [...]
   * }
   */
  private async handlePredictiveDrift(
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
      // Get drift information for all models
      const driftResults = await this.predictionDriftDetector.detectAllDrift(tenantId)

      // Get models needing recalibration
      const modelsNeedingRecalibration = await this.predictionDriftDetector.identifyModelsNeedingRecalibration(
        tenantId
      )

      const response = {
        tenantId,
        driftDetections: driftResults.map((r) => ({
          modelType: r.modelType,
          driftDetected: r.driftDetected,
          driftMagnitude: r.driftMagnitude,
          driftType: r.driftType,
          recommendedAction: r.recommendedAction,
          urgency: r.urgency,
          confidence: r.confidence,
          factors: r.factors
        })),
        modelsNeedingRecalibration,
        overallDriftStatus: driftResults.some((r) => r.driftDetected) ? 'drift_detected' : 'stable',
        detectedAt: new Date()
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      console.error('Error getting drift metrics:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get drift metrics'
      }))
    }
  }

  /**
   * GET /predictive/decision-context - Get live calibration context
   * 
   * Query params:
   * - tenantId: required
   * 
   * Returns live calibration context for decision-time correction.
   * 
   * Returns:
   * {
   *   "tenantId": "t1",
   *   "predictionAccuracy": { ... },
   *   "biasAdjustments": { ... },
   *   "driftState": { ... },
   *   "strategyPreferences": { ... },
   *   "providerReliabilityBias": { ... },
   *   "confidenceScaling": { ... },
   *   "confidence": 0.85
   * }
   */
  private async handleDecisionContext(
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
      // Build calibration context
      const context = await this.calibrationContextBuilder.buildContext(tenantId)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(context))
    } catch (error) {
      console.error('Error building decision context:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to build decision context'
      }))
    }
  }

  /**
   * POST /predictive/decision/evaluate - Evaluate decision pipeline
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "goalId": "goal-123" (optional)
   * }
   * 
   * Runs full decision-time pipeline: forecast → calibration → decision
   * 
   * Returns:
   * {
   *   "tenantId": "t1",
   *   "stages": {
   *     "forecast": { ... },
   *     "calibration": { ... },
   *     "finalDecision": {
   *       "shouldProceed": true,
   *       "recommendedStrategy": "...",
   *       "confidence": 0.85
   *     }
   *   },
   *   "summary": {
   *     "calibrationApplied": true,
   *     "decisionsModified": 2,
   *     "riskReduction": 0.14,
   *     "expectedSuccessIncrease": 0.08
   *   },
   *   "recommendations": [...]
   * }
   */
  private async handleDecisionEvaluate(
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

      // Evaluate decision pipeline
      const result = await this.decisionTimeCalibration.evaluateDecisionPipeline(
        data.tenantId,
        data.goalId
      )

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (error) {
      console.error('Error evaluating decision pipeline:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to evaluate decision pipeline'
      }))
    }
  }

  /**
   * GET /predictive/plan-rewrites - Get plan rewrite audit trail
   * 
   * Query params:
   * - tenantId: required
   * - limit: optional (default: 50)
   * 
   * Returns audit trail of all execution plan rewrites.
   * 
   * Returns:
   * {
   *   "tenantId": "t1",
   *   "rewrites": [
   *     {
   *       "id": "...",
   *       "originalPlan": { ... },
   *       "rewrittenPlan": { ... },
   *       "rewriteReason": "...",
   *       "calibrationFactors": [...],
   *       "rewrittenAt": "...",
   *       "confidence": 0.85
   *     }
   *   ],
   *   "stats": {
   *     "totalRewrites": 45,
   *     "verifiedRewrites": 38,
   *     "correctRewrites": 32,
   *     "rewriteAccuracy": 0.84
   *   }
   * }
   */
  private async handlePlanRewrites(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (!tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing required parameter: tenantId' }))
      return
    }

    try {
      // Get rewrites
      const rewrites = await this.planRewriteAuditStore.getRewritesForTenant(tenantId, limit)

      // Get effectiveness stats
      const stats = await this.executionPlanRewriter.getRewriteEffectiveness(tenantId)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tenantId,
        rewrites,
        stats,
        retrievedAt: new Date()
      }))
    } catch (error) {
      console.error('Error getting plan rewrites:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get plan rewrites'
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Helper Methods
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Parse request body as JSON
   */
  private async parseRequestBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = ''
      
      req.on('data', (chunk) => {
        body += chunk.toString()
        
        // Prevent excessive body size
        if (body.length > 1e6) {
          req.socket.destroy()
          reject(new Error('Request body too large'))
          return
        }
      })
      
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body) as T
          resolve(parsed)
        } catch (error) {
          reject(new Error('Invalid JSON in request body'))
        }
      })
      
      req.on('error', reject)
    })
  }

  /**
   * Determine if a request path requires API key authentication
   */
  private requiresApiKey(pathname: string): boolean {
    if (!this.runtimeApiKey) {
      return false
    }

    return pathname !== '/health' && pathname !== '/'
  }

  /**
   * Validate runtime API key from request headers
   */
  private isAuthorizedRequest(req: http.IncomingMessage): boolean {
    if (!this.runtimeApiKey) {
      return true
    }

    const providedApiKey = this.extractApiKey(req)
    if (!providedApiKey) {
      return false
    }

    return this.apiKeysMatch(this.runtimeApiKey, providedApiKey)
  }

  /**
   * Extract API key from supported headers
   */
  private extractApiKey(req: http.IncomingMessage): string | null {
    const runtimeApiKeyHeader = req.headers['x-runtime-api-key']
    if (typeof runtimeApiKeyHeader === 'string' && runtimeApiKeyHeader.trim()) {
      return runtimeApiKeyHeader.trim()
    }

    const apiKeyHeader = req.headers['x-api-key']
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
      return apiKeyHeader.trim()
    }

    const authorizationHeader = req.headers.authorization
    if (typeof authorizationHeader === 'string') {
      const [scheme, token] = authorizationHeader.split(' ', 2)
      if (scheme?.toLowerCase() === 'bearer' && token?.trim()) {
        return token.trim()
      }
    }

    return null
  }

  /**
   * Constant-time API key comparison
   */
  private apiKeysMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(provided)

    if (expectedBuffer.length !== providedBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, providedBuffer)
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Runtime-Core Contract v1 Handlers
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * POST /runtime/v1/intent - Intent Ingestion (Domain A)
   */
  private async handleContractIntent(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const requestBody = await this.parseRequestBody<IntentRequest>(req)
      const response = await this.contractHandler.handleIntent(requestBody)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INVALID_INTENT', 
          message: error instanceof Error ? error.message : 'Invalid request' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/decision/context - Decision Context (Domain B)
   */
  private async handleContractDecisionContext(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    try {
      const tenantId = url.searchParams.get('tenantId')
      const goalId = url.searchParams.get('goalId')

      if (!tenantId || !goalId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing tenantId or goalId' } 
        }))
        return
      }

      const request: DecisionContextRequest = { tenantId, goalId }
      const response = await this.contractHandler.handleDecisionContext(request)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }

  /**
   * POST /runtime/v1/decision/evaluate - Decision Evaluation (Domain B)
   */
  private async handleContractDecisionEvaluate(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const requestBody = await this.parseRequestBody<DecisionEvaluationRequest>(req)
      const response = await this.contractHandler.handleDecisionEvaluate(requestBody)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INVALID_REQUEST', 
          message: error instanceof Error ? error.message : 'Invalid request' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/execution/{executionId} - Execution Status (Domain C)
   */
  private async handleContractExecutionStatus(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    try {
      const executionId = pathname.split('/').pop()
      if (!executionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing executionId' } 
        }))
        return
      }

      const response = await this.contractHandler.handleExecutionStatus(executionId)
      if (!response) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' } 
        }))
        return
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/execution/{executionId}/trace - Execution Trace (Domain C)
   */
  private async handleContractExecutionTrace(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    try {
      const executionId = pathname.split('/')[4]
      if (!executionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing executionId' } 
        }))
        return
      }

      const response = await this.contractHandler.handleExecutionTrace(executionId)
      if (!response) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' } 
        }))
        return
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }

  /**
   * POST /runtime/v1/execution/{executionId}/observe - Send Observations (Domain C)
   */
  private async handleContractExecutionObserve(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    try {
      const executionId = pathname.split('/')[4]
      if (!executionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing executionId' } 
        }))
        return
      }

      const requestBody = await this.parseRequestBody<ObservationRequest>(req)
      const response = await this.contractHandler.handleObservation(executionId, requestBody)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INVALID_REQUEST', 
          message: error instanceof Error ? error.message : 'Invalid request' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/intelligence/forecast - Intelligence Forecast (Domain D)
   */
  private async handleContractIntelligenceForecast(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    try {
      const tenantId = url.searchParams.get('tenantId')
      const forecastType = url.searchParams.get('forecastType')
      const forecastHorizon = url.searchParams.get('forecastHorizon')

      if (!tenantId || !forecastType || !forecastHorizon) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing required parameters' } 
        }))
        return
      }

      const request: IntelligenceForecastRequest = {
        tenantId,
        forecastType: forecastType as any,
        forecastHorizon: forecastHorizon as any
      }
      const response = await this.contractHandler.handleIntelligenceForecast(request)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/intelligence/learning - Intelligence Learning (Domain D)
   */
  private async handleContractIntelligenceLearning(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    try {
      const tenantId = url.searchParams.get('tenantId')
      const learningType = url.searchParams.get('learningType')

      if (!tenantId || !learningType) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing required parameters' } 
        }))
        return
      }

      const request: IntelligenceLearningRequest = {
        tenantId,
        learningType: learningType as any
      }
      const response = await this.contractHandler.handleIntelligenceLearning(request)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }

  /**
   * GET /runtime/v1/intelligence/recommendations - Intelligence Recommendations (Domain D)
   */
  private async handleContractIntelligenceRecommendations(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    try {
      const tenantId = url.searchParams.get('tenantId')
      const recommendationType = url.searchParams.get('recommendationType')

      if (!tenantId || !recommendationType) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: { code: 'INVALID_REQUEST', message: 'Missing required parameters' } 
        }))
        return
      }

      const request: IntelligenceRecommendationRequest = {
        tenantId,
        recommendationType: recommendationType as any
      }
      const response = await this.contractHandler.handleIntelligenceRecommendations(request)
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal error' 
        } 
      }))
    }
  }
}

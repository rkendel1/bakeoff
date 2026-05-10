import { CausalReasoningEngine } from './causal/causal-reasoning-engine.js'
import { BakeoffReasoningContextBuilder } from './context/reasoning-context-builder.js'
import type {
  CausalExplanation,
  CounterfactualResult,
  DependencyReport,
  Hypothesis,
  Insight,
  KernelReadBoundary,
  ReasoningTrace,
  StrategyEvaluation
} from './context/reasoning-types.js'
import { CounterfactualReasoningEngine } from './counterfactual/counterfactual-reasoning-engine.js'
import { CrossCapabilityDependencyAnalyzer } from './dependencies/cross-capability-dependency-analyzer.js'
import { OperationalHypothesisEngine } from './hypothesis/operational-hypothesis-engine.js'
import { OperationalInsightEngine } from './insights/operational-insight-engine.js'
import { StrategyEvaluationEngine } from './strategy/strategy-evaluation-engine.js'
import { ReasoningTraceEngine } from './tracing/reasoning-trace-engine.js'

type ReasoningResult<T> = {
  result: T
  trace: ReasoningTrace
}

export class BakeoffReasoning {
  private readonly contextBuilder: BakeoffReasoningContextBuilder
  private readonly causalEngine = new CausalReasoningEngine()
  private readonly hypothesisEngine = new OperationalHypothesisEngine()
  private readonly dependencyAnalyzer = new CrossCapabilityDependencyAnalyzer()
  private readonly counterfactualEngine = new CounterfactualReasoningEngine()
  private readonly strategyEngine = new StrategyEvaluationEngine()
  private readonly insightEngine = new OperationalInsightEngine()

  constructor(private readonly kernelReadBoundary: KernelReadBoundary) {
    this.contextBuilder = new BakeoffReasoningContextBuilder(kernelReadBoundary)
  }

  analyzeFailure(failedNodeId: string): ReasoningResult<CausalExplanation> {
    const context = this.contextBuilder.build([failedNodeId])
    const traceEngine = this.createTraceEngine(`analyzeFailure:${failedNodeId}`, context.kernelSnapshotVersion)
    const result = this.causalEngine.analyzeFailure(context, failedNodeId, traceEngine)
    return { result, trace: traceEngine.finish() }
  }

  explainSystemState(): ReasoningResult<{ insights: Insight[]; dependencyReport: DependencyReport }> {
    const context = this.contextBuilder.build()
    const traceEngine = this.createTraceEngine('explainSystemState', context.kernelSnapshotVersion)
    const causal = this.causalEngine.analyzeFailure(
      context,
      this.pickDefaultFailureNode(context),
      traceEngine
    )
    const dependencyReport = this.dependencyAnalyzer.analyze(context, traceEngine)
    const insights = this.insightEngine.generate(context, causal, dependencyReport, traceEngine)
    return { result: { insights, dependencyReport }, trace: traceEngine.finish() }
  }

  generateHypotheses(failedNodeId: string): ReasoningResult<Hypothesis[]> {
    const context = this.contextBuilder.build([failedNodeId])
    const traceEngine = this.createTraceEngine(`generateHypotheses:${failedNodeId}`, context.kernelSnapshotVersion)
    const causal = this.causalEngine.analyzeFailure(context, failedNodeId, traceEngine)
    const result = this.hypothesisEngine.generate(context, causal, traceEngine)
    return { result, trace: traceEngine.finish() }
  }

  evaluateStrategy(strategyId: string): ReasoningResult<StrategyEvaluation> {
    const context = this.contextBuilder.build()
    const traceEngine = this.createTraceEngine(`evaluateStrategy:${strategyId}`, context.kernelSnapshotVersion)
    const result = this.strategyEngine.evaluate(context, strategyId, traceEngine)
    return { result, trace: traceEngine.finish() }
  }

  simulateCounterfactual(scenario: string): ReasoningResult<CounterfactualResult> {
    const context = this.contextBuilder.build()
    const traceEngine = this.createTraceEngine(`simulateCounterfactual:${scenario}`, context.kernelSnapshotVersion)
    const result = this.counterfactualEngine.evaluate(context, scenario, traceEngine)
    return { result, trace: traceEngine.finish() }
  }

  analyzeDependencies(): ReasoningResult<DependencyReport> {
    const context = this.contextBuilder.build()
    const traceEngine = this.createTraceEngine('analyzeDependencies', context.kernelSnapshotVersion)
    const result = this.dependencyAnalyzer.analyze(context, traceEngine)
    return { result, trace: traceEngine.finish() }
  }

  private createTraceEngine(queryId: string, kernelSnapshotVersion: string): ReasoningTraceEngine {
    const traceEngine = new ReasoningTraceEngine()
    traceEngine.start(queryId, kernelSnapshotVersion)
    return traceEngine
  }

  private pickDefaultFailureNode(context: { graph: { nodes: Array<{ id: string; status?: string }> } }): string {
    const failed = context.graph.nodes
      .filter((node) => node.status === 'failed')
      .sort((a, b) => a.id.localeCompare(b.id))
    if (failed.length > 0) {
      return failed[0].id
    }

    const degraded = context.graph.nodes
      .filter((node) => node.status === 'degraded')
      .sort((a, b) => a.id.localeCompare(b.id))
    if (degraded.length > 0) {
      return degraded[0].id
    }

    const sortedNodes = [...context.graph.nodes].sort((a, b) => a.id.localeCompare(b.id))
    return sortedNodes[0]?.id ?? ''
  }
}

export function createBakeoff(kernelReadBoundary: KernelReadBoundary): {
  reasoning: {
    analyzeFailure: (failedNodeId: string) => ReasoningResult<CausalExplanation>
    explainSystemState: () => ReasoningResult<{ insights: Insight[]; dependencyReport: DependencyReport }>
    generateHypotheses: (failedNodeId: string) => ReasoningResult<Hypothesis[]>
    evaluateStrategy: (strategyId: string) => ReasoningResult<StrategyEvaluation>
    simulateCounterfactual: (scenario: string) => ReasoningResult<CounterfactualResult>
    analyzeDependencies: () => ReasoningResult<DependencyReport>
  }
} {
  const reasoning = new BakeoffReasoning(kernelReadBoundary)
  return {
    reasoning: {
      analyzeFailure: reasoning.analyzeFailure.bind(reasoning),
      explainSystemState: reasoning.explainSystemState.bind(reasoning),
      generateHypotheses: reasoning.generateHypotheses.bind(reasoning),
      evaluateStrategy: reasoning.evaluateStrategy.bind(reasoning),
      simulateCounterfactual: reasoning.simulateCounterfactual.bind(reasoning),
      analyzeDependencies: reasoning.analyzeDependencies.bind(reasoning)
    }
  }
}

export type {
  CausalExplanation,
  CounterfactualResult,
  DependencyReport,
  GraphEdge,
  GraphNode,
  GraphPath,
  Hypothesis,
  Insight,
  KernelReadBoundary,
  KernelSimulationProjection,
  KernelSnapshot,
  KernelStrategyProjection,
  ReasoningContext,
  ReasoningTrace,
  StrategyEvaluation,
  UnifiedOperationalGraph
} from './context/reasoning-types.js'

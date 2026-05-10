import type {
  CounterfactualResult,
  ReasoningContext
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class CounterfactualReasoningEngine {
  evaluate(
    context: ReasoningContext,
    scenario: string,
    traceEngine?: ReasoningTraceEngine
  ): CounterfactualResult {
    traceEngine?.step(`counterfactual:${scenario}`)

    const projection = context.simulationProjections.find((candidate) => candidate.scenario === scenario)
    if (projection) {
      return {
        scenario: projection.scenario,
        outcomeDelta: projection.outcomeDelta,
        riskShift: projection.riskShift,
        dependencyImpact: [...projection.dependencyImpact].sort((a, b) => a.localeCompare(b))
      }
    }

    const failedNodes = context.graph.nodes.filter((node) => node.status === 'failed').length
    const degradedNodes = context.graph.nodes.filter((node) => node.status === 'degraded').length

    return {
      scenario,
      outcomeDelta: Number((degradedNodes * 0.02 - failedNodes * 0.05).toFixed(4)),
      riskShift: Number((failedNodes * 0.06 + degradedNodes * 0.03).toFixed(4)),
      dependencyImpact: context.graph.edges
        .map((edge) => `${edge.from}->${edge.to}`)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 5)
    }
  }
}

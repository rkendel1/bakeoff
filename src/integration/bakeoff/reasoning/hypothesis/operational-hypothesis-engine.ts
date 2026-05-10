import type {
  CausalExplanation,
  Hypothesis,
  ReasoningContext
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class OperationalHypothesisEngine {
  generate(
    context: ReasoningContext,
    causalExplanation: CausalExplanation,
    traceEngine?: ReasoningTraceEngine
  ): Hypothesis[] {
    const hypotheses: Hypothesis[] = []

    for (const rootCause of causalExplanation.rootCauses) {
      traceEngine?.step(`hypothesis:root:${rootCause.id}`)
      hypotheses.push({
        statement: `Failure likely originated at ${rootCause.id}`,
        supportingNodes: [rootCause.id],
        confidence: Math.max(0, Math.min(1, causalExplanation.confidence)),
        causalStrength: Math.max(0, Math.min(1, rootCause.score ?? causalExplanation.confidence))
      })
    }

    const degradedNodes = context.graph.nodes
      .filter((node) => node.status === 'degraded')
      .map((node) => node.id)
      .sort((a, b) => a.localeCompare(b))

    if (degradedNodes.length > 0) {
      traceEngine?.step('hypothesis:degradation-cluster')
      hypotheses.push({
        statement: 'A degradation cluster may explain downstream instability',
        supportingNodes: degradedNodes,
        confidence: Math.min(1, 0.4 + degradedNodes.length * 0.1),
        causalStrength: Math.min(1, degradedNodes.length / Math.max(1, context.graph.nodes.length))
      })
    }

    if (hypotheses.length === 0) {
      traceEngine?.step('hypothesis:insufficient-evidence')
      hypotheses.push({
        statement: 'No dominant causal signature detected in current snapshot',
        supportingNodes: [],
        confidence: 0.2,
        causalStrength: 0.1
      })
    }

    return hypotheses.sort((a, b) => b.confidence - a.confidence || b.causalStrength - a.causalStrength)
  }
}

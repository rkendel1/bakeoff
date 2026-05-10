import type {
  CausalExplanation,
  DependencyReport,
  Insight,
  ReasoningContext
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class OperationalInsightEngine {
  generate(
    context: ReasoningContext,
    causalExplanation: CausalExplanation,
    dependencyReport: DependencyReport,
    traceEngine?: ReasoningTraceEngine
  ): Insight[] {
    const insights: Insight[] = []

    if (causalExplanation.rootCauses.length > 0) {
      traceEngine?.step('insight:root-causes')
      insights.push({
        title: 'Root causes identified',
        description: `Detected ${causalExplanation.rootCauses.length} root cause node(s) with confidence ${causalExplanation.confidence.toFixed(4)}.`,
        severity: causalExplanation.confidence >= 0.75 ? 'high' : 'medium',
        evidenceNodes: causalExplanation.rootCauses.map((node) => node.id).sort((a, b) => a.localeCompare(b))
      })
    }

    const bottlenecks = this.detectBottlenecks(context)
    if (bottlenecks.length > 0) {
      traceEngine?.step('insight:bottlenecks')
      insights.push({
        title: 'Bottleneck concentration detected',
        description: `${bottlenecks.length} high-fanout node(s) may be constraining system flow.`,
        severity: bottlenecks.length >= 2 ? 'high' : 'medium',
        evidenceNodes: bottlenecks
      })
    }

    if (dependencyReport.riskNodes.length > 0) {
      traceEngine?.step('insight:risk-propagation')
      insights.push({
        title: 'Cross-capability risk propagation',
        description: `Risk observed across ${dependencyReport.riskNodes.length} node(s) with dependency depth ${dependencyReport.dependencyDepth}.`,
        severity: dependencyReport.dependencyDepth >= 3 ? 'critical' : 'high',
        evidenceNodes: dependencyReport.riskNodes.map((node) => node.id).sort((a, b) => a.localeCompare(b))
      })
    }

    if (insights.length === 0) {
      insights.push({
        title: 'Operational state stable',
        description: 'No critical causal or dependency anomalies detected from the current kernel snapshot.',
        severity: 'low',
        evidenceNodes: []
      })
    }

    return insights
  }

  private detectBottlenecks(context: ReasoningContext): string[] {
    const fanout = new Map<string, number>()
    for (const edge of context.graph.edges) {
      fanout.set(edge.from, (fanout.get(edge.from) ?? 0) + 1)
    }

    const threshold = context.graph.edges.length > 8 ? 3 : 2
    return [...fanout.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([nodeId]) => nodeId)
      .sort((a, b) => a.localeCompare(b))
  }
}

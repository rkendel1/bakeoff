import type {
  CausalExplanation,
  GraphEdge,
  GraphNode,
  ReasoningContext
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class CausalReasoningEngine {
  analyzeFailure(
    context: ReasoningContext,
    failedNodeId: string,
    traceEngine?: ReasoningTraceEngine
  ): CausalExplanation {
    const nodeMap = new Map(context.graph.nodes.map((node) => [node.id, node]))
    const incoming = this.buildIncoming(context.graph.edges)

    const visited = new Set<string>()
    const queue: string[] = [failedNodeId]
    let queueIndex = 0
    const causalEdges: GraphEdge[] = []
    const rootCauseIds = new Set<string>()

    while (queueIndex < queue.length) {
      const nodeId = queue[queueIndex]
      queueIndex += 1
      if (!nodeId || visited.has(nodeId)) continue

      visited.add(nodeId)
      traceEngine?.visitNode(nodeId)
      traceEngine?.step(`traverse:${nodeId}`)

      const parents = incoming.get(nodeId) ?? []
      if (parents.length === 0) {
        rootCauseIds.add(nodeId)
        continue
      }

      for (const edge of parents) {
        causalEdges.push(edge)
        queue.push(edge.from)
      }
    }

    const rootCauses = [...rootCauseIds]
      .map((id) => nodeMap.get(id))
      .filter((node): node is GraphNode => Boolean(node))
      .sort((a, b) => a.id.localeCompare(b.id))

    const propagationPath = [...causalEdges].sort((a, b) =>
      `${a.from}|${a.to}|${a.relation}`.localeCompare(`${b.from}|${b.to}|${b.relation}`)
    )

    const confidence = this.calculateConfidence(propagationPath, rootCauses.length)

    return {
      rootCauses,
      propagationPath,
      confidence,
      evidenceNodes: [...visited].sort((a, b) => a.localeCompare(b))
    }
  }

  private buildIncoming(edges: GraphEdge[]): Map<string, GraphEdge[]> {
    const incoming = new Map<string, GraphEdge[]>()
    for (const edge of edges) {
      const current = incoming.get(edge.to) ?? []
      current.push(edge)
      incoming.set(edge.to, current)
    }
    return incoming
  }

  private calculateConfidence(edges: GraphEdge[], rootCauseCount: number): number {
    if (edges.length === 0) {
      return rootCauseCount > 0 ? 1 : 0
    }

    const averageWeight = edges.reduce((sum, edge) => sum + edge.weight, 0) / edges.length
    const normalizedRoots = Math.min(1, 1 / Math.max(1, rootCauseCount))

    return Math.max(0, Math.min(1, averageWeight * 0.8 + normalizedRoots * 0.2))
  }
}

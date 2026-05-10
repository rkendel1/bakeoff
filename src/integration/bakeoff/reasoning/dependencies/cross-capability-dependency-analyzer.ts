import type {
  DependencyReport,
  GraphEdge,
  GraphNode,
  GraphPath,
  ReasoningContext
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class CrossCapabilityDependencyAnalyzer {
  analyze(context: ReasoningContext, traceEngine?: ReasoningTraceEngine): DependencyReport {
    const adjacency = new Map<string, GraphEdge[]>()
    const incomingCount = new Map<string, number>()
    const nodesById = new Map(context.graph.nodes.map((node) => [node.id, node]))

    for (const node of context.graph.nodes) {
      adjacency.set(node.id, [])
      incomingCount.set(node.id, 0)
    }

    for (const edge of context.graph.edges) {
      adjacency.get(edge.from)?.push(edge)
      incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
    }

    const roots = context.graph.nodes
      .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
      .sort((a, b) => a.id.localeCompare(b.id))

    const criticalPaths: GraphPath[] = []
    let maxDepth = 0

    for (const root of roots) {
      this.walkPaths(
        root.id,
        adjacency,
        nodesById,
        [root.id],
        [],
        0,
        criticalPaths,
        traceEngine
      )
    }

    for (const path of criticalPaths) {
      maxDepth = Math.max(maxDepth, path.nodes.length - 1)
    }

    const riskNodes: GraphNode[] = context.graph.nodes
      .filter((node) => node.status === 'failed' || node.status === 'degraded')
      .sort((a, b) => a.id.localeCompare(b.id))

    return {
      criticalPaths: criticalPaths
        .sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score
          }
          return b.nodes.length - a.nodes.length
        })
        .slice(0, 5),
      riskNodes,
      dependencyDepth: maxDepth
    }
  }

  private walkPaths(
    current: string,
    adjacency: Map<string, GraphEdge[]>,
    nodesById: Map<string, GraphNode>,
    pathNodes: string[],
    pathEdges: GraphEdge[],
    currentScore: number,
    collected: GraphPath[],
    traceEngine?: ReasoningTraceEngine
  ): void {
    traceEngine?.visitNode(current)
    traceEngine?.step(`dependency:${current}`)

    const outgoing = (adjacency.get(current) ?? [])
      .slice()
      .sort((a, b) => `${a.to}|${a.relation}`.localeCompare(`${b.to}|${b.relation}`))

    if (outgoing.length === 0) {
      collected.push({
        nodes: [...pathNodes],
        edges: [...pathEdges],
        score: Number((currentScore / Math.max(1, pathEdges.length)).toFixed(4))
      })
      return
    }

    for (const edge of outgoing) {
      if (pathNodes.includes(edge.to)) continue

      const targetNode = nodesById.get(edge.to)
      const nodeFactor = targetNode?.status === 'failed'
        ? 1
        : targetNode?.status === 'degraded'
          ? 0.8
          : 0.6

      this.walkPaths(
        edge.to,
        adjacency,
        nodesById,
        [...pathNodes, edge.to],
        [...pathEdges, edge],
        currentScore + edge.weight * nodeFactor,
        collected,
        traceEngine
      )
    }
  }
}

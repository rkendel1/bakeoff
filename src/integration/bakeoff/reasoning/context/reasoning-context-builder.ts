import type {
  GraphEdge,
  GraphNode,
  KernelReadBoundary,
  KernelSnapshot,
  ReasoningContext
} from './reasoning-types.js'

export class BakeoffReasoningContextBuilder {
  constructor(private readonly kernelReadBoundary: KernelReadBoundary) {}

  build(focusNodeIds?: string[]): ReasoningContext {
    const snapshot = this.kernelReadBoundary.readSnapshot()
    const selectedSnapshot = focusNodeIds && focusNodeIds.length > 0
      ? this.sliceSnapshot(snapshot, focusNodeIds)
      : snapshot

    const nodes = [...selectedSnapshot.graph.nodes].sort((a, b) => a.id.localeCompare(b.id))
    const edges = [...selectedSnapshot.graph.edges].sort((a, b) =>
      `${a.from}|${a.to}|${a.relation}`.localeCompare(`${b.from}|${b.to}|${b.relation}`)
    )

    return {
      kernelSnapshotVersion: selectedSnapshot.version,
      graph: { nodes, edges },
      simulationProjections: [...(selectedSnapshot.simulationProjections ?? [])].sort((a, b) =>
        a.scenario.localeCompare(b.scenario)
      ),
      strategyProjections: [...(selectedSnapshot.strategyProjections ?? [])].sort((a, b) =>
        a.strategyId.localeCompare(b.strategyId)
      )
    }
  }

  private sliceSnapshot(snapshot: Readonly<KernelSnapshot>, focusNodeIds: string[]): KernelSnapshot {
    const nodesById = new Map(snapshot.graph.nodes.map((node) => [node.id, node]))

    const related = new Set<string>(focusNodeIds)
    let changed = true

    while (changed) {
      changed = false
      for (const edge of snapshot.graph.edges) {
        if (related.has(edge.from) || related.has(edge.to)) {
          if (!related.has(edge.from)) {
            related.add(edge.from)
            changed = true
          }
          if (!related.has(edge.to)) {
            related.add(edge.to)
            changed = true
          }
        }
      }
    }

    const nodes: GraphNode[] = [...related]
      .map((id) => nodesById.get(id))
      .filter((node): node is GraphNode => Boolean(node))

    const edges: GraphEdge[] = snapshot.graph.edges.filter((edge) =>
      related.has(edge.from) && related.has(edge.to)
    )

    return {
      version: snapshot.version,
      graph: {
        nodes,
        edges
      },
      simulationProjections: snapshot.simulationProjections ?? [],
      strategyProjections: snapshot.strategyProjections ?? []
    }
  }
}

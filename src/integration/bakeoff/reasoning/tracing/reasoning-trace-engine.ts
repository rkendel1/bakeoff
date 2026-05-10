import type { ReasoningTrace } from '../context/reasoning-types.js'

export class ReasoningTraceEngine {
  private queryId = ''
  private kernelSnapshotVersion = ''
  private readonly visitedNodes = new Set<string>()
  private readonly reasoningSteps: string[] = []

  start(queryId: string, kernelSnapshotVersion: string): void {
    this.queryId = queryId
    this.kernelSnapshotVersion = kernelSnapshotVersion
    this.visitedNodes.clear()
    this.reasoningSteps.length = 0
  }

  visitNode(nodeId: string): void {
    this.visitedNodes.add(nodeId)
  }

  step(step: string): void {
    this.reasoningSteps.push(step)
  }

  finish(): ReasoningTrace {
    const trace = {
      queryId: this.queryId,
      visitedNodes: [...this.visitedNodes],
      reasoningSteps: [...this.reasoningSteps],
      kernelSnapshotVersion: this.kernelSnapshotVersion
    }

    this.queryId = ''
    this.kernelSnapshotVersion = ''
    this.visitedNodes.clear()
    this.reasoningSteps.length = 0

    return trace
  }
}

import type { ReasoningTrace } from '../context/reasoning-types.js'

export class ReasoningTraceEngine {
  private queryId = ''
  private kernelSnapshotVersion = ''
  private readonly visitedNodes: string[] = []
  private readonly reasoningSteps: string[] = []

  start(queryId: string, kernelSnapshotVersion: string): void {
    this.queryId = queryId
    this.kernelSnapshotVersion = kernelSnapshotVersion
    this.visitedNodes.length = 0
    this.reasoningSteps.length = 0
  }

  visitNode(nodeId: string): void {
    if (!this.visitedNodes.includes(nodeId)) {
      this.visitedNodes.push(nodeId)
    }
  }

  step(step: string): void {
    this.reasoningSteps.push(step)
  }

  finish(): ReasoningTrace {
    return {
      queryId: this.queryId,
      visitedNodes: [...this.visitedNodes],
      reasoningSteps: [...this.reasoningSteps],
      kernelSnapshotVersion: this.kernelSnapshotVersion
    }
  }
}

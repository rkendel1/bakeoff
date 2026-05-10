export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type GraphNode = {
  id: string
  capability:
    | 'task'
    | 'form'
    | 'submission'
    | 'workflow'
    | 'document'
    | 'provider'
    | 'system'
  status?: 'healthy' | 'degraded' | 'failed'
  score?: number
}

export type GraphEdge = {
  from: string
  to: string
  relation: string
  weight: number
}

export type GraphPath = {
  nodes: string[]
  edges: GraphEdge[]
  score: number
}

export type UnifiedOperationalGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type KernelSimulationProjection = {
  scenario: string
  outcomeDelta: number
  riskShift: number
  dependencyImpact: string[]
}

export type KernelStrategyProjection = {
  strategyId: string
  predictedOutcome: number
  actualOutcome: number
  reliability: number
}

export type KernelSnapshot = {
  version: string
  graph: UnifiedOperationalGraph
  simulationProjections?: KernelSimulationProjection[]
  strategyProjections?: KernelStrategyProjection[]
}

export interface KernelReadBoundary {
  readSnapshot(): Readonly<KernelSnapshot>
}

export type ReasoningContext = {
  kernelSnapshotVersion: string
  graph: UnifiedOperationalGraph
  simulationProjections: KernelSimulationProjection[]
  strategyProjections: KernelStrategyProjection[]
}

export type CausalExplanation = {
  rootCauses: GraphNode[]
  propagationPath: GraphEdge[]
  confidence: number
  evidenceNodes: string[]
}

export type Hypothesis = {
  statement: string
  supportingNodes: string[]
  confidence: number
  causalStrength: number
}

export type DependencyReport = {
  criticalPaths: GraphPath[]
  riskNodes: GraphNode[]
  dependencyDepth: number
}

export type CounterfactualResult = {
  scenario: string
  outcomeDelta: number
  riskShift: number
  dependencyImpact: string[]
}

export type StrategyEvaluation = {
  strategyId: string
  effectivenessScore: number
  driftScore: number
  reliabilityIndex: number
}

export type Insight = {
  title: string
  description: string
  severity: Severity
  evidenceNodes: string[]
}

export type ReasoningTrace = {
  queryId: string
  visitedNodes: string[]
  reasoningSteps: string[]
  kernelSnapshotVersion: string
}

import type {
  ReasoningContext,
  StrategyEvaluation
} from '../context/reasoning-types.js'
import type { ReasoningTraceEngine } from '../tracing/reasoning-trace-engine.js'

export class StrategyEvaluationEngine {
  evaluate(
    context: ReasoningContext,
    strategyId: string,
    traceEngine?: ReasoningTraceEngine
  ): StrategyEvaluation {
    traceEngine?.step(`strategy:${strategyId}`)

    const projection = context.strategyProjections.find((entry) => entry.strategyId === strategyId)
    if (projection) {
      const driftScore = Math.abs(projection.predictedOutcome - projection.actualOutcome)
      const effectivenessScore = Math.max(0, 1 - driftScore)
      return {
        strategyId,
        effectivenessScore: Number(effectivenessScore.toFixed(4)),
        driftScore: Number(driftScore.toFixed(4)),
        reliabilityIndex: Number(Math.max(0, Math.min(1, projection.reliability)).toFixed(4))
      }
    }

    const allScores = context.graph.nodes.map((node) => node.score ?? 0.5)
    const avgScore = allScores.length === 0
      ? 0.5
      : allScores.reduce((sum, score) => sum + score, 0) / allScores.length

    return {
      strategyId,
      effectivenessScore: Number(avgScore.toFixed(4)),
      driftScore: Number((1 - avgScore).toFixed(4)),
      reliabilityIndex: Number((Math.max(0.1, avgScore * 0.9)).toFixed(4))
    }
  }
}

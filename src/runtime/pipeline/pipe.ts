import type { ExecutionContext } from '../context/execution-context.js'

export type PipelineStage = (ctx: ExecutionContext) => Promise<ExecutionContext>

export async function pipe(
  ctx: ExecutionContext,
  stages: PipelineStage[]
): Promise<ExecutionContext> {
  let currentContext = ctx

  for (const stage of stages) {
    currentContext = await stage(currentContext)
  }

  return currentContext
}

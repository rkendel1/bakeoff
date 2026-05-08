import type { RuntimeEvent } from '../../models/event.js'
import type { ExecutionContext } from '../context/execution-context.js'

export type ExecutionStatus = 'running' | 'completed' | 'failed'

export type ExecutionRecord = {
  id: string
  tenantId: string
  entityId: string
  event: RuntimeEvent

  modelVersion: string   // 👈 NEW CRITICAL FIELD - binds execution to specific model version

  status: ExecutionStatus

  contextSnapshot: ExecutionContext

  createdAt: Date
  completedAt?: Date
  error?: {
    message: string
    name: string
  }
}

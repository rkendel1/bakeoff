import type { RuntimeEvent } from '../../models/event.js'
import type { ExecutionContext } from '../context/execution-context.js'

export type ExecutionStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying'

export type ExecutionRecord = {
  id: string
  tenantId: string
  entityId: string
  event: RuntimeEvent

  status: ExecutionStatus

  contextSnapshot: ExecutionContext

  createdAt: Date
  completedAt?: Date
  error?: {
    message: string
    name: string
  }
}

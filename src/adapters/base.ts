import type { RuntimeEvent } from '../models/event.js'

export type AdapterResult = {
  success: boolean
  followUpEvents: RuntimeEvent[]
}

export interface Adapter {
  execute(action: {
    name: string
    event: RuntimeEvent
  }): Promise<AdapterResult>
}

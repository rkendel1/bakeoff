import type { RuntimeEvent } from '../models/event.js'

export class EventStore {
  private readonly events: RuntimeEvent[] = []

  append(event: RuntimeEvent): void {
    this.events.push(event)
  }

  history(): RuntimeEvent[] {
    return [...this.events]
  }
}

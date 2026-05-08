import type { RuntimeEvent } from '../models/event.js'

export class Dispatcher {
  private readonly queue: RuntimeEvent[] = []

  enqueue(event: RuntimeEvent): void {
    this.queue.push(event)
  }

  dequeue(): RuntimeEvent | undefined {
    return this.queue.shift()
  }

  hasPending(): boolean {
    return this.queue.length > 0
  }
}

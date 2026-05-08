import type { StateHistoryEntry } from '../models/state.js'

export class StateStore {
  private readonly state = new Map<string, string>()
  private readonly transitions: StateHistoryEntry[] = []

  get(entityId: string): string | undefined {
    return this.state.get(entityId)
  }

  set(entityId: string, nextState: string): void {
    this.state.set(entityId, nextState)
  }

  appendHistory(entry: StateHistoryEntry): void {
    this.transitions.push(entry)
  }

  history(): StateHistoryEntry[] {
    return [...this.transitions]
  }
}

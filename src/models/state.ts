export type Transition = {
  entityType: string
  fromState: string
  eventType: string
  toState: string
  actions: string[]
}

export type StateHistoryEntry = {
  entityId: string
  fromState: string
  toState: string
  eventType: string
  timestamp: string
}

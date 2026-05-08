import type { Adapter, AdapterResult } from './base.js'

export class MockAdapter implements Adapter {
  async execute(): Promise<AdapterResult> {
    return {
      success: true,
      followUpEvents: []
    }
  }
}

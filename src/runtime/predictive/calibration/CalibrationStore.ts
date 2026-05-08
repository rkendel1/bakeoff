import type { ModelCalibrationState, CalibrationAdjustment } from './types.js'

/**
 * CalibrationStore - Persistence for calibration state
 * 
 * This store maintains:
 * - Current calibration parameters for each model
 * - Historical adjustments
 * - Calibration effectiveness
 * 
 * This enables:
 * - State recovery after restart
 * - Calibration history tracking
 * - Adjustment effectiveness analysis
 */
export class CalibrationStore {
  private states: Map<string, ModelCalibrationState> = new Map()
  private adjustments: Map<string, CalibrationAdjustment[]> = new Map()

  /**
   * Get calibration state for a model
   */
  async getState(tenantId: string, modelType: string): Promise<ModelCalibrationState | undefined> {
    const key = `${tenantId}:${modelType}`
    return this.states.get(key)
  }

  /**
   * Save calibration state
   */
  async saveState(state: ModelCalibrationState): Promise<void> {
    const key = `${state.tenantId}:${state.modelType}`
    this.states.set(key, state)
  }

  /**
   * Record a calibration adjustment
   */
  async recordAdjustment(adjustment: CalibrationAdjustment): Promise<void> {
    const key = `${adjustment.tenantId}:${adjustment.modelType}`
    const adjustments = this.adjustments.get(key) || []
    adjustments.push(adjustment)
    this.adjustments.set(key, adjustments)
  }

  /**
   * Get adjustment history
   */
  async getAdjustmentHistory(
    tenantId: string,
    modelType: string,
    limit?: number
  ): Promise<CalibrationAdjustment[]> {
    const key = `${tenantId}:${modelType}`
    let adjustments = this.adjustments.get(key) || []

    // Sort by most recent
    adjustments = [...adjustments].sort(
      (a, b) => b.appliedAt.getTime() - a.appliedAt.getTime()
    )

    if (limit) {
      adjustments = adjustments.slice(0, limit)
    }

    return adjustments
  }

  /**
   * Get all states for a tenant
   */
  async getAllStates(tenantId: string): Promise<ModelCalibrationState[]> {
    const states: ModelCalibrationState[] = []

    for (const [key, state] of this.states.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        states.push(state)
      }
    }

    return states
  }

  /**
   * Initialize default state for a model
   */
  async initializeState(tenantId: string, modelType: string): Promise<ModelCalibrationState> {
    const state: ModelCalibrationState = {
      modelType,
      tenantId,
      confidenceScaleFactor: 1.0,
      riskSensitivity: 1.0,
      decaySensitivity: 1.0,
      entropyBaseline: 0.5,
      convergenceExpectation: 0.7,
      recentAccuracy: 0.5,
      accuracyTrend: 'stable',
      driftMagnitude: 0,
      driftDetected: false,
      lastCalibratedAt: new Date(),
      calibrationCount: 0
    }

    await this.saveState(state)
    return state
  }

  /**
   * Update state accuracy metrics
   */
  async updateAccuracy(
    tenantId: string,
    modelType: string,
    accuracy: number,
    trend: 'improving' | 'stable' | 'declining'
  ): Promise<void> {
    let state = await this.getState(tenantId, modelType)

    if (!state) {
      state = await this.initializeState(tenantId, modelType)
    }

    state.recentAccuracy = accuracy
    state.accuracyTrend = trend

    await this.saveState(state)
  }

  /**
   * Update drift detection
   */
  async updateDrift(
    tenantId: string,
    modelType: string,
    driftMagnitude: number,
    driftDetected: boolean
  ): Promise<void> {
    let state = await this.getState(tenantId, modelType)

    if (!state) {
      state = await this.initializeState(tenantId, modelType)
    }

    state.driftMagnitude = driftMagnitude
    state.driftDetected = driftDetected

    await this.saveState(state)
  }
}

import type { DecisionTimeCalibration } from './types.js'

/**
 * DecisionCalibrationStore - Persistence for decision-time calibrations
 * 
 * This stores the history of:
 * - Calibration adjustments made at decision-time
 * - Risk corrections
 * - Strategy swaps
 * - Provider reroutes
 * 
 * Key insight:
 * Tracking calibration decisions enables:
 * - Learning from calibration effectiveness
 * - Trending calibration patterns
 * - Identifying systematic correction needs
 */
export class DecisionCalibrationStore {
  // In-memory storage (would be persistent in production)
  private calibrations: DecisionTimeCalibration[] = []
  
  /**
   * Record a decision-time calibration
   */
  async recordCalibration(calibration: DecisionTimeCalibration): Promise<void> {
    this.calibrations.push(calibration)
  }
  
  /**
   * Get recent calibrations for a tenant
   */
  async getRecentCalibrations(
    tenantId: string,
    limit: number = 100
  ): Promise<DecisionTimeCalibration[]> {
    const results = this.calibrations
      .filter(c => c.tenantId === tenantId)
      .sort((a, b) => b.calibratedAt.getTime() - a.calibratedAt.getTime())
      .slice(0, limit)
    
    return results
  }
  
  /**
   * Get calibration statistics for a tenant
   */
  async getCalibrationStats(
    tenantId: string
  ): Promise<{
    totalCalibrations: number
    riskAdjustments: number
    strategySwaps: number
    providerReroutes: number
    averageRiskReduction: number
    averageSuccessIncrease: number
    averageConfidence: number
  }> {
    const calibrations = this.calibrations.filter(c => c.tenantId === tenantId)
    
    if (calibrations.length === 0) {
      return {
        totalCalibrations: 0,
        riskAdjustments: 0,
        strategySwaps: 0,
        providerReroutes: 0,
        averageRiskReduction: 0,
        averageSuccessIncrease: 0,
        averageConfidence: 0
      }
    }
    
    let riskAdjustments = 0
    let strategySwaps = 0
    let providerReroutes = 0
    let totalRiskReduction = 0
    let totalSuccessIncrease = 0
    let totalConfidence = 0
    
    for (const cal of calibrations) {
      if (cal.riskCalibration.adjustment !== 0) {
        riskAdjustments++
      }
      
      if (cal.strategyCalibration.swapped) {
        strategySwaps++
      }
      
      if (cal.providerCalibration?.rerouted) {
        providerReroutes++
      }
      
      totalRiskReduction += cal.aggregateImpact.riskReduction
      totalSuccessIncrease += cal.aggregateImpact.successProbabilityIncrease
      totalConfidence += cal.confidence
    }
    
    return {
      totalCalibrations: calibrations.length,
      riskAdjustments,
      strategySwaps,
      providerReroutes,
      averageRiskReduction: totalRiskReduction / calibrations.length,
      averageSuccessIncrease: totalSuccessIncrease / calibrations.length,
      averageConfidence: totalConfidence / calibrations.length
    }
  }
  
  /**
   * Get most recent risk adjustments
   */
  async getRecentRiskAdjustments(
    tenantId: string,
    limit: number = 50
  ): Promise<Array<{
    originalRisk: number
    calibratedRisk: number
    adjustment: number
    reason: string
    calibratedAt: Date
  }>> {
    return this.calibrations
      .filter(c => c.tenantId === tenantId && c.riskCalibration.adjustment !== 0)
      .map(c => ({
        originalRisk: c.riskCalibration.originalRisk,
        calibratedRisk: c.riskCalibration.calibratedRisk,
        adjustment: c.riskCalibration.adjustment,
        reason: c.riskCalibration.reason,
        calibratedAt: c.calibratedAt
      }))
      .sort((a, b) => b.calibratedAt.getTime() - a.calibratedAt.getTime())
      .slice(0, limit)
  }
  
  /**
   * Get strategy swap history
   */
  async getStrategySwapHistory(
    tenantId: string,
    limit: number = 50
  ): Promise<Array<{
    originalStrategy: string
    recommendedStrategy: string
    reason: string
    confidenceIncrease: number
    calibratedAt: Date
  }>> {
    return this.calibrations
      .filter(c => c.tenantId === tenantId && c.strategyCalibration.swapped)
      .map(c => ({
        originalStrategy: c.strategyCalibration.originalStrategy,
        recommendedStrategy: c.strategyCalibration.recommendedStrategy,
        reason: c.strategyCalibration.reason,
        confidenceIncrease: c.strategyCalibration.confidenceIncrease,
        calibratedAt: c.calibratedAt
      }))
      .sort((a, b) => b.calibratedAt.getTime() - a.calibratedAt.getTime())
      .slice(0, limit)
  }
  
  /**
   * Clear old calibrations
   */
  async clearOldCalibrations(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now()
    const originalLength = this.calibrations.length
    
    this.calibrations = this.calibrations.filter(
      c => now - c.calibratedAt.getTime() <= olderThanMs
    )
    
    return originalLength - this.calibrations.length
  }
  
  /**
   * Get overall statistics
   */
  async getStats(): Promise<{
    totalCalibrations: number
    tenantsWithCalibrations: number
    calibrationsLast24h: number
    calibrationsLast7d: number
  }> {
    const tenants = new Set<string>()
    const now = Date.now()
    let last24h = 0
    let last7d = 0
    
    for (const cal of this.calibrations) {
      tenants.add(cal.tenantId)
      
      const age = now - cal.calibratedAt.getTime()
      if (age <= 24 * 60 * 60 * 1000) {
        last24h++
      }
      if (age <= 7 * 24 * 60 * 60 * 1000) {
        last7d++
      }
    }
    
    return {
      totalCalibrations: this.calibrations.length,
      tenantsWithCalibrations: tenants.size,
      calibrationsLast24h: last24h,
      calibrationsLast7d: last7d
    }
  }
}

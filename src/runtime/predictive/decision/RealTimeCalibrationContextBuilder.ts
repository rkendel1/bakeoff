import type { CalibrationContext } from './types.js'
import type { PredictionAccuracyStore } from '../calibration/PredictionAccuracyStore.js'
import type { CalibrationStore } from '../calibration/CalibrationStore.js'
import type { StrategyDecayDetector } from '../StrategyDecayDetector.js'
import type { StrategyBiasStore } from './StrategyBiasStore.js'

/**
 * RealTimeCalibrationContextBuilder - Builds live correction context
 * 
 * This builds the "lens" through which decisions are made.
 * 
 * It synthesizes:
 * - Prediction accuracy history
 * - Drift state
 * - Strategy decay signals
 * - Provider reliability trends
 * - Learned biases
 * 
 * Into:
 * - A calibration context that adjusts decision-making in real-time
 * 
 * Key insight:
 * The calibration context is the real-time representation of:
 * "What we've learned about how wrong our predictions are"
 * 
 * This becomes the correction filter applied to all predictions.
 */
export class RealTimeCalibrationContextBuilder {
  // Context cache duration (5 minutes)
  private readonly CONTEXT_CACHE_MS = 5 * 60 * 1000
  
  // Context validity duration (15 minutes)
  private readonly CONTEXT_VALIDITY_MS = 15 * 60 * 1000
  
  // Cached contexts
  private contextCache: Map<string, {
    context: CalibrationContext
    cachedAt: Date
  }> = new Map()
  
  constructor(
    private readonly accuracyStore: PredictionAccuracyStore,
    private readonly calibrationStore: CalibrationStore,
    private readonly decayDetector: StrategyDecayDetector,
    private readonly biasStore: StrategyBiasStore
  ) {}
  
  /**
   * Build calibration context for a tenant
   * 
   * This is the main entry point.
   * Returns a context that can be used to adjust decisions.
   */
  async buildContext(tenantId: string): Promise<CalibrationContext> {
    // Check cache
    const cached = this.contextCache.get(tenantId)
    if (cached) {
      const age = Date.now() - cached.cachedAt.getTime()
      if (age < this.CONTEXT_CACHE_MS) {
        return cached.context
      }
    }
    
    // Build fresh context
    const context = await this.buildFreshContext(tenantId)
    
    // Cache it
    this.contextCache.set(tenantId, {
      context,
      cachedAt: new Date()
    })
    
    return context
  }
  
  /**
   * Build a fresh context (no cache)
   */
  private async buildFreshContext(tenantId: string): Promise<CalibrationContext> {
    const now = new Date()
    const validUntil = new Date(now.getTime() + this.CONTEXT_VALIDITY_MS)
    
    // Get prediction accuracy for each model
    const predictionAccuracy = await this.getPredictionAccuracy(tenantId)
    
    // Get bias adjustments
    const biasAdjustments = await this.getBiasAdjustments(tenantId)
    
    // Get drift state
    const driftState = await this.getDriftState(tenantId)
    
    // Get strategy preferences
    const strategyPreferences = await this.getStrategyPreferences(tenantId)
    
    // Get provider reliability bias
    const providerReliabilityBias = await this.getProviderReliabilityBias(tenantId)
    
    // Get confidence scaling factors
    const confidenceScaling = this.calculateConfidenceScaling(
      predictionAccuracy,
      driftState
    )
    
    // Calculate overall confidence in this context
    const confidence = this.calculateContextConfidence(
      predictionAccuracy,
      driftState,
      strategyPreferences
    )
    
    return {
      tenantId,
      predictionAccuracy,
      biasAdjustments,
      driftState,
      strategyPreferences,
      providerReliabilityBias,
      confidenceScaling,
      generatedAt: now,
      validUntil,
      confidence
    }
  }
  
  /**
   * Get current prediction accuracy for all models
   */
  private async getPredictionAccuracy(tenantId: string): Promise<{
    riskEngine: number
    entropyForecaster: number
    decayDetector: number
    failureAnalyzer: number
    goalForecaster: number
  }> {
    // Get accuracy metrics from store
    const riskAccuracy = await this.accuracyStore.getLatest(tenantId, 'risk_engine')
    const entropyAccuracy = await this.accuracyStore.getLatest(tenantId, 'entropy_forecaster')
    const decayAccuracy = await this.accuracyStore.getLatest(tenantId, 'decay_detector')
    const failureAccuracy = await this.accuracyStore.getLatest(tenantId, 'failure_analyzer')
    const goalAccuracy = await this.accuracyStore.getLatest(tenantId, 'goal_forecaster')
    
    return {
      riskEngine: riskAccuracy?.overallAccuracy || 0.8,  // Default to 0.8 if no data
      entropyForecaster: entropyAccuracy?.overallAccuracy || 0.85,
      decayDetector: decayAccuracy?.overallAccuracy || 0.75,
      failureAnalyzer: failureAccuracy?.overallAccuracy || 0.82,
      goalForecaster: goalAccuracy?.overallAccuracy || 0.78
    }
  }
  
  /**
   * Get bias adjustments for models
   */
  private async getBiasAdjustments(tenantId: string): Promise<{
    riskEngine: number
    entropyModel: number
    decayModel: number
  }> {
    // Get accuracy metrics to detect bias
    const riskAccuracy = await this.accuracyStore.getLatest(tenantId, 'risk_engine')
    const entropyAccuracy = await this.accuracyStore.getLatest(tenantId, 'entropy_forecaster')
    const decayAccuracy = await this.accuracyStore.getLatest(tenantId, 'decay_detector')
    
    // Bias score: positive = overconfident, negative = underconfident
    const riskBias = riskAccuracy?.biasScore || 0
    const entropyBias = entropyAccuracy?.biasScore || 0
    const decayBias = decayAccuracy?.biasScore || 0
    
    return {
      riskEngine: -riskBias,        // Invert bias to get correction
      entropyModel: -entropyBias,
      decayModel: -decayBias
    }
  }
  
  /**
   * Get drift state for models
   */
  private async getDriftState(tenantId: string): Promise<{
    riskEngineDrift: number
    strategyDrift: number
    providerDrift: number
    criticalDrift: boolean
  }> {
    // Get drift metrics from calibration store
    const riskState = await this.calibrationStore.getState(tenantId, 'risk_engine')
    const strategyState = await this.calibrationStore.getState(tenantId, 'decay_detector')
    
    const riskDrift = riskState?.driftMagnitude || 0
    const strategyDrift = strategyState?.driftMagnitude || 0
    
    // For now, provider drift is estimated from strategy drift
    const providerDrift = strategyDrift * 0.7  // Correlated with strategy drift
    
    // Critical drift if any drift exceeds 0.3
    const criticalDrift = riskDrift > 0.3 || strategyDrift > 0.3 || providerDrift > 0.3
    
    return {
      riskEngineDrift: riskDrift,
      strategyDrift,
      providerDrift,
      criticalDrift
    }
  }
  
  /**
   * Get strategy preferences from learned biases
   */
  private async getStrategyPreferences(tenantId: string): Promise<{
    [strategyName: string]: number
  }> {
    const biases = await this.biasStore.getBiasesForTenant(tenantId)
    
    const preferences: { [strategyName: string]: number } = {}
    
    for (const bias of biases) {
      // Convert bias to weight multiplier
      // Positive bias → higher weight
      // Negative bias → lower weight
      preferences[bias.strategyName] = bias.biasWeight
    }
    
    return preferences
  }
  
  /**
   * Get provider reliability bias
   * 
   * This would be computed from provider stability metrics.
   * For now, returns neutral (1.0) for all providers.
   */
  private async getProviderReliabilityBias(tenantId: string): Promise<{
    [provider: string]: number
  }> {
    // TODO: Integrate with provider stability tracking
    // For now, return neutral bias for all providers
    return {
      'docusign': 1.0,
      'docuseal': 1.0,
      'adobe_sign': 1.0
    }
  }
  
  /**
   * Calculate confidence scaling factors
   */
  private calculateConfidenceScaling(
    predictionAccuracy: {
      riskEngine: number
      entropyForecaster: number
      decayDetector: number
      failureAnalyzer: number
      goalForecaster: number
    },
    driftState: {
      riskEngineDrift: number
      strategyDrift: number
      providerDrift: number
      criticalDrift: boolean
    }
  ): {
    riskEngine: number
    strategySelection: number
  } {
    // Scale confidence based on accuracy and drift
    // Lower accuracy → lower confidence
    // Higher drift → lower confidence
    
    const riskEngineScaling = predictionAccuracy.riskEngine * (1 - driftState.riskEngineDrift * 0.5)
    const strategyScaling = predictionAccuracy.decayDetector * (1 - driftState.strategyDrift * 0.5)
    
    return {
      riskEngine: Math.max(0.5, Math.min(1.0, riskEngineScaling)),
      strategySelection: Math.max(0.5, Math.min(1.0, strategyScaling))
    }
  }
  
  /**
   * Calculate overall confidence in this context
   */
  private calculateContextConfidence(
    predictionAccuracy: {
      riskEngine: number
      entropyForecaster: number
      decayDetector: number
      failureAnalyzer: number
      goalForecaster: number
    },
    driftState: {
      riskEngineDrift: number
      strategyDrift: number
      providerDrift: number
      criticalDrift: boolean
    },
    strategyPreferences: { [strategyName: string]: number }
  ): number {
    // Average prediction accuracy
    const avgAccuracy = (
      predictionAccuracy.riskEngine +
      predictionAccuracy.entropyForecaster +
      predictionAccuracy.decayDetector +
      predictionAccuracy.failureAnalyzer +
      predictionAccuracy.goalForecaster
    ) / 5
    
    // Average drift (inverted)
    const avgDrift = (
      driftState.riskEngineDrift +
      driftState.strategyDrift +
      driftState.providerDrift
    ) / 3
    const driftConfidence = 1 - avgDrift
    
    // Strategy bias confidence (based on sample sizes)
    // For now, assume high confidence if we have strategy preferences
    const strategyBiasConfidence = Object.keys(strategyPreferences).length > 0 ? 0.85 : 0.6
    
    // Combine factors
    const confidence = (avgAccuracy * 0.5) + (driftConfidence * 0.3) + (strategyBiasConfidence * 0.2)
    
    return Math.max(0, Math.min(1, confidence))
  }
  
  /**
   * Clear context cache
   */
  clearCache(): void {
    this.contextCache.clear()
  }
  
  /**
   * Clear old cached contexts
   */
  clearOldCache(): void {
    const now = Date.now()
    
    for (const [tenantId, cached] of this.contextCache) {
      const age = now - cached.cachedAt.getTime()
      if (age > this.CONTEXT_CACHE_MS * 2) {  // Clear if > 10 minutes old
        this.contextCache.delete(tenantId)
      }
    }
  }
}

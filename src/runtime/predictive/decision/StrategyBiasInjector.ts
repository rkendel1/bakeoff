import type { StrategySelection } from '../../intent/types.js'
import type { CalibrationContext, StrategyBias } from './types.js'
import type { StrategyBiasStore } from './StrategyBiasStore.js'

/**
 * StrategyBiasInjector - Applies learned bias adjustments
 * 
 * This applies learned corrections to strategy selection.
 * 
 * Examples:
 * - Avoid declining strategies
 * - Prefer historically stable providers
 * - Penalize high-entropy execution paths
 * - Favor high-calibration-confidence models
 * 
 * Key insight:
 * Strategy selection bias = learned wisdom from past mistakes
 * 
 * This transforms:
 * FROM: "This strategy has 80% historical success"
 * TO:   "This strategy has 80% historical success, but our model
 *        overestimates it by 15%, so real success is ~65%"
 */
export class StrategyBiasInjector {
  // Bias application thresholds
  private readonly AVOID_THRESHOLD = 0.6       // Weight < 0.6 → avoid
  private readonly PREFER_THRESHOLD = 1.3      // Weight > 1.3 → prefer
  private readonly MIN_SAMPLE_SIZE = 5         // Min samples for bias
  
  constructor(
    private readonly biasStore: StrategyBiasStore
  ) {}
  
  /**
   * Apply bias corrections to strategy selection
   * 
   * This is the main entry point.
   */
  async applyBias(
    tenantId: string,
    goalId: string,
    strategySelection: StrategySelection,
    context: CalibrationContext
  ): Promise<{
    adjustedSelection: StrategySelection
    biasApplied: boolean
    adjustments: Array<{
      strategy: string
      originalConfidence: number
      adjustedConfidence: number
      reason: string
    }>
  }> {
    // Get biases for this goal
    const biases = await this.biasStore.getBiasesForGoal(tenantId, goalId)
    
    // If no biases learned yet, return unchanged
    if (biases.length === 0) {
      return {
        adjustedSelection: strategySelection,
        biasApplied: false,
        adjustments: []
      }
    }
    
    // Apply bias to selected strategy
    const selectedBias = biases.find(b => b.strategyName === strategySelection.selectedStrategy)
    
    const adjustments: Array<{
      strategy: string
      originalConfidence: number
      adjustedConfidence: number
      reason: string
    }> = []
    
    let adjustedSelection = { ...strategySelection }
    let biasApplied = false
    
    // Check if selected strategy should be avoided
    if (selectedBias) {
      const adjustment = this.applyStrategyBias(
        strategySelection.selectedStrategy,
        strategySelection.confidence,
        selectedBias,
        context
      )
      
      if (adjustment.shouldSwap) {
        // Find alternative strategy
        const alternative = await this.findAlternativeStrategy(
          tenantId,
          goalId,
          strategySelection,
          biases,
          context
        )
        
        if (alternative) {
          adjustedSelection = {
            ...strategySelection,
            selectedStrategy: alternative.strategy,
            confidence: alternative.confidence,
            rationale: [
              ...strategySelection.rationale,
              `Strategy swapped due to learned bias: ${adjustment.reason}`
            ]
          }
          
          adjustments.push({
            strategy: strategySelection.selectedStrategy,
            originalConfidence: strategySelection.confidence,
            adjustedConfidence: alternative.confidence,
            reason: adjustment.reason
          })
          
          biasApplied = true
        }
      } else if (adjustment.adjusted) {
        // Adjust confidence but keep strategy
        adjustedSelection = {
          ...strategySelection,
          confidence: adjustment.adjustedConfidence,
          expectedSuccessProbability: adjustment.adjustedSuccessProbability,
          rationale: [
            ...strategySelection.rationale,
            `Confidence adjusted due to learned bias: ${adjustment.reason}`
          ]
        }
        
        adjustments.push({
          strategy: strategySelection.selectedStrategy,
          originalConfidence: strategySelection.confidence,
          adjustedConfidence: adjustment.adjustedConfidence,
          reason: adjustment.reason
        })
        
        biasApplied = true
      }
    }
    
    return {
      adjustedSelection,
      biasApplied,
      adjustments
    }
  }
  
  /**
   * Apply bias to a strategy
   */
  private applyStrategyBias(
    strategyName: string,
    currentConfidence: number,
    bias: StrategyBias,
    context: CalibrationContext
  ): {
    adjusted: boolean
    shouldSwap: boolean
    adjustedConfidence: number
    adjustedSuccessProbability: number
    reason: string
  } {
    // Only apply if we have enough samples
    if (bias.sampleSize < this.MIN_SAMPLE_SIZE) {
      return {
        adjusted: false,
        shouldSwap: false,
        adjustedConfidence: currentConfidence,
        adjustedSuccessProbability: 0,
        reason: 'Insufficient sample size for bias correction'
      }
    }
    
    // Check if strategy is declining
    if (bias.recommendAvoid || bias.biasWeight < this.AVOID_THRESHOLD) {
      return {
        adjusted: true,
        shouldSwap: true,
        adjustedConfidence: currentConfidence * bias.biasWeight,
        adjustedSuccessProbability: bias.historicalSuccessRate,
        reason: `Strategy ${strategyName} has declining performance (weight: ${bias.biasWeight.toFixed(2)})`
      }
    }
    
    // Apply bias weight to confidence
    const adjustedConfidence = currentConfidence * bias.biasWeight
    
    // Apply bias magnitude to success probability
    const adjustedSuccessProbability = bias.historicalSuccessRate
    
    // Decide if adjustment is significant enough
    const confidenceDelta = Math.abs(adjustedConfidence - currentConfidence)
    
    if (confidenceDelta > 0.1) {
      return {
        adjusted: true,
        shouldSwap: false,
        adjustedConfidence,
        adjustedSuccessProbability,
        reason: `Historical bias detected: predicted ${bias.predictedSuccessRate.toFixed(2)}, actual ${bias.historicalSuccessRate.toFixed(2)}`
      }
    }
    
    return {
      adjusted: false,
      shouldSwap: false,
      adjustedConfidence: currentConfidence,
      adjustedSuccessProbability: 0,
      reason: 'No significant bias correction needed'
    }
  }
  
  /**
   * Find alternative strategy when current one should be avoided
   */
  private async findAlternativeStrategy(
    tenantId: string,
    goalId: string,
    currentSelection: StrategySelection,
    allBiases: StrategyBias[],
    context: CalibrationContext
  ): Promise<{
    strategy: string
    confidence: number
  } | null> {
    // Look at fallback strategies
    for (const fallback of currentSelection.fallbackStrategies) {
      const bias = allBiases.find(b => b.strategyName === fallback.strategy)
      
      // If no bias, or bias is positive, use this strategy
      if (!bias || (bias.biasWeight >= 1.0 && !bias.recommendAvoid)) {
        // Apply context preference if available
        const contextWeight = context.strategyPreferences[fallback.strategy] || 1.0
        
        return {
          strategy: fallback.strategy,
          confidence: fallback.confidence * contextWeight
        }
      }
    }
    
    // No suitable alternative found
    return null
  }
  
  /**
   * Get strategy recommendations based on bias
   */
  async getStrategyRecommendations(
    tenantId: string,
    goalId: string
  ): Promise<{
    avoid: string[]
    prefer: string[]
    neutral: string[]
  }> {
    const biases = await this.biasStore.getBiasesForGoal(tenantId, goalId)
    
    const avoid: string[] = []
    const prefer: string[] = []
    const neutral: string[] = []
    
    for (const bias of biases) {
      if (bias.sampleSize < this.MIN_SAMPLE_SIZE) {
        neutral.push(bias.strategyName)
      } else if (bias.recommendAvoid || bias.biasWeight < this.AVOID_THRESHOLD) {
        avoid.push(bias.strategyName)
      } else if (bias.recommendPrefer || bias.biasWeight > this.PREFER_THRESHOLD) {
        prefer.push(bias.strategyName)
      } else {
        neutral.push(bias.strategyName)
      }
    }
    
    return { avoid, prefer, neutral }
  }
  
  /**
   * Update strategy bias from outcome
   * 
   * This is called after execution to update learned biases.
   */
  async updateBiasFromOutcome(
    tenantId: string,
    goalId: string,
    strategyName: string,
    predictedSuccess: number,
    actualSuccess: boolean,
    sampleSize: number
  ): Promise<void> {
    // Get existing bias
    const existingBias = await this.biasStore.getBias(tenantId, goalId, strategyName)
    
    // Calculate updated bias
    let historicalSuccessRate: number
    let newSampleSize: number
    
    if (existingBias) {
      // Update running average
      const totalSuccess = existingBias.historicalSuccessRate * existingBias.sampleSize
      const newTotalSuccess = totalSuccess + (actualSuccess ? 1 : 0)
      newSampleSize = existingBias.sampleSize + 1
      historicalSuccessRate = newTotalSuccess / newSampleSize
    } else {
      // First sample
      historicalSuccessRate = actualSuccess ? 1.0 : 0.0
      newSampleSize = 1
    }
    
    // Calculate bias magnitude
    const biasMagnitude = historicalSuccessRate - predictedSuccess
    
    // Calculate bias weight
    // Positive bias → weight > 1.0 (strategy performs better than predicted)
    // Negative bias → weight < 1.0 (strategy performs worse than predicted)
    const biasWeight = predictedSuccess > 0
      ? historicalSuccessRate / predictedSuccess
      : 1.0
    
    // Determine trend (simplified)
    let recentPerformance: 'improving' | 'stable' | 'declining' = 'stable'
    if (existingBias) {
      if (historicalSuccessRate > existingBias.historicalSuccessRate + 0.1) {
        recentPerformance = 'improving'
      } else if (historicalSuccessRate < existingBias.historicalSuccessRate - 0.1) {
        recentPerformance = 'declining'
      }
    }
    
    // Determine recommendations
    const recommendAvoid = biasWeight < this.AVOID_THRESHOLD && newSampleSize >= this.MIN_SAMPLE_SIZE
    const recommendPrefer = biasWeight > this.PREFER_THRESHOLD && newSampleSize >= this.MIN_SAMPLE_SIZE
    
    // Calculate confidence
    const confidence = Math.min(1.0, newSampleSize / 50)  // Full confidence at 50+ samples
    
    // Store updated bias
    await this.biasStore.recordBias({
      strategyName,
      goalId,
      tenantId,
      historicalSuccessRate,
      predictedSuccessRate: predictedSuccess,
      biasMagnitude,
      recentPerformance,
      decayDetected: recentPerformance === 'declining',
      biasWeight,
      recommendAvoid,
      recommendPrefer,
      sampleSize: newSampleSize,
      lastUpdated: new Date(),
      confidence
    })
  }
}

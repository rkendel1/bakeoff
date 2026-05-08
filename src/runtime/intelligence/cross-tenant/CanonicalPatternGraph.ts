/**
 * CanonicalPatternGraph - Global behavioral model from cross-tenant signals
 * 
 * This builds a global understanding of effective patterns WITHOUT
 * exposing any tenant-specific data.
 * 
 * Privacy guarantee: All patterns are abstracted signatures, no raw data.
 */

import type { AggregatedSignals } from './CrossTenantSignalAggregator.js'

export interface CanonicalPattern {
  patternId: string
  signature: string
  globalFrequency: number
  globalSuccessRate: number
  confidence: number
  observations: number
  firstSeen: Date
  lastSeen: Date
}

export interface ProviderReliability {
  provider: string
  successRate: number
  totalOperations: number
  confidence: number
}

export interface StrategyEffectiveness {
  strategyHash: string
  successRate: number
  avgEntropy: number
  observations: number
  confidence: number
}

export class CanonicalPatternGraph {
  private patterns = new Map<string, CanonicalPattern>()
  private providerStats = new Map<string, ProviderReliability>()
  private strategyStats = new Map<string, StrategyEffectiveness>()
  
  private globalEntropy: number = 0
  private globalConvergence: number = 0
  private totalObservations: number = 0

  /**
   * Ingest aggregated signals and update global patterns
   */
  ingest(signals: AggregatedSignals): void {
    this.updateTransitionPatterns(signals.transitionSignatures)
    this.updateProviderReliability(signals.providerEffectiveness)
    this.updateStrategyEffectiveness(signals.strategyDistributions)
    this.updateGlobalMetrics(signals.convergenceTrends)
    this.totalObservations++
  }

  /**
   * Get most reliable patterns
   */
  getTopPatterns(limit: number = 10): CanonicalPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => {
        // Sort by confidence and success rate
        const scoreA = a.confidence * 0.5 + a.globalSuccessRate * 0.5
        const scoreB = b.confidence * 0.5 + b.globalSuccessRate * 0.5
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  /**
   * Get provider reliability rankings
   */
  getProviderReliability(): ProviderReliability[] {
    return Array.from(this.providerStats.values())
      .sort((a, b) => b.successRate - a.successRate)
  }

  /**
   * Get most effective strategies
   */
  getTopStrategies(limit: number = 10): StrategyEffectiveness[] {
    return Array.from(this.strategyStats.values())
      .filter(s => s.observations >= 3) // Minimum observations for confidence
      .sort((a, b) => {
        const scoreA = a.successRate * 0.7 + (1 - a.avgEntropy) * 0.3
        const scoreB = b.successRate * 0.7 + (1 - b.avgEntropy) * 0.3
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  /**
   * Get global health metrics
   */
  getGlobalMetrics() {
    return {
      avgEntropy: this.globalEntropy,
      avgConvergence: this.globalConvergence,
      totalPatterns: this.patterns.size,
      totalObservations: this.totalObservations,
      reliablePatterns: Array.from(this.patterns.values()).filter(
        p => p.confidence > 0.7 && p.globalSuccessRate > 0.8
      ).length
    }
  }

  private updateTransitionPatterns(signatures: Array<{
    signature: string
    frequency: number
    successRate: number
  }>): void {
    for (const sig of signatures) {
      const existing = this.patterns.get(sig.signature)
      
      if (existing) {
        // Update existing pattern
        existing.globalFrequency += sig.frequency
        existing.globalSuccessRate = 
          (existing.globalSuccessRate * existing.observations + sig.successRate * sig.frequency) /
          (existing.observations + sig.frequency)
        existing.observations += sig.frequency
        existing.confidence = this.calculateConfidence(existing.observations)
        existing.lastSeen = new Date()
      } else {
        // Create new pattern
        const patternId = this.generatePatternId()
        this.patterns.set(sig.signature, {
          patternId,
          signature: sig.signature,
          globalFrequency: sig.frequency,
          globalSuccessRate: sig.successRate,
          confidence: this.calculateConfidence(sig.frequency),
          observations: sig.frequency,
          firstSeen: new Date(),
          lastSeen: new Date()
        })
      }
    }
  }

  private updateProviderReliability(stats: Record<string, { success: number; failures: number }>): void {
    for (const [provider, data] of Object.entries(stats)) {
      const existing = this.providerStats.get(provider)
      const total = data.success + data.failures
      const successRate = total > 0 ? data.success / total : 0

      if (existing) {
        const newTotal = existing.totalOperations + total
        existing.successRate = 
          (existing.successRate * existing.totalOperations + successRate * total) / newTotal
        existing.totalOperations = newTotal
        existing.confidence = this.calculateConfidence(newTotal)
      } else {
        this.providerStats.set(provider, {
          provider,
          successRate,
          totalOperations: total,
          confidence: this.calculateConfidence(total)
        })
      }
    }
  }

  private updateStrategyEffectiveness(distributions: Array<{
    strategy: string
    successRate: number
    entropy: number
  }>): void {
    for (const dist of distributions) {
      const existing = this.strategyStats.get(dist.strategy)

      if (existing) {
        existing.successRate = 
          (existing.successRate * existing.observations + dist.successRate) /
          (existing.observations + 1)
        existing.avgEntropy = 
          (existing.avgEntropy * existing.observations + dist.entropy) /
          (existing.observations + 1)
        existing.observations++
        existing.confidence = this.calculateConfidence(existing.observations)
      } else {
        this.strategyStats.set(dist.strategy, {
          strategyHash: dist.strategy,
          successRate: dist.successRate,
          avgEntropy: dist.entropy,
          observations: 1,
          confidence: this.calculateConfidence(1)
        })
      }
    }
  }

  private updateGlobalMetrics(trends: { avgEntropy: number; avgConvergence: number }): void {
    // Exponential moving average
    const alpha = 0.2
    this.globalEntropy = alpha * trends.avgEntropy + (1 - alpha) * this.globalEntropy
    this.globalConvergence = alpha * trends.avgConvergence + (1 - alpha) * this.globalConvergence
  }

  private calculateConfidence(observations: number): number {
    // Confidence increases with observations, asymptotically approaching 1.0
    if (observations < 5) return 0.3
    if (observations < 20) return 0.6
    if (observations < 50) return 0.8
    return 0.95
  }

  private generatePatternId(): string {
    // Use crypto.randomUUID() for globally unique IDs
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `pattern_${crypto.randomUUID()}`
    }
    // Fallback for older Node.js versions
    return `pattern_${Date.now()}_${Math.random().toString(36).substring(7)}_${Math.random().toString(36).substring(7)}`
  }
}

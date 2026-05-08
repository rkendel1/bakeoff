/**
 * RecommendationAmplificationEngine - Amplifies recommendations using global intelligence
 * 
 * This takes the global canonical patterns and uses them to enhance
 * per-tenant recommendations WITHOUT exposing cross-tenant data.
 */

import type { CanonicalPatternGraph } from './CanonicalPatternGraph.js'

export interface GlobalRecommendation {
  type: 'pattern_adoption' | 'provider_switch' | 'strategy_optimization' | 'entropy_reduction'
  title: string
  description: string
  confidence: number
  expectedImpact: string
  actionableSteps: string[]
  evidence: {
    globalObservations: number
    globalSuccessRate: number
    source: string
  }
}

export class RecommendationAmplificationEngine {
  constructor(private patternGraph: CanonicalPatternGraph) {}

  /**
   * Generate recommendations based on global intelligence
   */
  generateRecommendations(
    tenantContext: {
      currentPatterns?: string[]
      currentProviders?: string[]
      currentStrategies?: string[]
      entropy?: number
      convergence?: number
    }
  ): GlobalRecommendation[] {
    const recommendations: GlobalRecommendation[] = []

    // Recommend high-performing patterns
    recommendations.push(...this.recommendPatterns(tenantContext))

    // Recommend reliable providers
    recommendations.push(...this.recommendProviders(tenantContext))

    // Recommend effective strategies
    recommendations.push(...this.recommendStrategies(tenantContext))

    // Recommend entropy reduction if needed
    if (tenantContext.entropy && tenantContext.entropy > 0.7) {
      recommendations.push(...this.recommendEntropyReduction(tenantContext))
    }

    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10) // Top 10 recommendations
  }

  private recommendPatterns(tenantContext: any): GlobalRecommendation[] {
    const topPatterns = this.patternGraph.getTopPatterns(5)
    const currentPatterns = new Set(tenantContext.currentPatterns || [])

    return topPatterns
      .filter(p => !currentPatterns.has(p.signature) && p.confidence > 0.7)
      .slice(0, 3)
      .map(p => ({
        type: 'pattern_adoption' as const,
        title: `Adopt High-Performing Pattern`,
        description: `Pattern ${p.patternId} has proven highly effective across the platform with ${(p.globalSuccessRate * 100).toFixed(1)}% success rate.`,
        confidence: p.confidence,
        expectedImpact: `Potential ${((p.globalSuccessRate - 0.5) * 100).toFixed(1)}% improvement in success rate`,
        actionableSteps: [
          'Review pattern signature for compatibility with your workflow',
          'Test pattern in staging environment',
          'Monitor success metrics after adoption'
        ],
        evidence: {
          globalObservations: p.observations,
          globalSuccessRate: p.globalSuccessRate,
          source: 'Cross-tenant pattern analysis'
        }
      }))
  }

  private recommendProviders(tenantContext: any): GlobalRecommendation[] {
    const providerReliability = this.patternGraph.getProviderReliability()
    const currentProviders = new Set(tenantContext.currentProviders || [])

    return providerReliability
      .filter(p => !currentProviders.has(p.provider) && p.confidence > 0.7 && p.successRate > 0.85)
      .slice(0, 2)
      .map(p => ({
        type: 'provider_switch' as const,
        title: `Consider High-Reliability Provider: ${p.provider}`,
        description: `Provider ${p.provider} demonstrates ${(p.successRate * 100).toFixed(1)}% success rate across the platform based on ${p.totalOperations} operations.`,
        confidence: p.confidence,
        expectedImpact: `Potential reliability improvement to ${(p.successRate * 100).toFixed(1)}%`,
        actionableSteps: [
          `Evaluate ${p.provider} integration requirements`,
          'Compare pricing and feature set',
          'Conduct pilot test with non-critical workflows',
          'Monitor performance metrics'
        ],
        evidence: {
          globalObservations: p.totalOperations,
          globalSuccessRate: p.successRate,
          source: 'Cross-tenant provider analysis'
        }
      }))
  }

  private recommendStrategies(tenantContext: any): GlobalRecommendation[] {
    const topStrategies = this.patternGraph.getTopStrategies(5)
    const currentStrategies = new Set(tenantContext.currentStrategies || [])

    return topStrategies
      .filter(s => !currentStrategies.has(s.strategyHash) && s.confidence > 0.6)
      .slice(0, 2)
      .map(s => ({
        type: 'strategy_optimization' as const,
        title: `Optimize with Proven Strategy`,
        description: `Strategy type has ${(s.successRate * 100).toFixed(1)}% success rate with low entropy (${s.avgEntropy.toFixed(2)}).`,
        confidence: s.confidence,
        expectedImpact: `Expected ${((s.successRate - 0.5) * 100).toFixed(1)}% improvement with reduced unpredictability`,
        actionableSteps: [
          'Analyze strategy compatibility with current goals',
          'Test strategy with subset of workflows',
          'Measure entropy reduction and success improvement',
          'Roll out gradually across workloads'
        ],
        evidence: {
          globalObservations: s.observations,
          globalSuccessRate: s.successRate,
          source: 'Cross-tenant strategy analysis'
        }
      }))
  }

  private recommendEntropyReduction(tenantContext: any): GlobalRecommendation[] {
    const metrics = this.patternGraph.getGlobalMetrics()

    if (metrics.avgEntropy < tenantContext.entropy!) {
      return [{
        type: 'entropy_reduction' as const,
        title: 'Reduce Workflow Entropy',
        description: `Your entropy (${tenantContext.entropy!.toFixed(2)}) is above platform average (${metrics.avgEntropy.toFixed(2)}). High entropy indicates unpredictable behavior.`,
        confidence: 0.8,
        expectedImpact: 'Improved predictability and reduced failure rates',
        actionableSteps: [
          'Identify most common execution paths',
          'Consolidate similar workflows',
          'Remove unused transitions',
          'Adopt canonical patterns with proven stability'
        ],
        evidence: {
          globalObservations: metrics.totalObservations,
          globalSuccessRate: metrics.avgConvergence,
          source: 'Cross-tenant entropy analysis'
        }
      }]
    }

    return []
  }
}

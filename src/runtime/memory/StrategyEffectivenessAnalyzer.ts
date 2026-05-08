import type { 
  RuntimeMemoryRecord, 
  TenantOperationalProfile, 
  MemoryInsight 
} from './types.js'
import { RuntimeMemoryStore } from './RuntimeMemoryStore.js'

/**
 * StrategyEffectivenessAnalyzer - Analyzes strategy effectiveness from memory
 * 
 * This component learns which governance strategies work best by:
 * - Analyzing historical outcomes
 * - Identifying successful patterns
 * - Detecting effectiveness trends
 * - Building tenant operational profiles
 * 
 * This is where the runtime develops "operational intuition"
 */
export class StrategyEffectivenessAnalyzer {
  // Learning confidence thresholds
  private static readonly CONFIDENCE_LOW_THRESHOLD = 5
  private static readonly CONFIDENCE_MEDIUM_THRESHOLD = 20
  private static readonly CONFIDENCE_GOOD_THRESHOLD = 50
  
  private static readonly CONFIDENCE_LOW = 0.3
  private static readonly CONFIDENCE_MEDIUM = 0.6
  private static readonly CONFIDENCE_GOOD = 0.8
  private static readonly CONFIDENCE_HIGH = 0.95
  
  // Decline detection threshold
  private static readonly DECLINE_THRESHOLD = 0.15

  constructor(private readonly memoryStore: RuntimeMemoryStore) {}

  /**
   * Build operational profile for a tenant
   * 
   * Analyzes all memory records to learn:
   * - Which strategies work best
   * - Common operational patterns
   * - Provider preferences
   * - Overall learning confidence
   */
  async buildTenantProfile(tenantId: string): Promise<TenantOperationalProfile> {
    const allRecords = await this.memoryStore.getByTenant(tenantId)

    // Get preferred strategies
    const preferredStrategies = await this.getPreferredStrategies(tenantId, allRecords)

    // Get common triggers
    const commonTriggers = this.getCommonTriggers(allRecords)

    // Get provider preferences
    const providerPreferences = this.getProviderPreferences(allRecords)

    // Calculate learning confidence based on data volume
    const learningConfidence = this.calculateLearningConfidence(allRecords.length)

    return {
      tenantId,
      preferredStrategies,
      commonTriggers,
      providerPreferences,
      totalMemoryRecords: allRecords.length,
      learningConfidence,
      profileGeneratedAt: new Date()
    }
  }

  /**
   * Get preferred strategies ranked by effectiveness
   */
  private async getPreferredStrategies(
    tenantId: string,
    records: RuntimeMemoryRecord[]
  ): Promise<Array<{ strategy: string; effectivenessScore: number; confidence: number }>> {
    // Group by strategy
    const strategyGroups = new Map<string, RuntimeMemoryRecord[]>()
    for (const record of records) {
      const strategy = record.decision.strategyApplied
      const group = strategyGroups.get(strategy) || []
      group.push(record)
      strategyGroups.set(strategy, group)
    }

    // Calculate effectiveness for each strategy
    const strategies: Array<{ strategy: string; effectivenessScore: number; confidence: number }> = []
    
    for (const [strategy, groupRecords] of strategyGroups) {
      const effectivenessScore = this.calculateAverageEffectiveness(groupRecords)
      const confidence = this.calculateLearningConfidence(groupRecords.length)
      
      strategies.push({
        strategy,
        effectivenessScore,
        confidence
      })
    }

    // Sort by effectiveness score
    return strategies.sort((a, b) => b.effectivenessScore - a.effectivenessScore)
  }

  /**
   * Get common operational triggers
   */
  private getCommonTriggers(
    records: RuntimeMemoryRecord[]
  ): Array<{ triggerType: string; frequency: number; lastOccurred: Date }> {
    // Group by trigger type
    const triggerGroups = new Map<string, RuntimeMemoryRecord[]>()
    for (const record of records) {
      const triggerType = record.trigger.type
      const group = triggerGroups.get(triggerType) || []
      group.push(record)
      triggerGroups.set(triggerType, group)
    }

    // Calculate frequency and last occurrence
    const triggers: Array<{ triggerType: string; frequency: number; lastOccurred: Date }> = []
    
    for (const [triggerType, groupRecords] of triggerGroups) {
      const lastOccurred = groupRecords.reduce((latest, r) => {
        return r.trigger.timestamp > latest ? r.trigger.timestamp : latest
      }, groupRecords[0].trigger.timestamp)

      triggers.push({
        triggerType,
        frequency: groupRecords.length,
        lastOccurred
      })
    }

    // Sort by frequency
    return triggers.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Get provider preferences learned from outcomes
   */
  private getProviderPreferences(
    records: RuntimeMemoryRecord[]
  ): Map<string, { stability: number; reliability: number; preferredFor: string[] }> {
    const providerData = new Map<string, {
      successCount: number
      totalCount: number
      actions: Set<string>
    }>()

    // Extract provider data from strategy names (e.g., "reroute:provider_a->provider_b")
    for (const record of records) {
      const strategy = record.decision.strategyApplied
      const rerouteMatch = strategy.match(/reroute:.+->(.+)/)
      
      if (rerouteMatch) {
        const provider = rerouteMatch[1]
        const data = providerData.get(provider) || {
          successCount: 0,
          totalCount: 0,
          actions: new Set<string>()
        }

        data.totalCount++
        if (record.outcome.status === 'completed') {
          data.successCount++
        }

        // Extract actions from enforcement actions
        for (const action of record.decision.enforcementActions) {
          if (action.metadata?.action) {
            data.actions.add(action.metadata.action as string)
          }
        }

        providerData.set(provider, data)
      }
    }

    // Convert to final format
    const preferences = new Map<string, {
      stability: number
      reliability: number
      preferredFor: string[]
    }>()

    for (const [provider, data] of providerData) {
      const reliability = data.totalCount > 0 ? data.successCount / data.totalCount : 0
      
      preferences.set(provider, {
        stability: reliability,  // Using reliability as stability proxy
        reliability,
        preferredFor: Array.from(data.actions)
      })
    }

    return preferences
  }

  /**
   * Calculate average effectiveness from records
   */
  private calculateAverageEffectiveness(records: RuntimeMemoryRecord[]): number {
    if (records.length === 0) return 0
    
    const sum = records.reduce((total, r) => total + r.effectiveness.score, 0)
    return sum / records.length
  }

  /**
   * Calculate learning confidence based on sample size
   * 
   * Confidence increases with more data points:
   * - < 5 samples: low confidence (0.3)
   * - 5-20 samples: medium confidence (0.6)
   * - 20-50 samples: good confidence (0.8)
   * - 50+ samples: high confidence (0.95)
   */
  private calculateLearningConfidence(sampleSize: number): number {
    if (sampleSize < StrategyEffectivenessAnalyzer.CONFIDENCE_LOW_THRESHOLD) {
      return StrategyEffectivenessAnalyzer.CONFIDENCE_LOW
    }
    if (sampleSize < StrategyEffectivenessAnalyzer.CONFIDENCE_MEDIUM_THRESHOLD) {
      return StrategyEffectivenessAnalyzer.CONFIDENCE_MEDIUM
    }
    if (sampleSize < StrategyEffectivenessAnalyzer.CONFIDENCE_GOOD_THRESHOLD) {
      return StrategyEffectivenessAnalyzer.CONFIDENCE_GOOD
    }
    return StrategyEffectivenessAnalyzer.CONFIDENCE_HIGH
  }

  /**
   * Recommend best strategy for a given trigger
   * 
   * This is the key method for experience-informed governance.
   * Returns the strategy with highest historical effectiveness.
   */
  async recommendStrategy(
    tenantId: string,
    triggerType: string
  ): Promise<{
    strategy: string
    effectivenessScore: number
    confidence: number
    historicalData: {
      timesApplied: number
      successRate: number
      avgRetryReduction: number
    }
  } | null> {
    const patterns = await this.memoryStore.getMostEffectiveStrategies(
      tenantId,
      triggerType,
      1
    )

    if (patterns.length === 0) {
      return null
    }

    const best = patterns[0]
    const confidence = this.calculateLearningConfidence(best.timesApplied)

    return {
      strategy: best.strategyName,
      effectivenessScore: best.effectivenessScore,
      confidence,
      historicalData: {
        timesApplied: best.timesApplied,
        successRate: best.successRate,
        avgRetryReduction: best.averageRetryReduction
      }
    }
  }

  /**
   * Generate insights from memory
   * 
   * Analyzes memory to detect:
   * - Declining strategy effectiveness
   * - Emerging patterns
   * - Unusual operational changes
   */
  async generateInsights(tenantId: string): Promise<MemoryInsight[]> {
    const insights: MemoryInsight[] = []
    const records = await this.memoryStore.getRecent(tenantId, 100)

    if (records.length === 0) {
      return insights
    }

    // Detect declining strategies
    const decliningStrategies = await this.detectDecliningStrategies(tenantId)
    for (const strategy of decliningStrategies) {
      insights.push({
        type: 'effectiveness_change',
        severity: 'warning',
        message: `Strategy "${strategy}" effectiveness is declining`,
        data: { strategy },
        generatedAt: new Date()
      })
    }

    // Detect new patterns
    const recentTriggers = this.getCommonTriggers(records.slice(0, 20))
    const allTriggers = this.getCommonTriggers(records)
    
    for (const recent of recentTriggers) {
      const historical = allTriggers.find((t) => t.triggerType === recent.triggerType)
      if (historical && recent.frequency / records.slice(0, 20).length > 
          historical.frequency / records.length * 1.5) {
        insights.push({
          type: 'pattern_detected',
          severity: 'info',
          message: `Increased frequency of ${recent.triggerType} triggers detected`,
          data: { 
            triggerType: recent.triggerType,
            recentFrequency: recent.frequency,
            historicalFrequency: historical.frequency
          },
          generatedAt: new Date()
        })
      }
    }

    // Recommend high-performing strategies
    const profile = await this.buildTenantProfile(tenantId)
    for (const pref of profile.preferredStrategies.slice(0, 3)) {
      if (pref.effectivenessScore > 0.8 && pref.confidence > 0.7) {
        insights.push({
          type: 'strategy_recommendation',
          severity: 'info',
          message: `High-performing strategy available: ${pref.strategy}`,
          data: {
            strategy: pref.strategy,
            effectiveness: pref.effectivenessScore,
            confidence: pref.confidence
          },
          generatedAt: new Date()
        })
      }
    }

    return insights
  }

  /**
   * Detect strategies with declining effectiveness
   */
  private async detectDecliningStrategies(tenantId: string): Promise<string[]> {
    const records = await this.memoryStore.getByTenant(tenantId)
    
    // Group by strategy
    const strategyGroups = new Map<string, RuntimeMemoryRecord[]>()
    for (const record of records) {
      const strategy = record.decision.strategyApplied
      const group = strategyGroups.get(strategy) || []
      group.push(record)
      strategyGroups.set(strategy, group)
    }

    const declining: string[] = []

    for (const [strategy, groupRecords] of strategyGroups) {
      if (groupRecords.length < 10) continue  // Need enough data

      // Sort by time
      const sorted = [...groupRecords].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )

      const midpoint = Math.floor(sorted.length / 2)
      const firstHalf = sorted.slice(0, midpoint)
      const secondHalf = sorted.slice(midpoint)

      const avgFirst = this.calculateAverageEffectiveness(firstHalf)
      const avgSecond = this.calculateAverageEffectiveness(secondHalf)

      // Declining if second half is significantly worse
      if (avgSecond < avgFirst - StrategyEffectivenessAnalyzer.DECLINE_THRESHOLD) {
        declining.push(strategy)
      }
    }

    return declining
  }
}

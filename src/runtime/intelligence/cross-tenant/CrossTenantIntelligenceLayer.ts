/**
 * CrossTenantIntelligenceLayer - Global intelligence orchestrator
 * 
 * This is the main coordinator that:
 * 1. Collects anonymized snapshots from tenant runtimes
 * 2. Aggregates them using CrossTenantSignalAggregator
 * 3. Updates CanonicalPatternGraph with global patterns
 * 4. Generates amplified recommendations
 * 
 * ARCHITECTURAL GUARANTEE:
 * - Tenant runtimes remain fully isolated
 * - Only abstracted signals cross tenant boundaries
 * - No raw execution data is ever shared
 */

import type { TenantRuntimeRegistry } from '../../tenant/TenantRuntimeRegistry.js'
import { CrossTenantSignalAggregator, type TenantSnapshot } from './CrossTenantSignalAggregator.js'
import { CanonicalPatternGraph } from './CanonicalPatternGraph.js'
import { RecommendationAmplificationEngine, type GlobalRecommendation } from './RecommendationAmplificationEngine.js'

export class CrossTenantIntelligenceLayer {
  private aggregator: CrossTenantSignalAggregator
  private patternGraph: CanonicalPatternGraph
  private recommendationEngine: RecommendationAmplificationEngine

  constructor(private registry: TenantRuntimeRegistry) {
    this.aggregator = new CrossTenantSignalAggregator()
    this.patternGraph = new CanonicalPatternGraph()
    this.recommendationEngine = new RecommendationAmplificationEngine(this.patternGraph)
  }

  /**
   * Collect anonymized snapshots from all tenants and update global intelligence
   */
  async collectAndLearn(): Promise<void> {
    const tenantIds = this.registry.getAllTenantIds()
    const snapshots: TenantSnapshot[] = []

    // Collect anonymized snapshots from each tenant
    for (const tenantId of tenantIds) {
      const snapshot = await this.collectTenantSnapshot(tenantId)
      if (snapshot) {
        snapshots.push(snapshot)
      }
    }

    // Aggregate signals (privacy-preserving)
    const signals = this.aggregator.aggregate(snapshots)

    // Update global pattern graph
    this.patternGraph.ingest(signals)
  }

  /**
   * Get global recommendations for a specific tenant
   */
  getRecommendationsForTenant(
    tenantId: string,
    context?: {
      currentPatterns?: string[]
      currentProviders?: string[]
      currentStrategies?: string[]
    }
  ): GlobalRecommendation[] {
    // Get tenant's current state (if provided)
    const tenantContext = context || this.getTenantContext(tenantId)

    // Generate recommendations using global intelligence
    return this.recommendationEngine.generateRecommendations(tenantContext)
  }

  /**
   * Get global metrics and health
   */
  getGlobalMetrics() {
    return this.patternGraph.getGlobalMetrics()
  }

  /**
   * Get top patterns globally
   */
  getTopPatterns(limit: number = 10) {
    return this.patternGraph.getTopPatterns(limit)
  }

  /**
   * Get provider reliability rankings
   */
  getProviderReliability() {
    return this.patternGraph.getProviderReliability()
  }

  /**
   * Get most effective strategies
   */
  getTopStrategies(limit: number = 10) {
    return this.patternGraph.getTopStrategies(limit)
  }

  /**
   * Collect anonymized snapshot from a single tenant
   * IMPORTANT: This MUST NOT expose raw execution data
   */
  private async collectTenantSnapshot(tenantId: string): Promise<TenantSnapshot | null> {
    const runtime = this.registry.get(tenantId)
    if (!runtime) {
      // Log collection failure without sensitive details
      console.warn(`[CrossTenantIntelligence] Failed to get runtime for tenant (runtime not found)`)
      return null
    }

    try {
      // Collect only abstracted metrics
      // NOTE: This is a placeholder - actual implementation would
      // query the tenant's stores for aggregated metrics only
      
      const snapshot: TenantSnapshot = {
        // Example: abstract transition patterns
        transitions: [],
        transitionFrequency: 0,
        successRate: 0,
        
        // Example: provider stats (aggregated)
        providers: [],
        
        // Example: strategy metadata (hashed)
        strategy: undefined,
        
        // Example: entropy and convergence metrics
        entropy: 0,
        convergence: 0
      }

      return snapshot
    } catch (error) {
      // Log collection failure without exposing tenant-specific data
      console.warn(`[CrossTenantIntelligence] Failed to collect snapshot (error during collection)`)
      return null
    }
  }

  /**
   * Get tenant context for recommendations
   */
  private getTenantContext(tenantId: string): any {
    // This would extract high-level context from tenant runtime
    // without exposing raw data
    return {
      currentPatterns: [],
      currentProviders: [],
      currentStrategies: [],
      entropy: 0.5,
      convergence: 0.7
    }
  }
}

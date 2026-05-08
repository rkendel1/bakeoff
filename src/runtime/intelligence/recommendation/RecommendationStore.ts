import type { RuntimeRecommendation } from './types.js'

/**
 * RecommendationHistory - Tracks acceptance/rejection of recommendations
 */
export type RecommendationHistory = {
  recommendationId: string
  status: 'pending' | 'accepted' | 'rejected' | 'implemented'
  timestamp: string
  note?: string
}

/**
 * RecommendationStore - Persistent storage for recommendations
 * 
 * Stores:
 * - Generated recommendations
 * - Recommendation history
 * - Acceptance/rejection tracking
 * - Convergence trends
 * 
 * This enables:
 * - Tracking recommendation effectiveness
 * - Learning which recommendations are valuable
 * - Historical analysis of operational evolution
 */
export class RecommendationStore {
  private recommendations: Map<string, RuntimeRecommendation[]> = new Map()
  private history: Map<string, RecommendationHistory[]> = new Map()

  /**
   * Store recommendations for a tenant
   */
  async storeRecommendations(
    tenantId: string,
    recommendations: RuntimeRecommendation[]
  ): Promise<void> {
    const existing = this.recommendations.get(tenantId) || []
    this.recommendations.set(tenantId, [...existing, ...recommendations])
  }

  /**
   * Get all recommendations for a tenant
   */
  async getRecommendations(
    tenantId: string,
    options?: {
      status?: RecommendationHistory['status']
      severity?: RuntimeRecommendation['severity']
      limit?: number
    }
  ): Promise<RuntimeRecommendation[]> {
    let recs = this.recommendations.get(tenantId) || []

    // Filter by severity if specified
    if (options?.severity) {
      recs = recs.filter(r => r.severity === options.severity)
    }

    // Filter by status if specified
    if (options?.status) {
      const histories = this.history.get(tenantId) || []
      const statusIds = new Set(
        histories
          .filter(h => h.status === options.status)
          .map(h => h.recommendationId)
      )
      recs = recs.filter(r => statusIds.has(r.id))
    }

    // Apply limit if specified
    if (options?.limit) {
      recs = recs.slice(0, options.limit)
    }

    return recs
  }

  /**
   * Get the latest recommendations for a tenant
   */
  async getLatestRecommendations(
    tenantId: string,
    limit: number = 10
  ): Promise<RuntimeRecommendation[]> {
    const recs = this.recommendations.get(tenantId) || []
    
    // Sort by generation time (most recent first)
    const sorted = [...recs].sort((a, b) => {
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    })

    return sorted.slice(0, limit)
  }

  /**
   * Record acceptance of a recommendation
   */
  async acceptRecommendation(
    tenantId: string,
    recommendationId: string,
    note?: string
  ): Promise<void> {
    const histories = this.history.get(tenantId) || []
    histories.push({
      recommendationId,
      status: 'accepted',
      timestamp: new Date().toISOString(),
      note
    })
    this.history.set(tenantId, histories)
  }

  /**
   * Record rejection of a recommendation
   */
  async rejectRecommendation(
    tenantId: string,
    recommendationId: string,
    note?: string
  ): Promise<void> {
    const histories = this.history.get(tenantId) || []
    histories.push({
      recommendationId,
      status: 'rejected',
      timestamp: new Date().toISOString(),
      note
    })
    this.history.set(tenantId, histories)
  }

  /**
   * Mark a recommendation as implemented
   */
  async markImplemented(
    tenantId: string,
    recommendationId: string,
    note?: string
  ): Promise<void> {
    const histories = this.history.get(tenantId) || []
    histories.push({
      recommendationId,
      status: 'implemented',
      timestamp: new Date().toISOString(),
      note
    })
    this.history.set(tenantId, histories)
  }

  /**
   * Get recommendation history for a tenant
   */
  async getHistory(tenantId: string): Promise<RecommendationHistory[]> {
    return this.history.get(tenantId) || []
  }

  /**
   * Get acceptance rate for recommendations
   */
  async getAcceptanceRate(tenantId: string): Promise<{
    total: number
    accepted: number
    rejected: number
    pending: number
    acceptanceRate: number
  }> {
    const recs = this.recommendations.get(tenantId) || []
    const histories = this.history.get(tenantId) || []

    const statusCounts = {
      accepted: 0,
      rejected: 0,
      implemented: 0
    }

    for (const history of histories) {
      if (history.status in statusCounts) {
        statusCounts[history.status as keyof typeof statusCounts]++
      }
    }

    const total = recs.length
    const accepted = statusCounts.accepted + statusCounts.implemented
    const rejected = statusCounts.rejected
    const pending = total - accepted - rejected

    const acceptanceRate = total > 0 ? accepted / total : 0

    return {
      total,
      accepted,
      rejected,
      pending,
      acceptanceRate
    }
  }

  /**
   * Clear all recommendations for a tenant (useful for testing)
   */
  async clear(tenantId: string): Promise<void> {
    this.recommendations.delete(tenantId)
    this.history.delete(tenantId)
  }

  /**
   * Clear all data (useful for testing)
   */
  async clearAll(): Promise<void> {
    this.recommendations.clear()
    this.history.clear()
  }
}

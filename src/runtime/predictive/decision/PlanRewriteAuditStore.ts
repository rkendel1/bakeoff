import type { PlanRewriteRecord } from './types.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * PlanRewriteAuditStore - Audit trail for execution plan rewrites
 * 
 * This maintains a complete history of:
 * - When plans were rewritten
 * - Why they were rewritten
 * - What calibration factors were involved
 * - Whether the rewrite improved outcomes
 * 
 * Key insight:
 * Auditing plan rewrites enables:
 * - Transparency in decision modification
 * - Learning from rewrite effectiveness
 * - Accountability in autonomous decision-making
 */
export class PlanRewriteAuditStore {
  // In-memory storage (would be persistent in production)
  private rewrites: Map<string, PlanRewriteRecord> = new Map()
  
  /**
   * Record a plan rewrite
   */
  async recordRewrite(
    tenantId: string,
    originalPlan: {
      strategy: string
      provider?: string
      riskScore: number
      expectedSuccess: number
    },
    rewrittenPlan: {
      strategy: string
      provider?: string
      riskScore: number
      expectedSuccess: number
    },
    rewriteReason: string,
    calibrationFactors: Array<{
      factor: string
      value: number
      impact: string
    }>,
    confidence: number
  ): Promise<PlanRewriteRecord> {
    const record: PlanRewriteRecord = {
      id: uuidv4(),
      tenantId,
      originalPlan,
      rewrittenPlan,
      rewriteReason,
      calibrationFactors,
      rewrittenAt: new Date(),
      confidence
    }
    
    this.rewrites.set(record.id, record)
    return record
  }
  
  /**
   * Update rewrite outcome
   */
  async updateOutcome(
    rewriteId: string,
    executed: boolean,
    success: boolean,
    rewriteWasCorrect: boolean
  ): Promise<void> {
    const record = this.rewrites.get(rewriteId)
    if (!record) {
      throw new Error(`Rewrite record ${rewriteId} not found`)
    }
    
    record.actualOutcome = {
      executed,
      success,
      rewriteWasCorrect,
      verifiedAt: new Date()
    }
  }
  
  /**
   * Get rewrite record
   */
  async getRewrite(rewriteId: string): Promise<PlanRewriteRecord | null> {
    return this.rewrites.get(rewriteId) || null
  }
  
  /**
   * Get all rewrites for a tenant
   */
  async getRewritesForTenant(
    tenantId: string,
    limit: number = 100
  ): Promise<PlanRewriteRecord[]> {
    const results: PlanRewriteRecord[] = []
    
    for (const record of this.rewrites.values()) {
      if (record.tenantId === tenantId) {
        results.push(record)
      }
    }
    
    // Sort by most recent first
    results.sort((a, b) => b.rewrittenAt.getTime() - a.rewrittenAt.getTime())
    
    return results.slice(0, limit)
  }
  
  /**
   * Get recent rewrites (across all tenants)
   */
  async getRecentRewrites(limit: number = 50): Promise<PlanRewriteRecord[]> {
    const allRewrites = Array.from(this.rewrites.values())
    
    // Sort by most recent first
    allRewrites.sort((a, b) => b.rewrittenAt.getTime() - a.rewrittenAt.getTime())
    
    return allRewrites.slice(0, limit)
  }
  
  /**
   * Get rewrite effectiveness stats
   */
  async getEffectivenessStats(
    tenantId?: string
  ): Promise<{
    totalRewrites: number
    verifiedRewrites: number
    successfulRewrites: number
    correctRewrites: number
    rewriteAccuracy: number
  }> {
    let totalRewrites = 0
    let verifiedRewrites = 0
    let successfulRewrites = 0
    let correctRewrites = 0
    
    for (const record of this.rewrites.values()) {
      if (tenantId && record.tenantId !== tenantId) {
        continue
      }
      
      totalRewrites++
      
      if (record.actualOutcome) {
        verifiedRewrites++
        
        if (record.actualOutcome.success) {
          successfulRewrites++
        }
        
        if (record.actualOutcome.rewriteWasCorrect) {
          correctRewrites++
        }
      }
    }
    
    const rewriteAccuracy = verifiedRewrites > 0
      ? correctRewrites / verifiedRewrites
      : 0
    
    return {
      totalRewrites,
      verifiedRewrites,
      successfulRewrites,
      correctRewrites,
      rewriteAccuracy
    }
  }
  
  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalRewrites: number
    tenantsWithRewrites: number
    verifiedOutcomes: number
    averageConfidence: number
  }> {
    const tenants = new Set<string>()
    let verifiedOutcomes = 0
    let totalConfidence = 0
    
    for (const record of this.rewrites.values()) {
      tenants.add(record.tenantId)
      totalConfidence += record.confidence
      
      if (record.actualOutcome) {
        verifiedOutcomes++
      }
    }
    
    return {
      totalRewrites: this.rewrites.size,
      tenantsWithRewrites: tenants.size,
      verifiedOutcomes,
      averageConfidence: this.rewrites.size > 0 ? totalConfidence / this.rewrites.size : 0
    }
  }
  
  /**
   * Clear old rewrites
   */
  async clearOldRewrites(olderThanMs: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    let cleared = 0
    const now = Date.now()
    
    for (const [id, record] of this.rewrites) {
      if (now - record.rewrittenAt.getTime() > olderThanMs) {
        this.rewrites.delete(id)
        cleared++
      }
    }
    
    return cleared
  }
}

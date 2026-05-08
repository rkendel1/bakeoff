import type { ExecutionRecord } from '../../store/execution-record.js'
import type { TenantModel } from '../../../models/tenant-model.js'
import type { DurableExecutionQueue } from '../../queue/durable-execution-queue.js'
import type { RuntimeRecommendation, RecommendationType, RecommendationSeverity } from './types.js'
import type { DriftAnalysis, OperationalTopologySnapshot } from '../types.js'
import { ProviderReliabilityAnalyzer } from './ProviderReliabilityAnalyzer.js'
import { EntropyReductionAdvisor } from './EntropyReductionAdvisor.js'
import { CanonicalConvergenceAnalyzer } from './CanonicalConvergenceAnalyzer.js'
import { SuggestedModelPatchGenerator } from './SuggestedModelPatchGenerator.js'
import { OperationalTopologyStore } from '../../store/OperationalTopologyStore.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * RecommendationEngine - Aggregate analysis signals into actionable recommendations
 * 
 * Aggregates:
 * - Drift analysis
 * - Canonical topology
 * - Execution patterns
 * - Provider reliability
 * - Entropy metrics
 * 
 * Generates ranked operational recommendations.
 * 
 * This is the core of the adaptive optimization layer.
 */
export class RecommendationEngine {
  private readonly providerAnalyzer: ProviderReliabilityAnalyzer
  private readonly entropyAdvisor: EntropyReductionAdvisor
  private readonly convergenceAnalyzer: CanonicalConvergenceAnalyzer
  private readonly patchGenerator: SuggestedModelPatchGenerator

  constructor(topologyStore?: OperationalTopologyStore) {
    this.providerAnalyzer = new ProviderReliabilityAnalyzer()
    this.entropyAdvisor = new EntropyReductionAdvisor()
    this.convergenceAnalyzer = new CanonicalConvergenceAnalyzer(topologyStore)
    this.patchGenerator = new SuggestedModelPatchGenerator()
  }

  /**
   * Generate comprehensive recommendations for a tenant
   */
  async generateRecommendations(
    tenantId: string,
    model: TenantModel,
    executions: ExecutionRecord[],
    driftAnalysis?: DriftAnalysis,
    topologySnapshot?: OperationalTopologySnapshot,
    queue?: DurableExecutionQueue
  ): Promise<RuntimeRecommendation[]> {
    const recommendations: RuntimeRecommendation[] = []

    // 1. Provider reliability recommendations
    const providerRecs = this.generateProviderRecommendations(
      tenantId,
      executions,
      queue
    )
    recommendations.push(...providerRecs)

    // 2. Entropy reduction recommendations
    const entropyRecs = this.generateEntropyRecommendations(
      tenantId,
      model,
      executions
    )
    recommendations.push(...entropyRecs)

    // 3. Drift-based recommendations
    if (driftAnalysis) {
      const driftRecs = this.generateDriftRecommendations(
        tenantId,
        driftAnalysis,
        executions
      )
      recommendations.push(...driftRecs)
    }

    // 4. Convergence-based recommendations
    const convergenceRecs = await this.generateConvergenceRecommendations(
      tenantId,
      executions
    )
    recommendations.push(...convergenceRecs)

    // Sort by severity and confidence
    return this.rankRecommendations(recommendations)
  }

  /**
   * Generate provider reliability recommendations
   */
  private generateProviderRecommendations(
    tenantId: string,
    executions: ExecutionRecord[],
    queue?: DurableExecutionQueue
  ): RuntimeRecommendation[] {
    const recommendations: RuntimeRecommendation[] = []
    const reliabilities = this.providerAnalyzer.analyzeProviders(executions, queue)

    for (const reliability of reliabilities) {
      if (this.providerAnalyzer.isProviderUnstable(reliability)) {
        const providerLabel = reliability.action
          ? `${reliability.provider} for ${reliability.action}`
          : reliability.provider

        recommendations.push({
          id: uuidv4(),
          type: 'provider_instability',
          severity: reliability.stabilityScore < 0.5 ? 'high' : 'medium',
          confidence: 1 - reliability.stabilityScore,

          title: `Provider instability detected: ${providerLabel}`,
          description: 
            `Provider ${providerLabel} shows elevated failure and retry rates. ` +
            `Failure rate: ${(reliability.failureRate * 100).toFixed(1)}%, ` +
            `Stability score: ${reliability.stabilityScore.toFixed(2)}`,

          evidence: [
            {
              type: 'provider_metrics',
              description: 'Provider reliability analysis',
              data: {
                provider: reliability.provider,
                action: reliability.action,
                failureRate: reliability.failureRate,
                retryRate: reliability.retryRate,
                dlqRate: reliability.dlqRate,
                stabilityScore: reliability.stabilityScore,
                executionCount: reliability.executionCount
              }
            }
          ],

          suggestedAction: reliability.action ? {
            operation: 'update_provider',
            target: {
              action: reliability.action,
              provider: 'alternate_provider'
            },
            reason: 'Current provider shows instability'
          } : undefined,

          estimatedImpact: {
            reliability: 0.2 // Could improve reliability by ~20%
          },

          generatedAt: new Date().toISOString()
        })
      }
    }

    return recommendations
  }

  /**
   * Generate entropy reduction recommendations
   */
  private generateEntropyRecommendations(
    tenantId: string,
    model: TenantModel,
    executions: ExecutionRecord[]
  ): RuntimeRecommendation[] {
    const recommendations: RuntimeRecommendation[] = []
    const opportunities = this.entropyAdvisor.analyzeEntropy(model, executions)

    for (const opp of opportunities) {
      let type: RecommendationType
      let title: string

      switch (opp.type) {
        case 'unused_transition':
          type = 'remove_dead_transition'
          title = 'Remove unused transitions'
          break
        case 'dead_state':
          type = 'merge_states'
          title = 'Remove or merge dead states'
          break
        case 'low_confidence_path':
          type = 'canonicalize_path'
          title = 'Consolidate low-frequency paths'
          break
        case 'state_explosion':
          type = 'reduce_entropy'
          title = 'Reduce state explosion'
          break
        default:
          type = 'reduce_entropy'
          title = 'Reduce operational entropy'
      }

      recommendations.push({
        id: uuidv4(),
        type,
        severity: opp.severity,
        confidence: 0.85,

        title,
        description: opp.description,

        evidence: [
          {
            type: 'entropy_analysis',
            description: 'Entropy reduction opportunity',
            data: {
              opportunityType: opp.type,
              affectedElements: opp.affectedElements,
              potentialEntropyReduction: opp.potentialEntropyReduction
            }
          }
        ],

        estimatedImpact: {
          complexityReduction: opp.potentialEntropyReduction,
          entropyReduction: opp.potentialEntropyReduction
        },

        generatedAt: new Date().toISOString()
      })
    }

    return recommendations
  }

  /**
   * Generate drift-based recommendations
   */
  private generateDriftRecommendations(
    tenantId: string,
    driftAnalysis: DriftAnalysis,
    executions: ExecutionRecord[]
  ): RuntimeRecommendation[] {
    const recommendations: RuntimeRecommendation[] = []

    // Shadow transitions (high priority)
    if (driftAnalysis.shadowTransitions.length > 0) {
      const patches = this.patchGenerator.generatePatches(
        { states: [], entities: [], events: [], transitions: [], actions: [] },
        executions,
        driftAnalysis
      )

      const shadowPatches = patches.filter(p => p.operation === 'add_transition')

      for (const patch of shadowPatches) {
        recommendations.push({
          id: uuidv4(),
          type: 'formalize_shadow_transition',
          severity: 'high',
          confidence: 0.94,

          title: 'Formalize dominant shadow transition',
          description: 
            `Transition ${patch.target?.from} → ${patch.target?.to} ` +
            `(${patch.target?.event}) is frequently executed but not defined in model`,

          evidence: [
            {
              type: 'drift_analysis',
              description: 'Shadow transition detected',
              data: {
                from: patch.target?.from,
                to: patch.target?.to,
                event: patch.target?.event,
                reason: patch.reason
              }
            }
          ],

          suggestedAction: patch,

          estimatedImpact: {
            complexityReduction: 0.1,
            reliability: 0.05
          },

          generatedAt: new Date().toISOString()
        })
      }
    }

    // Unused transitions (medium priority)
    if (driftAnalysis.unusedTransitions.length > 0) {
      recommendations.push({
        id: uuidv4(),
        type: 'remove_dead_transition',
        severity: 'medium',
        confidence: 0.89,

        title: 'Remove unused transitions',
        description: 
          `${driftAnalysis.unusedTransitions.length} transition(s) defined ` +
          `in model but never executed`,

        evidence: [
          {
            type: 'drift_analysis',
            description: 'Unused transitions detected',
            data: {
              unusedTransitions: driftAnalysis.unusedTransitions
            }
          }
        ],

        estimatedImpact: {
          complexityReduction: driftAnalysis.unusedTransitions.length * 0.05
        },

        generatedAt: new Date().toISOString()
      })
    }

    return recommendations
  }

  /**
   * Generate convergence-based recommendations
   */
  private async generateConvergenceRecommendations(
    tenantId: string,
    executions: ExecutionRecord[]
  ): Promise<RuntimeRecommendation[]> {
    const recommendations: RuntimeRecommendation[] = []
    const convergence = await this.convergenceAnalyzer.analyzeConvergence(
      tenantId,
      executions
    )

    // Strong convergence - recommend formalization
    if (this.convergenceAnalyzer.isConverging(convergence)) {
      recommendations.push({
        id: uuidv4(),
        type: 'canonicalize_path',
        severity: 'low',
        confidence: convergence.convergenceScore,

        title: 'Operational behavior has converged',
        description: 
          `${(convergence.dominantPathCoverage * 100).toFixed(0)}% of ` +
          `executions follow dominant paths. Consider formalizing these ` +
          `patterns into the canonical model.`,

        evidence: [
          {
            type: 'convergence_analysis',
            description: 'Strong operational convergence detected',
            data: {
              convergenceScore: convergence.convergenceScore,
              dominantPathCoverage: convergence.dominantPathCoverage,
              entropyTrend: convergence.entropyTrend
            }
          }
        ],

        estimatedImpact: {
          reliability: 0.1
        },

        generatedAt: new Date().toISOString()
      })
    }

    // Divergence - recommend simplification
    if (this.convergenceAnalyzer.isDiverging(convergence)) {
      recommendations.push({
        id: uuidv4(),
        type: 'reduce_entropy',
        severity: 'high',
        confidence: 0.8,

        title: 'Operational behavior is diverging',
        description: 
          `Execution patterns are becoming more diverse and unpredictable. ` +
          `Convergence score: ${convergence.convergenceScore.toFixed(2)}. ` +
          `Consider adding constraints or simplifying the workflow.`,

        evidence: [
          {
            type: 'convergence_analysis',
            description: 'Operational divergence detected',
            data: {
              convergenceScore: convergence.convergenceScore,
              entropyTrend: convergence.entropyTrend,
              canonicalizationVelocity: convergence.canonicalizationVelocity
            }
          }
        ],

        estimatedImpact: {
          complexityReduction: 0.25
        },

        generatedAt: new Date().toISOString()
      })
    }

    return recommendations
  }

  /**
   * Rank recommendations by severity and confidence
   */
  private rankRecommendations(
    recommendations: RuntimeRecommendation[]
  ): RuntimeRecommendation[] {
    const severityWeight = {
      high: 3,
      medium: 2,
      low: 1
    }

    return recommendations.sort((a, b) => {
      // First by severity
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity]
      if (severityDiff !== 0) return severityDiff

      // Then by confidence
      return b.confidence - a.confidence
    })
  }
}

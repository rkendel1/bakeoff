import type { ExecutionPlan, EnforcementAction } from './types.js'
import type { TenantModel } from '../../models/tenant-model.js'

/**
 * AdaptiveProviderRouter - Dynamic provider rerouting
 * 
 * Routes execution to alternate providers based on:
 * - Provider stability
 * - Reliability metrics
 * - Runtime intelligence
 * 
 * This is one of the most important governance components.
 * It enables runtime resilience WITHOUT changing tenant models.
 */
export class AdaptiveProviderRouter {
  /**
   * Reroute providers based on stability scores
   * 
   * @param executionPlan - Original execution plan
   * @param model - Tenant model for provider options
   * @param providerStability - Stability scores per provider
   * @param threshold - Minimum acceptable stability score
   * @returns Modified execution plan and enforcement actions
   */
  reroute(
    executionPlan: ExecutionPlan,
    model: TenantModel,
    providerStability: Map<string, number>,
    threshold: number
  ): {
    modifiedPlan: ExecutionPlan
    actions: EnforcementAction[]
  } {
    const modifiedActions = [...executionPlan.actions]
    const actions: EnforcementAction[] = []

    for (let i = 0; i < modifiedActions.length; i++) {
      const action = modifiedActions[i]
      const stability = providerStability.get(action.provider) ?? 1.0

      // Check if provider is below threshold
      if (stability < threshold) {
        // Find alternate provider for this action
        const alternateProvider = this.findAlternateProvider(
          action.name,
          action.provider,
          model,
          providerStability,
          threshold
        )

        if (alternateProvider) {
          // Reroute to alternate provider
          modifiedActions[i] = {
            name: action.name,
            provider: alternateProvider
          }

          actions.push({
            type: 'provider_reroute',
            target: alternateProvider,
            reason: `Provider ${action.provider} stability score ${stability.toFixed(2)} below threshold ${threshold}`,
            metadata: {
              originalProvider: action.provider,
              alternateProvider,
              stabilityScore: stability,
              action: action.name
            }
          })
        }
      }
    }

    return {
      modifiedPlan: {
        ...executionPlan,
        actions: modifiedActions
      },
      actions
    }
  }

  /**
   * Find alternate provider for an action
   * 
   * Searches model for alternate providers that:
   * 1. Support the same action
   * 2. Have better stability scores
   * 3. Meet the threshold requirement
   */
  private findAlternateProvider(
    actionName: string,
    currentProvider: string,
    model: TenantModel,
    providerStability: Map<string, number>,
    threshold: number
  ): string | null {
    // Find all actions in model with the same name
    const candidates = model.actions.filter(
      (a) => a.name === actionName && a.provider !== currentProvider
    )

    if (candidates.length === 0) {
      return null
    }

    // Sort by stability score (highest first)
    const sortedCandidates = candidates
      .map((action) => ({
        provider: action.provider,
        stability: providerStability.get(action.provider) ?? 1.0
      }))
      .filter((c) => c.stability >= threshold)
      .sort((a, b) => b.stability - a.stability)

    // Return best candidate
    return sortedCandidates.length > 0 ? sortedCandidates[0].provider : null
  }

  /**
   * Check if an action has alternate providers available
   */
  hasAlternateProvider(
    actionName: string,
    currentProvider: string,
    model: TenantModel
  ): boolean {
    return model.actions.some(
      (a) => a.name === actionName && a.provider !== currentProvider
    )
  }

  /**
   * Get all available providers for an action
   */
  getAvailableProviders(actionName: string, model: TenantModel): string[] {
    return model.actions
      .filter((a) => a.name === actionName)
      .map((a) => a.provider)
  }
}

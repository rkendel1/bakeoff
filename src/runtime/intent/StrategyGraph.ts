import type { GoalDefinition, StrategyDefinition } from './types.js'
import type { IntentGraph } from './IntentGraph.js'
import type { TenantModel } from '../../models/tenant-model.js'

/**
 * StrategyGraph - Maps goals to tactics, transitions, providers, and recovery plans
 * 
 * This is the operational reasoning graph.
 * 
 * It connects:
 * - Goals (intent)
 * - Strategies (tactics)
 * - Transitions (execution paths)
 * - Providers (implementation)
 * - Recovery plans (resilience)
 * 
 * This graph enables the runtime to reason about:
 * "How can I achieve this goal using available operational primitives?"
 */
export class StrategyGraph {
  constructor(private readonly intentGraph: IntentGraph) {}

  /**
   * Get operational tactics for a goal
   * 
   * Returns all strategies that can achieve the goal,
   * along with their tactical requirements.
   */
  getTacticsForGoal(goalId: string): Array<{
    strategy: StrategyDefinition
    transitions: Array<{ from: string; to: string; event: string }>
    providers: Array<{ action: string; provider: string; alternates?: string[] }>
    recovery: {
      fallback?: string
      actions?: string[]
    }
  }> {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    
    return strategies.map(strategy => ({
      strategy,
      transitions: strategy.requiredTransitions,
      providers: strategy.requiredProviders.map(rp => ({
        action: rp.action,
        provider: rp.provider,
        alternates: rp.alternateProviders
      })),
      recovery: {
        fallback: strategy.fallbackStrategy,
        actions: strategy.recoveryActions
      }
    }))
  }

  /**
   * Get provider dependencies for a goal
   * 
   * Returns all providers required across all strategies for a goal.
   */
  getProviderDependencies(goalId: string): Array<{
    action: string
    primaryProvider: string
    alternateProviders: string[]
    strategiesUsing: string[]
  }> {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const providerMap = new Map<string, {
      primaryProvider: string
      alternateProviders: Set<string>
      strategiesUsing: Set<string>
    }>()
    
    // Aggregate provider usage across strategies
    for (const strategy of strategies) {
      for (const reqProvider of strategy.requiredProviders) {
        const key = reqProvider.action
        
        if (!providerMap.has(key)) {
          providerMap.set(key, {
            primaryProvider: reqProvider.provider,
            alternateProviders: new Set(reqProvider.alternateProviders || []),
            strategiesUsing: new Set()
          })
        }
        
        const entry = providerMap.get(key)!
        entry.strategiesUsing.add(strategy.strategyName)
        
        // Add alternates
        if (reqProvider.alternateProviders) {
          for (const alt of reqProvider.alternateProviders) {
            entry.alternateProviders.add(alt)
          }
        }
      }
    }
    
    // Convert to array
    return Array.from(providerMap.entries()).map(([action, data]) => ({
      action,
      primaryProvider: data.primaryProvider,
      alternateProviders: Array.from(data.alternateProviders),
      strategiesUsing: Array.from(data.strategiesUsing)
    }))
  }

  /**
   * Get transition paths for a goal
   * 
   * Returns all state transitions required across all strategies.
   */
  getTransitionPaths(goalId: string): Array<{
    from: string
    to: string
    event: string
    strategiesUsing: string[]
  }> {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const transitionMap = new Map<string, {
      from: string
      to: string
      event: string
      strategiesUsing: Set<string>
    }>()
    
    // Aggregate transitions across strategies
    for (const strategy of strategies) {
      for (const transition of strategy.requiredTransitions) {
        const key = `${transition.from}->${transition.to}:${transition.event}`
        
        if (!transitionMap.has(key)) {
          transitionMap.set(key, {
            from: transition.from,
            to: transition.to,
            event: transition.event,
            strategiesUsing: new Set()
          })
        }
        
        transitionMap.get(key)!.strategiesUsing.add(strategy.strategyName)
      }
    }
    
    // Convert to array
    return Array.from(transitionMap.values()).map(data => ({
      from: data.from,
      to: data.to,
      event: data.event,
      strategiesUsing: Array.from(data.strategiesUsing)
    }))
  }

  /**
   * Get recovery graph for a goal
   * 
   * Maps strategies to their fallback strategies,
   * creating a recovery dependency graph.
   */
  getRecoveryGraph(goalId: string): Map<string, string | undefined> {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const recoveryGraph = new Map<string, string | undefined>()
    
    for (const strategy of strategies) {
      recoveryGraph.set(strategy.strategyName, strategy.fallbackStrategy)
    }
    
    return recoveryGraph
  }

  /**
   * Check if a strategy is compatible with a tenant model
   * 
   * Validates that the model supports all required transitions and actions.
   */
  isStrategyCompatible(strategy: StrategyDefinition, model: TenantModel): {
    compatible: boolean
    missingTransitions: Array<{ from: string; to: string; event: string }>
    missingActions: string[]
  } {
    const missingTransitions: Array<{ from: string; to: string; event: string }> = []
    const missingActions: string[] = []
    
    // Check transitions
    for (const reqTransition of strategy.requiredTransitions) {
      // Find matching transition in model
      const transitionExists = model.transitions.some(t => 
        t.fromState === reqTransition.from &&
        t.toState === reqTransition.to &&
        t.eventType === reqTransition.event
      )
      
      if (!transitionExists) {
        missingTransitions.push(reqTransition)
      }
    }
    
    // Check actions
    for (const reqProvider of strategy.requiredProviders) {
      const action = reqProvider.action
      
      // Check if action exists in model
      const actionExists = model.actions.some(a => a.name === action)
      
      if (!actionExists) {
        missingActions.push(action)
      }
    }
    
    return {
      compatible: missingTransitions.length === 0 && missingActions.length === 0,
      missingTransitions,
      missingActions
    }
  }

  /**
   * Find compatible strategies for a tenant model
   * 
   * Returns strategies that can be executed with the current model.
   */
  findCompatibleStrategies(goalId: string, model: TenantModel): StrategyDefinition[] {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const compatible: StrategyDefinition[] = []
    
    for (const strategy of strategies) {
      const compatibility = this.isStrategyCompatible(strategy, model)
      if (compatibility.compatible) {
        compatible.push(strategy)
      }
    }
    
    return compatible
  }

  /**
   * Suggest model modifications to enable a strategy
   * 
   * Analyzes what's missing and suggests model patches.
   */
  suggestModelModifications(strategy: StrategyDefinition, model: TenantModel): {
    compatible: boolean
    suggestions: Array<{
      type: 'add_transition' | 'add_action'
      description: string
      patch: unknown
    }>
  } {
    const compatibility = this.isStrategyCompatible(strategy, model)
    const suggestions: Array<{
      type: 'add_transition' | 'add_action'
      description: string
      patch: unknown
    }> = []
    
    // Suggest missing transitions
    for (const missing of compatibility.missingTransitions) {
      suggestions.push({
        type: 'add_transition',
        description: `Add transition: ${missing.from} --[${missing.event}]--> ${missing.to}`,
        patch: {
          state: missing.from,
          transition: {
            event: missing.event,
            target: missing.to
          }
        }
      })
    }
    
    // Suggest missing actions
    for (const action of compatibility.missingActions) {
      suggestions.push({
        type: 'add_action',
        description: `Add action: ${action}`,
        patch: {
          action,
          note: 'Requires provider configuration'
        }
      })
    }
    
    return {
      compatible: compatibility.compatible,
      suggestions
    }
  }

  /**
   * Get graph statistics
   */
  getStats(goalId: string): {
    totalStrategies: number
    totalTransitions: number
    totalProviders: number
    averageTransitionsPerStrategy: number
    averageProvidersPerStrategy: number
  } {
    const strategies = this.intentGraph.getStrategiesForGoal(goalId)
    const transitions = this.getTransitionPaths(goalId)
    const providers = this.getProviderDependencies(goalId)
    
    const totalTransitions = strategies.reduce((sum, s) => sum + s.requiredTransitions.length, 0)
    const totalProviders = strategies.reduce((sum, s) => sum + s.requiredProviders.length, 0)
    
    return {
      totalStrategies: strategies.length,
      totalTransitions: transitions.length,
      totalProviders: providers.length,
      averageTransitionsPerStrategy: strategies.length > 0 ? totalTransitions / strategies.length : 0,
      averageProvidersPerStrategy: strategies.length > 0 ? totalProviders / strategies.length : 0
    }
  }
}

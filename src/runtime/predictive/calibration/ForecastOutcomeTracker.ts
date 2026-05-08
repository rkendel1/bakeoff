import type { ForecastOutcome } from './types.js'
import type { ForecastOutcomeStore } from './ForecastOutcomeStore.js'
import type { RuntimeForecast } from '../types.js'

/**
 * ForecastOutcomeTracker - Links predictions to actual outcomes
 * 
 * This is the critical observation layer that:
 * - Records what was predicted
 * - Records what actually happened
 * - Calculates prediction error
 * - Feeds calibration system
 * 
 * Key insight:
 * Without outcome tracking, predictions are unverifiable.
 * With outcome tracking, predictions become learnable.
 * 
 * This completes the predictive loop:
 * Forecast → Execution → Outcome → Error → Model Adjustment
 */
export class ForecastOutcomeTracker {
  constructor(
    private readonly outcomeStore: ForecastOutcomeStore
  ) {}

  /**
   * Record outcome for a risk assessment forecast
   */
  async recordRiskOutcome(
    forecast: RuntimeForecast,
    actual: {
      failureOccurred: boolean
      actualRiskLevel: number
      executionSuccess: boolean
    }
  ): Promise<ForecastOutcome> {
    if (forecast.forecastType !== 'risk_assessment') {
      throw new Error('Invalid forecast type for risk outcome')
    }

    const forecastData = forecast.forecastData as any
    const predictedRisk = forecastData.overallRiskScore || 0

    // Calculate error (Brier score for probability predictions)
    const predicted = predictedRisk
    const actualBinary = actual.failureOccurred ? 1 : 0
    const brierScore = Math.pow(predicted - actualBinary, 2)

    const outcome: ForecastOutcome = {
      forecastId: forecast.id,
      tenantId: forecast.tenantId,
      forecastType: 'risk_assessment',
      predicted: {
        failureProbability: predictedRisk,
        riskScore: predictedRisk
      },
      actual: {
        failureOccurred: actual.failureOccurred,
        actualRiskLevel: actual.actualRiskLevel,
        success: actual.executionSuccess
      },
      errorMetrics: {
        probabilityError: brierScore,
        calibrationDrift: Math.abs(predicted - actualBinary),
        absoluteError: Math.abs(predictedRisk - actual.actualRiskLevel)
      },
      recordedAt: new Date(),
      forecastGeneratedAt: forecast.generatedAt,
      outcomeObservedAt: new Date()
    }

    await this.outcomeStore.record(outcome)
    return outcome
  }

  /**
   * Record outcome for a goal completion forecast
   */
  async recordGoalOutcome(
    forecast: RuntimeForecast,
    actual: {
      success: boolean
      actualRetries: number
      actualExecutionTimeMs: number
    }
  ): Promise<ForecastOutcome> {
    if (forecast.forecastType !== 'goal_completion') {
      throw new Error('Invalid forecast type for goal outcome')
    }

    const forecastData = forecast.forecastData as any
    const predictedSuccess = forecastData.predictedSuccessProbability || 0
    const expectedRetries = forecastData.expectedRetries || 0

    // Calculate error
    const actualBinary = actual.success ? 1 : 0
    const brierScore = Math.pow(predictedSuccess - actualBinary, 2)

    const outcome: ForecastOutcome = {
      forecastId: forecast.id,
      tenantId: forecast.tenantId,
      forecastType: 'goal_completion',
      predicted: {
        successProbability: predictedSuccess
      },
      actual: {
        success: actual.success
      },
      errorMetrics: {
        probabilityError: brierScore,
        calibrationDrift: Math.abs(predictedSuccess - actualBinary),
        absoluteError: Math.abs(expectedRetries - actual.actualRetries)
      },
      recordedAt: new Date(),
      forecastGeneratedAt: forecast.generatedAt,
      outcomeObservedAt: new Date()
    }

    await this.outcomeStore.record(outcome)
    return outcome
  }

  /**
   * Record outcome for an entropy forecast
   */
  async recordEntropyOutcome(
    forecast: RuntimeForecast,
    actual: {
      actualEntropyChange: number
      entropyIncreased: boolean
    }
  ): Promise<ForecastOutcome> {
    if (forecast.forecastType !== 'entropy_trajectory') {
      throw new Error('Invalid forecast type for entropy outcome')
    }

    const forecastData = forecast.forecastData as any
    const predictedEntropy24h = forecastData.predictedEntropy24h || 0
    const currentEntropy = forecastData.currentEntropy || 0
    const predictedIncrease = predictedEntropy24h - currentEntropy

    const outcome: ForecastOutcome = {
      forecastId: forecast.id,
      tenantId: forecast.tenantId,
      forecastType: 'entropy_trajectory',
      predicted: {
        entropyIncrease: predictedIncrease
      },
      actual: {
        entropyChange: actual.actualEntropyChange
      },
      errorMetrics: {
        probabilityError: Math.pow(predictedIncrease - actual.actualEntropyChange, 2),
        calibrationDrift: Math.abs(predictedIncrease - actual.actualEntropyChange),
        absoluteError: Math.abs(predictedIncrease - actual.actualEntropyChange)
      },
      recordedAt: new Date(),
      forecastGeneratedAt: forecast.generatedAt,
      outcomeObservedAt: new Date()
    }

    await this.outcomeStore.record(outcome)
    return outcome
  }

  /**
   * Record outcome for a strategy decay forecast
   */
  async recordDecayOutcome(
    forecast: RuntimeForecast,
    actual: {
      actualDecayRate: number
      successRateDecreased: boolean
    }
  ): Promise<ForecastOutcome> {
    if (forecast.forecastType !== 'strategy_decay') {
      throw new Error('Invalid forecast type for decay outcome')
    }

    const forecastData = forecast.forecastData as any
    const predictedDecayRate = forecastData.decayRate || 0

    const outcome: ForecastOutcome = {
      forecastId: forecast.id,
      tenantId: forecast.tenantId,
      forecastType: 'strategy_decay',
      predicted: {
        decayRate: predictedDecayRate
      },
      actual: {
        decayObserved: actual.actualDecayRate
      },
      errorMetrics: {
        probabilityError: Math.pow(predictedDecayRate - actual.actualDecayRate, 2),
        calibrationDrift: Math.abs(predictedDecayRate - actual.actualDecayRate),
        absoluteError: Math.abs(predictedDecayRate - actual.actualDecayRate)
      },
      recordedAt: new Date(),
      forecastGeneratedAt: forecast.generatedAt,
      outcomeObservedAt: new Date()
    }

    await this.outcomeStore.record(outcome)
    return outcome
  }

  /**
   * Record outcome for a failure trajectory forecast
   */
  async recordFailureTrajectoryOutcome(
    forecast: RuntimeForecast,
    actual: {
      failureOccurred: boolean
      timeToFailure?: number
    }
  ): Promise<ForecastOutcome> {
    if (forecast.forecastType !== 'failure_trajectory') {
      throw new Error('Invalid forecast type for failure trajectory outcome')
    }

    const forecastData = forecast.forecastData as any
    const predictedProbability = forecastData.failureProbability || 0

    // Calculate error
    const actualBinary = actual.failureOccurred ? 1 : 0
    const brierScore = Math.pow(predictedProbability - actualBinary, 2)

    const outcome: ForecastOutcome = {
      forecastId: forecast.id,
      tenantId: forecast.tenantId,
      forecastType: 'failure_trajectory',
      predicted: {
        failureProbability: predictedProbability
      },
      actual: {
        failureOccurred: actual.failureOccurred
      },
      errorMetrics: {
        probabilityError: brierScore,
        calibrationDrift: Math.abs(predictedProbability - actualBinary)
      },
      recordedAt: new Date(),
      forecastGeneratedAt: forecast.generatedAt,
      outcomeObservedAt: new Date()
    }

    await this.outcomeStore.record(outcome)
    return outcome
  }

  /**
   * Get recent outcomes for analysis
   */
  async getRecentOutcomes(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType'],
    days: number = 7
  ): Promise<ForecastOutcome[]> {
    return this.outcomeStore.getRecent(tenantId, forecastType, days)
  }

  /**
   * Get average error for a forecast type
   */
  async getAverageError(
    tenantId: string,
    forecastType: ForecastOutcome['forecastType']
  ): Promise<number> {
    return this.outcomeStore.getAverageError(tenantId, forecastType)
  }
}

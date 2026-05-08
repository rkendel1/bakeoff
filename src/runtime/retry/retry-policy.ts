/**
 * RetryPolicy - Defines retry behavior for failed executions
 * 
 * This policy determines:
 * - Maximum number of retry attempts
 * - Backoff strategy between retries
 * 
 * Purpose:
 * - Provide transient failure recovery
 * - Prevent retry storms with exponential backoff
 * - Ensure final failures are properly handled
 */

export const RetryPolicy = {
  /**
   * Maximum number of retry attempts before sending to DLQ
   */
  maxAttempts: 3,

  /**
   * Calculate backoff delay in milliseconds based on attempt number
   * Uses exponential backoff with 0-based attempts:
   * - attempt 0 (1st try): 100ms
   * - attempt 1 (2nd try): 200ms  
   * - attempt 2 (3rd try): 400ms
   * 
   * @param attempt - The current attempt number (0-based, starting from 0)
   * @returns Delay in milliseconds before next retry
   */
  backoffMs: (attempt: number): number => {
    return 100 * Math.pow(2, attempt)
  }
}

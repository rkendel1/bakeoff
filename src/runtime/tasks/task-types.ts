/**
 * Task Management Types
 * 
 * Provides task management with instructions, guides, and screenshots
 * for onboarding and platform education.
 */

/**
 * InstructionStep - A single step in task instructions
 */
export interface InstructionStep {
  stepNumber: number
  title: string
  description: string
  screenshotUrl?: string
  // Navigation or action URL (e.g., settings page URL)
  actionUrl?: string
  // Additional tips or notes
  tips?: string[]
}

/**
 * TaskGuide - Detailed guide for completing a task
 */
export interface TaskGuide {
  title: string
  description: string
  steps: InstructionStep[]
  // Additional resources
  videoUrl?: string
  documentationUrl?: string
  estimatedTimeMinutes?: number
}

/**
 * TaskPriority - Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * TaskStatus - Task completion status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

/**
 * TaskCategory - Task categories for grouping
 */
export type TaskCategory = 'onboarding' | 'configuration' | 'integration' | 'review' | 'other'

/**
 * Task - A task with instructions and metadata
 */
export interface Task {
  id: string
  tenantId: string
  
  // Basic info
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  
  // Assignment
  assignedTo?: string  // userId
  createdBy?: string   // userId
  
  // Guide and instructions
  guide?: TaskGuide
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dueDate?: Date
  
  // Tags for filtering and search
  tags?: string[]
}

/**
 * TaskSummary - Aggregated task counts
 */
export interface TaskSummary {
  tenantId: string
  userId?: string
  total: number
  byStatus: {
    pending: number
    in_progress: number
    completed: number
    cancelled: number
  }
  byPriority: {
    low: number
    medium: number
    high: number
    critical: number
  }
  byCategory: {
    onboarding: number
    configuration: number
    integration: number
    review: number
    other: number
  }
}

/**
 * CreateTaskRequest - Request to create a new task
 */
export interface CreateTaskRequest {
  tenantId: string
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  assignedTo?: string
  guide?: TaskGuide
  dueDate?: string
  tags?: string[]
}

/**
 * UpdateTaskRequest - Request to update a task
 */
export interface UpdateTaskRequest {
  title?: string
  description?: string
  category?: TaskCategory
  priority?: TaskPriority
  status?: TaskStatus
  assignedTo?: string
  guide?: TaskGuide
  dueDate?: string
  tags?: string[]
}

/**
 * TaskFilter - Filter options for querying tasks
 */
export interface TaskFilter {
  tenantId: string
  userId?: string
  status?: TaskStatus
  category?: TaskCategory
  priority?: TaskPriority
  tags?: string[]
  assignedTo?: string
}

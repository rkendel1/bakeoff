import type { Task, TaskFilter, TaskSummary } from './task-types.js'

/**
 * TaskStore - In-memory store for tasks
 * 
 * Provides CRUD operations for task management with filtering
 * and aggregation capabilities.
 */
export class TaskStore {
  private tasks: Map<string, Task> = new Map()

  /**
   * Create a new task
   */
  create(task: Task): void {
    this.tasks.set(task.id, task)
  }

  /**
   * Get a task by ID
   */
  get(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  /**
   * Update a task
   */
  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id)
    if (!task) return undefined

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    }

    this.tasks.set(id, updatedTask)
    return updatedTask
  }

  /**
   * Delete a task
   */
  delete(id: string): boolean {
    return this.tasks.delete(id)
  }

  /**
   * List tasks with optional filtering
   */
  list(filter?: TaskFilter): Task[] {
    let tasks = Array.from(this.tasks.values())

    if (!filter) return tasks

    // Filter by tenantId
    if (filter.tenantId) {
      tasks = tasks.filter(t => t.tenantId === filter.tenantId)
    }

    // Filter by assignedTo
    if (filter.assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === filter.assignedTo)
    }

    // Filter by status
    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status)
    }

    // Filter by category
    if (filter.category) {
      tasks = tasks.filter(t => t.category === filter.category)
    }

    // Filter by priority
    if (filter.priority) {
      tasks = tasks.filter(t => t.priority === filter.priority)
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      tasks = tasks.filter(t =>
        t.tags && filter.tags!.some(tag => t.tags!.includes(tag))
      )
    }

    return tasks
  }

  /**
   * Get task summary with counts
   */
  getSummary(tenantId: string, userId?: string): TaskSummary {
    const filter: TaskFilter = { tenantId }
    if (userId) {
      filter.assignedTo = userId
    }

    const tasks = this.list(filter)

    const summary: TaskSummary = {
      tenantId,
      userId,
      total: tasks.length,
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byCategory: {
        onboarding: 0,
        configuration: 0,
        integration: 0,
        review: 0,
        other: 0
      }
    }

    for (const task of tasks) {
      summary.byStatus[task.status]++
      summary.byPriority[task.priority]++
      summary.byCategory[task.category]++
    }

    return summary
  }

  /**
   * Get all tasks for a tenant
   */
  getByTenant(tenantId: string): Task[] {
    return this.list({ tenantId })
  }

  /**
   * Get all tasks assigned to a user
   */
  getByUser(tenantId: string, userId: string): Task[] {
    return this.list({ tenantId, assignedTo: userId })
  }

  /**
   * Get all onboarding tasks
   */
  getOnboardingTasks(tenantId: string, userId?: string): Task[] {
    return this.list({
      tenantId,
      category: 'onboarding',
      assignedTo: userId
    })
  }

  /**
   * Clear all tasks (for testing)
   */
  clear(): void {
    this.tasks.clear()
  }

  /**
   * Get count of all tasks
   */
  count(): number {
    return this.tasks.size
  }
}

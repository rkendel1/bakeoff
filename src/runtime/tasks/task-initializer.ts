import { randomUUID } from 'crypto'
import type { Task, TaskGuide } from './task-types.js'
import { TaskStore } from './task-store.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface OnboardingTaskTemplate {
  id: string
  title: string
  description: string
  category: string
  priority: string
  guide?: TaskGuide
  tags?: string[]
}

interface OnboardingTasksConfig {
  onboardingTasks: OnboardingTaskTemplate[]
}

/**
 * TaskInitializer - Initializes default onboarding tasks
 */
export class TaskInitializer {
  private taskStore: TaskStore

  constructor(taskStore: TaskStore) {
    this.taskStore = taskStore
  }

  /**
   * Initialize onboarding tasks for a new user/tenant
   */
  initializeOnboardingTasks(tenantId: string, userId: string): Task[] {
    const config = this.loadOnboardingTasksConfig()
    const tasks: Task[] = []

    for (const template of config.onboardingTasks) {
      const task: Task = {
        id: randomUUID(),
        tenantId,
        title: template.title,
        description: template.description,
        category: template.category as any,
        priority: template.priority as any,
        status: 'pending',
        assignedTo: userId,
        guide: template.guide,
        tags: template.tags,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      this.taskStore.create(task)
      tasks.push(task)
    }

    return tasks
  }

  /**
   * Load onboarding tasks configuration from JSON
   */
  private loadOnboardingTasksConfig(): OnboardingTasksConfig {
    try {
      const configPath = path.join(__dirname, 'onboarding-tasks.json')
      const configData = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(configData) as OnboardingTasksConfig
    } catch (error) {
      console.error('[task-initializer] Failed to load onboarding tasks config:', error)
      // Return empty config if file doesn't exist
      return { onboardingTasks: [] }
    }
  }

  /**
   * Check if onboarding tasks already exist for a user
   */
  hasOnboardingTasks(tenantId: string, userId: string): boolean {
    const tasks = this.taskStore.getOnboardingTasks(tenantId, userId)
    return tasks.length > 0
  }
}

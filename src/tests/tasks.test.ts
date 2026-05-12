import { test } from 'node:test'
import assert from 'node:assert'
import { TaskStore } from '../runtime/tasks/task-store.js'
import { TaskInitializer } from '../runtime/tasks/task-initializer.js'
import type { Task } from '../runtime/tasks/task-types.js'

test('TaskStore: create and retrieve task', () => {
  const store = new TaskStore()

  const task: Task = {
    id: 'task-1',
    tenantId: 'demo',
    title: 'Test Task',
    description: 'Test description',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  store.create(task)
  const retrieved = store.get('task-1')

  assert.ok(retrieved)
  assert.equal(retrieved.title, 'Test Task')
  assert.equal(retrieved.status, 'pending')
})

test('TaskStore: update task', () => {
  const store = new TaskStore()

  const task: Task = {
    id: 'task-1',
    tenantId: 'demo',
    title: 'Test Task',
    description: 'Test description',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  store.create(task)
  const updated = store.update('task-1', { status: 'completed' })

  assert.ok(updated)
  assert.equal(updated.status, 'completed')
  assert.ok(updated.completedAt === undefined) // completedAt is not automatically set in store
})

test('TaskStore: delete task', () => {
  const store = new TaskStore()

  const task: Task = {
    id: 'task-1',
    tenantId: 'demo',
    title: 'Test Task',
    description: 'Test description',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  store.create(task)
  const deleted = store.delete('task-1')
  const retrieved = store.get('task-1')

  assert.ok(deleted)
  assert.equal(retrieved, undefined)
})

test('TaskStore: filter tasks by status', () => {
  const store = new TaskStore()

  store.create({
    id: 'task-1',
    tenantId: 'demo',
    title: 'Task 1',
    description: 'Test',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  store.create({
    id: 'task-2',
    tenantId: 'demo',
    title: 'Task 2',
    description: 'Test',
    category: 'onboarding',
    priority: 'medium',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const pending = store.list({ tenantId: 'demo', status: 'pending' })
  const completed = store.list({ tenantId: 'demo', status: 'completed' })

  assert.equal(pending.length, 1)
  assert.equal(pending[0].id, 'task-1')
  assert.equal(completed.length, 1)
  assert.equal(completed[0].id, 'task-2')
})

test('TaskStore: filter tasks by category', () => {
  const store = new TaskStore()

  store.create({
    id: 'task-1',
    tenantId: 'demo',
    title: 'Task 1',
    description: 'Test',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  store.create({
    id: 'task-2',
    tenantId: 'demo',
    title: 'Task 2',
    description: 'Test',
    category: 'configuration',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const onboarding = store.list({ tenantId: 'demo', category: 'onboarding' })
  const config = store.list({ tenantId: 'demo', category: 'configuration' })

  assert.equal(onboarding.length, 1)
  assert.equal(onboarding[0].id, 'task-1')
  assert.equal(config.length, 1)
  assert.equal(config[0].id, 'task-2')
})

test('TaskStore: filter tasks by assignedTo', () => {
  const store = new TaskStore()

  store.create({
    id: 'task-1',
    tenantId: 'demo',
    title: 'Task 1',
    description: 'Test',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    assignedTo: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  store.create({
    id: 'task-2',
    tenantId: 'demo',
    title: 'Task 2',
    description: 'Test',
    category: 'onboarding',
    priority: 'medium',
    status: 'pending',
    assignedTo: 'user-2',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const user1Tasks = store.list({ tenantId: 'demo', assignedTo: 'user-1' })
  const user2Tasks = store.list({ tenantId: 'demo', assignedTo: 'user-2' })

  assert.equal(user1Tasks.length, 1)
  assert.equal(user1Tasks[0].id, 'task-1')
  assert.equal(user2Tasks.length, 1)
  assert.equal(user2Tasks[0].id, 'task-2')
})

test('TaskStore: get task summary', () => {
  const store = new TaskStore()

  store.create({
    id: 'task-1',
    tenantId: 'demo',
    title: 'Task 1',
    description: 'Test',
    category: 'onboarding',
    priority: 'high',
    status: 'pending',
    assignedTo: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  store.create({
    id: 'task-2',
    tenantId: 'demo',
    title: 'Task 2',
    description: 'Test',
    category: 'configuration',
    priority: 'medium',
    status: 'completed',
    assignedTo: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  store.create({
    id: 'task-3',
    tenantId: 'demo',
    title: 'Task 3',
    description: 'Test',
    category: 'onboarding',
    priority: 'low',
    status: 'in_progress',
    assignedTo: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const summary = store.getSummary('demo', 'user-1')

  assert.equal(summary.total, 3)
  assert.equal(summary.byStatus.pending, 1)
  assert.equal(summary.byStatus.completed, 1)
  assert.equal(summary.byStatus.in_progress, 1)
  assert.equal(summary.byPriority.high, 1)
  assert.equal(summary.byPriority.medium, 1)
  assert.equal(summary.byPriority.low, 1)
  assert.equal(summary.byCategory.onboarding, 2)
  assert.equal(summary.byCategory.configuration, 1)
})

test('TaskInitializer: initialize onboarding tasks', () => {
  const store = new TaskStore()
  const initializer = new TaskInitializer(store)

  const tasks = initializer.initializeOnboardingTasks('demo', 'user-1')

  assert.ok(tasks.length > 0)
  assert.ok(tasks.every(t => t.tenantId === 'demo'))
  assert.ok(tasks.every(t => t.assignedTo === 'user-1'))
  assert.ok(tasks.every(t => t.category === 'onboarding'))
  assert.ok(tasks.every(t => t.status === 'pending'))
})

test('TaskInitializer: check if onboarding tasks exist', () => {
  const store = new TaskStore()
  const initializer = new TaskInitializer(store)

  assert.equal(initializer.hasOnboardingTasks('demo', 'user-1'), false)

  initializer.initializeOnboardingTasks('demo', 'user-1')

  assert.equal(initializer.hasOnboardingTasks('demo', 'user-1'), true)
})

test('TaskStore: get onboarding tasks', () => {
  const store = new TaskStore()
  const initializer = new TaskInitializer(store)

  initializer.initializeOnboardingTasks('demo', 'user-1')

  const onboardingTasks = store.getOnboardingTasks('demo', 'user-1')

  assert.ok(onboardingTasks.length > 0)
  assert.ok(onboardingTasks.every(t => t.category === 'onboarding'))
  assert.ok(onboardingTasks.every(t => t.assignedTo === 'user-1'))
})

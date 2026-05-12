import { TaskStore } from './src/runtime/tasks/task-store.js'
import { TaskInitializer } from './src/runtime/tasks/task-initializer.js'
import type { Task } from './src/runtime/tasks/task-types.js'

console.log('=== Task Management Demo ===\n')

// 1. Setup
console.log('1. Setting up Task Store')
const taskStore = new TaskStore()
const taskInitializer = new TaskInitializer(taskStore)
console.log('   ✓ Task store initialized\n')

// 2. Initialize Onboarding Tasks for a New User
console.log('2. Initializing Onboarding Tasks for New User')
const tenantId = 'demo'
const userId = 'user-1'

const onboardingTasks = taskInitializer.initializeOnboardingTasks(tenantId, userId)
console.log(`   ✓ Created ${onboardingTasks.length} onboarding tasks`)
console.log('   ✓ All tasks assigned to:', userId)
console.log('')

// 3. Display Onboarding Tasks with Instructions
console.log('3. Onboarding Tasks with Instructions')
console.log('─'.repeat(80))
onboardingTasks.forEach((task, index) => {
  console.log(`\n${index + 1}. ${task.title}`)
  console.log(`   Category: ${task.category}`)
  console.log(`   Priority: ${task.priority}`)
  console.log(`   Status: ${task.status}`)
  console.log(`   Description: ${task.description}`)
  
  if (task.guide) {
    console.log(`\n   📖 Guide: ${task.guide.title}`)
    console.log(`   ⏱️  Estimated Time: ${task.guide.estimatedTimeMinutes} minutes`)
    console.log(`\n   Steps:`)
    task.guide.steps.forEach(step => {
      console.log(`   ${step.stepNumber}. ${step.title}`)
      console.log(`      ${step.description}`)
      if (step.actionUrl) {
        console.log(`      🔗 Action: ${step.actionUrl}`)
      }
      if (step.tips && step.tips.length > 0) {
        step.tips.forEach(tip => {
          console.log(`      💡 ${tip}`)
        })
      }
    })
  }
})
console.log('')

// 4. Get Task Summary
console.log('4. Task Summary for User')
console.log('─'.repeat(80))
const summary = taskStore.getSummary(tenantId, userId)
console.log(`   Total Tasks: ${summary.total}`)
console.log(`\n   By Status:`)
console.log(`     Pending: ${summary.byStatus.pending}`)
console.log(`     In Progress: ${summary.byStatus.in_progress}`)
console.log(`     Completed: ${summary.byStatus.completed}`)
console.log(`     Cancelled: ${summary.byStatus.cancelled}`)
console.log(`\n   By Priority:`)
console.log(`     Critical: ${summary.byPriority.critical}`)
console.log(`     High: ${summary.byPriority.high}`)
console.log(`     Medium: ${summary.byPriority.medium}`)
console.log(`     Low: ${summary.byPriority.low}`)
console.log(`\n   By Category:`)
console.log(`     Onboarding: ${summary.byCategory.onboarding}`)
console.log(`     Configuration: ${summary.byCategory.configuration}`)
console.log(`     Integration: ${summary.byCategory.integration}`)
console.log(`     Review: ${summary.byCategory.review}`)
console.log(`     Other: ${summary.byCategory.other}`)
console.log('')

// 5. Simulate User Working on Tasks
console.log('5. Simulating User Task Progress')
console.log('─'.repeat(80))

// User starts first task
const firstTask = onboardingTasks[0]
console.log(`\n   User starts: "${firstTask.title}"`)
taskStore.update(firstTask.id, { status: 'in_progress' })
console.log('   ✓ Status updated to: in_progress')

// User completes second task
const secondTask = onboardingTasks[1]
console.log(`\n   User completes: "${secondTask.title}"`)
taskStore.update(secondTask.id, { 
  status: 'completed',
  completedAt: new Date()
})
console.log('   ✓ Status updated to: completed')
console.log('')

// 6. Updated Task Summary
console.log('6. Updated Task Summary')
console.log('─'.repeat(80))
const updatedSummary = taskStore.getSummary(tenantId, userId)
console.log(`   Total Tasks: ${updatedSummary.total}`)
console.log(`\n   By Status:`)
console.log(`     Pending: ${updatedSummary.byStatus.pending}`)
console.log(`     In Progress: ${updatedSummary.byStatus.in_progress}`)
console.log(`     Completed: ${updatedSummary.byStatus.completed}`)
console.log('')

// 7. Filter Tasks
console.log('7. Filtering Tasks')
console.log('─'.repeat(80))

const pendingTasks = taskStore.list({ tenantId, status: 'pending', assignedTo: userId })
console.log(`\n   Pending Tasks (${pendingTasks.length}):`)
pendingTasks.forEach(task => {
  console.log(`     • ${task.title}`)
})

const inProgressTasks = taskStore.list({ tenantId, status: 'in_progress', assignedTo: userId })
console.log(`\n   In Progress Tasks (${inProgressTasks.length}):`)
inProgressTasks.forEach(task => {
  console.log(`     • ${task.title}`)
})

const completedTasks = taskStore.list({ tenantId, status: 'completed', assignedTo: userId })
console.log(`\n   Completed Tasks (${completedTasks.length}):`)
completedTasks.forEach(task => {
  console.log(`     • ${task.title}`)
})
console.log('')

// 8. Create Custom Task with Instructions
console.log('8. Creating Custom Task with Instructions')
console.log('─'.repeat(80))

const customTask: Task = {
  id: 'custom-1',
  tenantId,
  title: 'Configure Email Notifications',
  description: 'Set up email notifications for important events',
  category: 'configuration',
  priority: 'high',
  status: 'pending',
  assignedTo: userId,
  guide: {
    title: 'Email Notification Setup Guide',
    description: 'Configure your email notification preferences',
    estimatedTimeMinutes: 5,
    steps: [
      {
        stepNumber: 1,
        title: 'Navigate to Notification Settings',
        description: 'Open the settings menu and click on Notifications',
        actionUrl: '/settings/notifications'
      },
      {
        stepNumber: 2,
        title: 'Enable Email Notifications',
        description: 'Toggle the email notifications switch to ON',
        tips: ['You can customize which events trigger emails']
      },
      {
        stepNumber: 3,
        title: 'Select Event Types',
        description: 'Choose which events should send email notifications',
        tips: [
          'Recommended: Enable notifications for task assignments',
          'Recommended: Enable notifications for mentions'
        ]
      },
      {
        stepNumber: 4,
        title: 'Save Configuration',
        description: 'Click Save to apply your notification settings'
      }
    ]
  },
  tags: ['configuration', 'notifications', 'email'],
  createdAt: new Date(),
  updatedAt: new Date()
}

taskStore.create(customTask)
console.log(`\n   ✓ Created custom task: "${customTask.title}"`)
console.log(`   Category: ${customTask.category}`)
console.log(`   Priority: ${customTask.priority}`)
console.log(`   Guide Steps: ${customTask.guide!.steps.length}`)
console.log('')

// 9. Final Task Summary
console.log('9. Final Task Summary')
console.log('─'.repeat(80))
const finalSummary = taskStore.getSummary(tenantId, userId)
console.log(`   Total Tasks: ${finalSummary.total}`)
console.log(`   Pending: ${finalSummary.byStatus.pending}`)
console.log(`   In Progress: ${finalSummary.byStatus.in_progress}`)
console.log(`   Completed: ${finalSummary.byStatus.completed}`)
console.log('')

// 10. Integration with Site Processing
console.log('10. Integration Example: Company Setup Task')
console.log('─'.repeat(80))
const setupTask = onboardingTasks.find(t => t.title.includes('Setup Company'))
if (setupTask && setupTask.guide) {
  console.log(`\n   Task: ${setupTask.title}`)
  console.log(`   Description: ${setupTask.description}`)
  console.log(`\n   Integration Flow:`)
  console.log('   1. User navigates to /settings/company (from task guide)')
  console.log('   2. User enters company website URL')
  console.log('   3. Frontend calls: POST /site-requests { url: "https://example.com" }')
  console.log('   4. Backend queues site scraping job')
  console.log('   5. Frontend polls: GET /site-requests/{requestId}')
  console.log('   6. When complete, frontend displays extracted company data')
  console.log('   7. User reviews and saves company profile')
  console.log('   8. Frontend marks task complete: PUT /tasks/{id} { status: "completed" }')
  console.log('')
  console.log('   Example cURL commands:')
  console.log('   ```bash')
  console.log('   # Submit site request')
  console.log('   curl -X POST http://localhost:8080/site-requests \\')
  console.log('     -H "Content-Type: application/json" \\')
  console.log('     -d \'{"url": "https://prosperitynorthadvisors.com/"}\'')
  console.log('')
  console.log('   # Check status')
  console.log('   curl http://localhost:8080/site-requests/{requestId}')
  console.log('')
  console.log('   # Mark task complete')
  console.log(`   curl -X PUT http://localhost:8080/tasks/${setupTask.id} \\`)
  console.log('     -H "Content-Type: application/json" \\')
  console.log('     -d \'{"status": "completed"}\'')
  console.log('   ```')
}
console.log('')

console.log('=== Demo Complete ===')
console.log('')
console.log('Key Features Demonstrated:')
console.log('  ✓ Automatic onboarding task creation from JSON config')
console.log('  ✓ Rich task guides with step-by-step instructions')
console.log('  ✓ Task filtering and assignment')
console.log('  ✓ Task status tracking and summaries')
console.log('  ✓ Custom task creation with instructions')
console.log('  ✓ Integration with site-requests API')
console.log('')
console.log('Next Steps:')
console.log('  1. Start server: npm run start:prod')
console.log('  2. Initialize tasks: POST /onboarding/tasks/initialize')
console.log('  3. Get tasks: GET /tasks?tenantId=demo&userId=user-1')
console.log('  4. Get summary: GET /tasks/summary?tenantId=demo&userId=user-1')
console.log('  5. Update task: PUT /tasks/{id}')
console.log('')

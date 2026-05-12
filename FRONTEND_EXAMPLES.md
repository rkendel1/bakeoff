# Frontend Integration Examples

This document provides practical examples for integrating the task management API into a frontend application.

## 1. Initialize Tasks on User Onboarding

When a new user signs up or starts onboarding, initialize their tasks:

```typescript
async function initializeUserOnboarding(tenantId: string, userId: string) {
  const response = await fetch('/onboarding/tasks/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, userId })
  })
  
  const { tasks } = await response.json()
  console.log(`Created ${tasks.length} onboarding tasks for ${userId}`)
  return tasks
}
```

## 2. Display Task Count in Navigation

Show pending task count in the navigation menu:

```typescript
async function getTaskCount(tenantId: string, userId: string): Promise<number> {
  const response = await fetch(`/tasks/summary?tenantId=${tenantId}&userId=${userId}`)
  const { summary } = await response.json()
  return summary.byStatus.pending
}

// Usage in React component
function Navigation() {
  const [taskCount, setTaskCount] = useState(0)
  
  useEffect(() => {
    getTaskCount('demo', currentUser.id).then(setTaskCount)
  }, [])
  
  return (
    <nav>
      <a href="/tasks">
        Tasks {taskCount > 0 && `(${taskCount})`}
      </a>
    </nav>
  )
}
```

## 3. Display Task List

Fetch and display user's tasks:

```typescript
async function getUserTasks(tenantId: string, userId: string, status?: string) {
  let url = `/tasks?tenantId=${tenantId}&userId=${userId}`
  if (status) url += `&status=${status}`
  
  const response = await fetch(url)
  const { tasks } = await response.json()
  return tasks
}

// Usage in React
function TaskList() {
  const [tasks, setTasks] = useState([])
  
  useEffect(() => {
    getUserTasks('demo', currentUser.id, 'pending').then(setTasks)
  }, [])
  
  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}
```

## 4. Display Task with Step-by-Step Instructions

Show detailed task guide in a modal:

```typescript
function TaskDetailModal({ taskId, onClose }) {
  const [task, setTask] = useState(null)
  
  useEffect(() => {
    fetch(`/tasks/${taskId}`)
      .then(res => res.json())
      .then(data => setTask(data.task))
  }, [taskId])
  
  if (!task) return <div>Loading...</div>
  
  return (
    <div className="modal">
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      
      {task.guide && (
        <div className="task-guide">
          <h3>{task.guide.title}</h3>
          <p>{task.guide.description}</p>
          <p>Estimated time: {task.guide.estimatedTimeMinutes} minutes</p>
          
          <div className="steps">
            {task.guide.steps.map(step => (
              <div key={step.stepNumber} className="step">
                <h4>{step.stepNumber}. {step.title}</h4>
                <p>{step.description}</p>
                
                {step.actionUrl && (
                  <a href={step.actionUrl} className="action-button">
                    Go to {step.title}
                  </a>
                )}
                
                {step.screenshotUrl && (
                  <img src={step.screenshotUrl} alt={step.title} />
                )}
                
                {step.tips && step.tips.length > 0 && (
                  <div className="tips">
                    <h5>💡 Tips:</h5>
                    <ul>
                      {step.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {task.guide.videoUrl && (
            <a href={task.guide.videoUrl}>Watch Video Tutorial</a>
          )}
          
          {task.guide.documentationUrl && (
            <a href={task.guide.documentationUrl}>View Documentation</a>
          )}
        </div>
      )}
      
      <button onClick={() => markTaskComplete(taskId)}>
        Mark as Complete
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}
```

## 5. Update Task Status

Mark a task as in progress or completed:

```typescript
async function updateTaskStatus(taskId: string, status: string) {
  const response = await fetch(`/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  
  const { task } = await response.json()
  return task
}

// Usage
async function markTaskComplete(taskId: string) {
  await updateTaskStatus(taskId, 'completed')
  // Refresh task list
  refreshTaskList()
}

async function startTask(taskId: string) {
  await updateTaskStatus(taskId, 'in_progress')
}
```

## 6. Company Setup with Website Scraping

Integrate task instructions with the company settings page:

```typescript
function CompanySetupPage() {
  const [companyUrl, setCompanyUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  const [requestId, setRequestId] = useState(null)
  
  // Submit website URL for scraping
  async function scanWebsite() {
    setScraping(true)
    
    const response = await fetch('/site-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: companyUrl })
    })
    
    const { requestId } = await response.json()
    setRequestId(requestId)
    
    // Poll for results
    pollScrapeStatus(requestId)
  }
  
  // Poll for scraping completion
  async function pollScrapeStatus(reqId: string) {
    const interval = setInterval(async () => {
      const response = await fetch(`/site-requests/${reqId}`)
      const data = await response.json()
      
      if (data.status === 'completed') {
        clearInterval(interval)
        setScraping(false)
        setExtractedData(data.result)
      } else if (data.status === 'failed') {
        clearInterval(interval)
        setScraping(false)
        alert('Failed to scan website')
      }
    }, 2000) // Poll every 2 seconds
  }
  
  // Save company profile and mark task complete
  async function saveCompanyProfile() {
    // Save company data
    await saveCompanyData(extractedData)
    
    // Find and complete the "Setup Company Profile" task
    const tasks = await getUserTasks('demo', currentUser.id)
    const setupTask = tasks.find(t => t.title.includes('Setup Company'))
    
    if (setupTask) {
      await updateTaskStatus(setupTask.id, 'completed')
    }
    
    // Navigate back to tasks
    window.location.href = '/tasks'
  }
  
  return (
    <div className="company-setup">
      <h1>Setup Company Profile</h1>
      
      {/* Display task instructions */}
      <TaskInstructions taskTitle="Setup Company Profile" />
      
      <div className="form">
        <label>Company Website URL</label>
        <input
          type="url"
          value={companyUrl}
          onChange={e => setCompanyUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <button onClick={scanWebsite} disabled={scraping}>
          {scraping ? 'Scanning...' : 'Scan Website'}
        </button>
      </div>
      
      {extractedData && (
        <div className="extracted-data">
          <h2>Extracted Company Information</h2>
          <p><strong>Title:</strong> {extractedData.title}</p>
          <p><strong>Description:</strong> {extractedData.description}</p>
          {/* Display other extracted fields */}
          
          <button onClick={saveCompanyProfile}>
            Save Company Profile
          </button>
        </div>
      )}
    </div>
  )
}

// Component to display task instructions inline
function TaskInstructions({ taskTitle }) {
  const [task, setTask] = useState(null)
  
  useEffect(() => {
    // Fetch task by title
    getUserTasks('demo', currentUser.id, 'pending')
      .then(tasks => {
        const found = tasks.find(t => t.title === taskTitle)
        if (found) {
          fetch(`/tasks/${found.id}`)
            .then(res => res.json())
            .then(data => setTask(data.task))
        }
      })
  }, [taskTitle])
  
  if (!task?.guide) return null
  
  return (
    <div className="inline-instructions">
      <details>
        <summary>View Instructions</summary>
        <div className="steps">
          {task.guide.steps.map(step => (
            <div key={step.stepNumber}>
              <strong>{step.stepNumber}. {step.title}</strong>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
```

## 7. Task Progress Dashboard

Display overall progress:

```typescript
function TaskProgressDashboard() {
  const [summary, setSummary] = useState(null)
  
  useEffect(() => {
    fetch(`/tasks/summary?tenantId=demo&userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => setSummary(data.summary))
  }, [])
  
  if (!summary) return <div>Loading...</div>
  
  const completionRate = summary.total > 0
    ? (summary.byStatus.completed / summary.total) * 100
    : 0
  
  return (
    <div className="progress-dashboard">
      <h2>Your Progress</h2>
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${completionRate}%` }}
        />
      </div>
      <p>{Math.round(completionRate)}% Complete</p>
      
      <div className="stats">
        <div className="stat">
          <span className="number">{summary.byStatus.pending}</span>
          <span className="label">Pending</span>
        </div>
        <div className="stat">
          <span className="number">{summary.byStatus.in_progress}</span>
          <span className="label">In Progress</span>
        </div>
        <div className="stat">
          <span className="number">{summary.byStatus.completed}</span>
          <span className="label">Completed</span>
        </div>
      </div>
      
      <div className="category-breakdown">
        <h3>Tasks by Category</h3>
        <ul>
          <li>Onboarding: {summary.byCategory.onboarding}</li>
          <li>Configuration: {summary.byCategory.configuration}</li>
          <li>Integration: {summary.byCategory.integration}</li>
          <li>Review: {summary.byCategory.review}</li>
        </ul>
      </div>
    </div>
  )
}
```

## 8. Real-time Task Updates

Use polling or WebSocket for real-time updates:

```typescript
// Polling approach
function useTaskUpdates(tenantId: string, userId: string) {
  const [tasks, setTasks] = useState([])
  
  useEffect(() => {
    const fetchTasks = async () => {
      const response = await fetch(`/tasks?tenantId=${tenantId}&userId=${userId}`)
      const { tasks } = await response.json()
      setTasks(tasks)
    }
    
    fetchTasks()
    const interval = setInterval(fetchTasks, 30000) // Poll every 30 seconds
    
    return () => clearInterval(interval)
  }, [tenantId, userId])
  
  return tasks
}

// Usage
function TaskListWithUpdates() {
  const tasks = useTaskUpdates('demo', currentUser.id)
  
  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}
```

## 9. Task Filtering UI

Allow users to filter tasks:

```typescript
function TaskFilter({ onFilterChange }) {
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  
  useEffect(() => {
    onFilterChange({ status, category, priority })
  }, [status, category, priority])
  
  return (
    <div className="task-filters">
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="">All Categories</option>
        <option value="onboarding">Onboarding</option>
        <option value="configuration">Configuration</option>
        <option value="integration">Integration</option>
        <option value="review">Review</option>
      </select>
      
      <select value={priority} onChange={e => setPriority(e.target.value)}>
        <option value="">All Priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  )
}

function FilterableTaskList() {
  const [tasks, setTasks] = useState([])
  const [filters, setFilters] = useState({})
  
  useEffect(() => {
    const params = new URLSearchParams({
      tenantId: 'demo',
      userId: currentUser.id,
      ...filters
    })
    
    fetch(`/tasks?${params}`)
      .then(res => res.json())
      .then(data => setTasks(data.tasks))
  }, [filters])
  
  return (
    <div>
      <TaskFilter onFilterChange={setFilters} />
      <div className="task-list">
        {tasks.map(task => <TaskCard key={task.id} task={task} />)}
      </div>
    </div>
  )
}
```

## 10. Task Notifications

Notify users of new tasks or upcoming due dates:

```typescript
function TaskNotifications() {
  const [notifications, setNotifications] = useState([])
  
  useEffect(() => {
    async function checkNotifications() {
      const tasks = await getUserTasks('demo', currentUser.id, 'pending')
      
      const newNotifications = []
      
      // Check for overdue tasks
      const now = new Date()
      tasks.forEach(task => {
        if (task.dueDate && new Date(task.dueDate) < now) {
          newNotifications.push({
            type: 'overdue',
            message: `Task "${task.title}" is overdue`,
            taskId: task.id
          })
        }
      })
      
      // Check for high priority tasks
      const highPriorityPending = tasks.filter(
        t => t.priority === 'high' || t.priority === 'critical'
      )
      
      if (highPriorityPending.length > 0) {
        newNotifications.push({
          type: 'priority',
          message: `You have ${highPriorityPending.length} high priority tasks`,
          taskId: null
        })
      }
      
      setNotifications(newNotifications)
    }
    
    checkNotifications()
    const interval = setInterval(checkNotifications, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="notifications">
      {notifications.map((notif, i) => (
        <div key={i} className={`notification ${notif.type}`}>
          {notif.message}
          {notif.taskId && (
            <button onClick={() => viewTask(notif.taskId)}>View</button>
          )}
        </div>
      ))}
    </div>
  )
}
```

## Summary

These examples demonstrate how to:
- Initialize onboarding tasks
- Display task counts and lists
- Show detailed step-by-step instructions
- Integrate with the website scraping API
- Track progress and completion
- Filter and search tasks
- Provide real-time updates
- Send notifications

The task management API provides a flexible foundation for building rich, educational onboarding experiences.

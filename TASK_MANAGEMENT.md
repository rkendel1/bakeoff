# Task Management API

The Task Management API provides endpoints for managing tasks with detailed instructions, guides, and screenshots. This enables onboarding workflows and platform education for users.

## Features

- **Task CRUD Operations**: Create, read, update, and delete tasks
- **Task Instructions**: Rich task guides with step-by-step instructions, screenshots, and action URLs
- **Task Filtering**: Filter tasks by status, category, priority, assignment, and tags
- **Task Summaries**: Aggregated task counts by status, priority, and category
- **Onboarding Tasks**: Pre-configured onboarding tasks automatically assigned to new users

## Data Model

### Task

```typescript
{
  id: string
  tenantId: string
  title: string
  description: string
  category: 'onboarding' | 'configuration' | 'integration' | 'review' | 'other'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  assignedTo?: string  // userId
  createdBy?: string   // userId
  guide?: TaskGuide
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dueDate?: Date
  tags?: string[]
}
```

### TaskGuide

```typescript
{
  title: string
  description: string
  estimatedTimeMinutes?: number
  videoUrl?: string
  documentationUrl?: string
  steps: InstructionStep[]
}
```

### InstructionStep

```typescript
{
  stepNumber: number
  title: string
  description: string
  screenshotUrl?: string
  actionUrl?: string  // e.g., "/settings/company"
  tips?: string[]
}
```

## API Endpoints

### 1. List Tasks

Get a list of tasks with optional filtering.

**Endpoint:** `GET /tasks`

**Query Parameters:**
- `tenantId` (required) - Tenant identifier
- `userId` (optional) - Filter by user tasks
- `status` (optional) - Filter by status: `pending`, `in_progress`, `completed`, `cancelled`
- `category` (optional) - Filter by category: `onboarding`, `configuration`, `integration`, `review`, `other`
- `priority` (optional) - Filter by priority: `low`, `medium`, `high`, `critical`
- `assignedTo` (optional) - Filter by assigned user

**Example:**

```bash
curl "http://localhost:8080/tasks?tenantId=demo&status=pending&category=onboarding"
```

**Response (200 OK):**

```json
{
  "tasks": [
    {
      "id": "task-1",
      "tenantId": "demo",
      "title": "Setup Company Profile",
      "description": "Define your organization identity and operational metadata",
      "category": "onboarding",
      "priority": "medium",
      "status": "pending",
      "assignedTo": "user-1",
      "guide": {
        "title": "How to Setup Your Company Profile",
        "description": "Configure your company information...",
        "estimatedTimeMinutes": 8,
        "steps": [...]
      },
      "createdAt": "2026-05-12T00:00:00.000Z",
      "updatedAt": "2026-05-12T00:00:00.000Z",
      "tags": ["onboarding", "setup"]
    }
  ]
}
```

### 2. Create Task

Create a new task.

**Endpoint:** `POST /tasks`

**Request Body:**

```json
{
  "tenantId": "demo",
  "title": "Complete Security Review",
  "description": "Review and approve security configurations",
  "category": "review",
  "priority": "high",
  "assignedTo": "user-1",
  "guide": {
    "title": "Security Review Guide",
    "description": "Step-by-step security review process",
    "estimatedTimeMinutes": 30,
    "steps": [
      {
        "stepNumber": 1,
        "title": "Review Access Controls",
        "description": "Verify user access permissions are correctly configured",
        "actionUrl": "/settings/security/access",
        "tips": ["Check for overprivileged users"]
      }
    ]
  },
  "tags": ["security", "compliance"]
}
```

**Response (201 Created):**

```json
{
  "task": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "demo",
    "title": "Complete Security Review",
    ...
  }
}
```

### 3. Get Task

Get a specific task by ID including full guide and instructions.

**Endpoint:** `GET /tasks/:id`

**Example:**

```bash
curl "http://localhost:8080/tasks/550e8400-e29b-41d4-a716-446655440000"
```

**Response (200 OK):**

```json
{
  "task": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "demo",
    "title": "Complete Security Review",
    "guide": {
      "steps": [...]
    },
    ...
  }
}
```

### 4. Update Task

Update a task's properties.

**Endpoint:** `PUT /tasks/:id`

**Request Body:**

```json
{
  "status": "in_progress",
  "assignedTo": "user-2"
}
```

**Response (200 OK):**

```json
{
  "task": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "assignedTo": "user-2",
    "updatedAt": "2026-05-12T10:00:00.000Z",
    ...
  }
}
```

### 5. Delete Task

Delete a task.

**Endpoint:** `DELETE /tasks/:id`

**Response:** `204 No Content`

### 6. Get Task Summary

Get aggregated task counts by status, priority, and category.

**Endpoint:** `GET /tasks/summary`

**Query Parameters:**
- `tenantId` (required) - Tenant identifier
- `userId` (optional) - Filter summary by user

**Example:**

```bash
curl "http://localhost:8080/tasks/summary?tenantId=demo&userId=user-1"
```

**Response (200 OK):**

```json
{
  "summary": {
    "tenantId": "demo",
    "userId": "user-1",
    "total": 5,
    "byStatus": {
      "pending": 3,
      "in_progress": 1,
      "completed": 1,
      "cancelled": 0
    },
    "byPriority": {
      "low": 1,
      "medium": 3,
      "high": 1,
      "critical": 0
    },
    "byCategory": {
      "onboarding": 3,
      "configuration": 1,
      "integration": 0,
      "review": 1,
      "other": 0
    }
  }
}
```

### 7. Initialize Onboarding Tasks

Create default onboarding tasks for a new user. Tasks are loaded from `onboarding-tasks.json` configuration.

**Endpoint:** `POST /onboarding/tasks/initialize`

**Request Body:**

```json
{
  "tenantId": "demo",
  "userId": "user-1"
}
```

**Response (201 Created):**

```json
{
  "message": "Onboarding tasks initialized successfully",
  "tasks": [
    {
      "id": "task-1",
      "title": "Create First Submission",
      "category": "onboarding",
      "status": "pending",
      "assignedTo": "user-1",
      ...
    },
    {
      "id": "task-2",
      "title": "Add First Form",
      ...
    },
    {
      "id": "task-3",
      "title": "Setup Company Profile",
      ...
    }
  ]
}
```

**Note:** If onboarding tasks already exist for the user, returns existing tasks with 200 OK.

## Onboarding Tasks Configuration

Default onboarding tasks are defined in `src/runtime/tasks/onboarding-tasks.json`. Platform owners can customize this file to update task instructions, guides, and screenshots.

### Example Configuration

```json
{
  "onboardingTasks": [
    {
      "id": "onboarding-3",
      "title": "Setup Company Profile",
      "description": "Define your organization identity and operational metadata",
      "category": "onboarding",
      "priority": "medium",
      "guide": {
        "title": "How to Setup Your Company Profile",
        "description": "Configure your company information...",
        "estimatedTimeMinutes": 8,
        "documentationUrl": "https://docs.example.com/setup/company",
        "steps": [
          {
            "stepNumber": 1,
            "title": "Navigate to Company Settings",
            "description": "Click on 'Settings' then 'Company'",
            "actionUrl": "/settings/company"
          },
          {
            "stepNumber": 2,
            "title": "Enter Company Information",
            "description": "Fill in company name and description",
            "tips": ["Use your official company name"]
          },
          {
            "stepNumber": 3,
            "title": "Add Your Website URL",
            "description": "Enter your website URL for automatic data extraction",
            "tips": [
              "Include https://",
              "The scan may take a few moments"
            ]
          }
        ]
      },
      "tags": ["onboarding", "setup"]
    }
  ]
}
```

## Integration with Site Processing

The "Setup Company Profile" onboarding task guides users to:

1. Navigate to `/settings/company`
2. Enter their company website URL
3. Trigger the site scraping service via `POST /site-requests`
4. Review and save the extracted company data

**Example Site Request Flow:**

```bash
# 1. User submits company URL via frontend
POST /site-requests
{
  "url": "https://example.com",
  "callbackUrl": "https://frontend.example.com/webhooks/company-data"
}

# 2. Backend queues the scraping job
Response: {
  "requestId": "req-123",
  "status": "queued",
  "statusEndpoint": "/site-requests/req-123"
}

# 3. Frontend polls for results
GET /site-requests/req-123

# 4. When complete, frontend populates company profile
Response: {
  "status": "completed",
  "result": {
    "title": "Example Company",
    "description": "...",
    ...
  }
}

# 5. User reviews and saves, task marked complete
PUT /tasks/onboarding-3
{
  "status": "completed"
}
```

## Usage Examples

### Get User's Pending Onboarding Tasks

```bash
curl "http://localhost:8080/tasks?tenantId=demo&userId=user-1&status=pending&category=onboarding"
```

### Mark Task as Complete

```bash
curl -X PUT "http://localhost:8080/tasks/task-id" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

### Get Task Counts for User

```bash
curl "http://localhost:8080/tasks/summary?tenantId=demo&userId=user-1"
```

## Frontend Integration

### Display Task with Instructions

```typescript
// Fetch task with guide
const response = await fetch(`/tasks/${taskId}`)
const { task } = await response.json()

// Render instructions
task.guide.steps.forEach(step => {
  console.log(`${step.stepNumber}. ${step.title}`)
  console.log(step.description)
  if (step.actionUrl) {
    console.log(`Action: ${step.actionUrl}`)
  }
  if (step.tips) {
    step.tips.forEach(tip => console.log(`  💡 ${tip}`))
  }
})
```

### Show Task Counts in Navigation

```typescript
// Fetch task summary
const response = await fetch(`/tasks/summary?tenantId=${tenantId}&userId=${userId}`)
const { summary } = await response.json()

// Display in UI
console.log(`Tasks (${summary.byStatus.pending})`)
```

### Initialize Tasks for New User

```typescript
// When user completes onboarding signup
const response = await fetch('/onboarding/tasks/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'demo',
    userId: 'new-user-id'
  })
})

const { tasks } = await response.json()
console.log(`Created ${tasks.length} onboarding tasks`)
```

## Error Responses

All endpoints return standard error responses:

**400 Bad Request:**
```json
{
  "error": "Missing required parameter: tenantId"
}
```

**404 Not Found:**
```json
{
  "error": "Task not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal error"
}
```

## Security Considerations

- Task API endpoints can be protected with the runtime API key when `RUNTIME_API_KEY` environment variable is set
- Tasks are scoped by `tenantId` to ensure multi-tenant isolation
- User IDs in `assignedTo` field should be validated against your authentication system
- Screenshot URLs and action URLs should be validated before rendering in the frontend

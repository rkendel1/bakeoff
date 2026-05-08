# Runtime Worker

The RuntimeWorker is the execution plane component that continuously polls the ExecutionQueue and processes events through the RuntimeEngine.

## Role in Architecture

The RuntimeWorker sits in the **Execution Plane**, separate from the Control Plane (API):

```
┌─────────────────────────────────────────────────────┐
│                 Control Plane                       │
│                                                     │
│  ControlPlaneServer → ExecutionQueue.enqueue()     │
│                            ↓                        │
└────────────────────────────┼────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────┐
│                 Execution Plane                     │
│                            ↓                        │
│  RuntimeWorker.dequeue() → RuntimeEngine.ingest()  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Responsibilities

1. **Poll Queue**: Continuously checks ExecutionQueue for new events
2. **Execute Events**: Processes events through the RuntimeEngine
3. **Error Handling**: Manages execution failures without affecting other events
4. **Lifecycle Management**: Start/stop worker cleanly

## Usage

```typescript
import { ExecutionQueue } from '../queue/execution-queue.js'
import { RuntimeWorker } from './runtime-worker.js'

// Create queue and worker
const queue = new ExecutionQueue()
const worker = new RuntimeWorker(queue, engines, 100) // 100ms poll interval

// Start processing
worker.start()

// Events are automatically picked up and processed
// ...

// Stop processing
worker.stop()
```

## Configuration

### Poll Interval

The worker polls the queue at a configurable interval (default: 100ms):

```typescript
const worker = new RuntimeWorker(queue, engines, 50) // Poll every 50ms
```

A shorter interval provides lower latency but higher CPU usage. A longer interval reduces CPU but increases latency.

## API

### `start(): void`

Starts the worker polling loop. Events will be automatically picked up from the queue and processed.

### `stop(): void`

Stops the worker polling loop. Any in-flight execution will complete, but no new events will be picked up.

### `getStatus(): { running: boolean; queueSize: number }`

Returns the current worker status:
- `running`: Whether the worker is actively polling
- `queueSize`: Current number of events in the queue

## Error Handling

The worker is resilient to execution failures:

1. If an event execution fails, the error is logged
2. The failure is already tracked in ExecutionStore
3. The worker continues processing other events
4. Failed events do not block the queue

## Worker Pools (Future)

This single-worker implementation can be extended to support worker pools:

```typescript
// Create multiple workers
const workers = [
  new RuntimeWorker(queue, engines),
  new RuntimeWorker(queue, engines),
  new RuntimeWorker(queue, engines)
]

// Start all workers
workers.forEach(w => w.start())
```

Each worker independently polls the queue, enabling parallel execution and higher throughput.

## Scaling Patterns

### Vertical Scaling
Add more workers to a single process:
```typescript
const workerCount = 4
const workers = Array.from({ length: workerCount }, () => 
  new RuntimeWorker(queue, engines)
)
workers.forEach(w => w.start())
```

### Horizontal Scaling
Run multiple processes with shared queue (requires persistent queue like Redis):
```typescript
// Process 1
const worker1 = new RuntimeWorker(redisQueue, engines)
worker1.start()

// Process 2
const worker2 = new RuntimeWorker(redisQueue, engines)
worker2.start()
```

## Monitoring

Worker status can be monitored:

```typescript
const status = worker.getStatus()
console.log(`Worker running: ${status.running}`)
console.log(`Queue size: ${status.queueSize}`)
```

For production, integrate with metrics systems:
- Queue depth (backlog)
- Processing rate (events/sec)
- Error rate
- Worker count

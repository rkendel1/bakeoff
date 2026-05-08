# Execution Queue

The ExecutionQueue is a core abstraction that decouples the Control Plane (API layer) from the Execution Plane (workers).

## Architecture

### Before (Synchronous)

```
POST /events → engine.ingest()
```

The API server directly called `engine.ingest()`, making event processing synchronous and tightly coupled to the HTTP request/response cycle.

### After (Asynchronous)

```
POST /events → queue.enqueue(event)
                    ↓
              worker.dequeue()
                    ↓
          engine.ingest(event)
```

Events are enqueued for asynchronous processing, enabling:
- **Control Plane**: Receives events, validates, and enqueues
- **Execution Plane**: Workers poll the queue and process events

## Benefits

1. **Decoupling**: Control plane and execution plane are independent
2. **Scalability**: Workers can be scaled independently of the API layer
3. **Resilience**: API responses are fast (202 Accepted), execution happens asynchronously
4. **Worker Pools**: Foundation for multiple workers and distributed execution
5. **Backpressure**: Queue size can be monitored and used for load management

## Usage

```typescript
import { ExecutionQueue } from './runtime/queue/execution-queue.js'
import { RuntimeWorker } from './runtime/worker/runtime-worker.js'

// Create queue
const queue = new ExecutionQueue()

// Create worker
const worker = new RuntimeWorker(queue, engines)
worker.start()

// Control plane enqueues events
queue.enqueue({
  tenantId: 'demo',
  entityId: 'doc-123',
  entityType: 'document',
  type: 'document.uploaded',
  payload: {}
})

// Worker automatically picks up and processes
```

## API

### `enqueue(event: RuntimeEvent): void`

Adds an event to the queue for processing.

### `dequeue(): RuntimeEvent | undefined`

Removes and returns the next event from the queue. Returns `undefined` if queue is empty.

### `size(): number`

Returns the current number of events in the queue.

### `hasPending(): boolean`

Returns `true` if there are events pending in the queue.

## Future Enhancements

This in-memory queue is designed for simplicity and can be replaced with:
- **Redis Queue**: For distributed workers
- **RabbitMQ/SQS**: For durability and guaranteed delivery
- **Kafka**: For event streaming and replay
- **Database-backed Queue**: For persistence

The interface remains the same, making it easy to swap implementations.

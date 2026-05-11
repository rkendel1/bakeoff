# Site Processing Worker Management

The bakeoff runtime now manages site processing (web scraping) jobs using a dedicated worker system that follows the same reliable execution patterns as the RuntimeWorker.

## Architecture

```
POST /site-requests → SiteJobQueue → SiteProcessingWorker → Site Processor → Callback Notification
```

### Components

1. **SiteJobQueue** - Durable queue for site processing jobs
   - Explicit lifecycle tracking (queued → processing → completed/failed)
   - Acknowledged processing (ack/fail semantics)
   - Automatic retry with exponential backoff (up to 3 attempts)
   - Crash safety (jobs remain in queue until acknowledged)

2. **SiteProcessingWorker** - Worker that polls the queue and processes jobs
   - Continuous polling (configurable interval, default 100ms)
   - Acknowledged execution with retry semantics
   - Handles transient failures with automatic retries
   - Manages worker lifecycle (start/stop)
   - Sends callback notifications on completion

3. **Site Processor** - The actual site scraping logic
   - Tries tokens CLI extractor first (if available)
   - Falls back to basic fetch if extractor unavailable
   - Returns structured site metadata (title, description, etc.)

## API Usage

### Submit a Site Processing Request

```bash
curl -X POST http://localhost:8080/site-requests \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "callbackUrl": "https://yourapp.com/webhooks/site-completed"
  }'
```

Response (202 Accepted):
```json
{
  "requestId": "9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa",
  "status": "queued",
  "submittedAt": "2026-01-01T00:00:00.000Z",
  "statusEndpoint": "/site-requests/9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa"
}
```

### Check Job Status

```bash
curl http://localhost:8080/site-requests/9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa
```

Response (200 OK):
```json
{
  "requestId": "9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa",
  "url": "https://example.com/",
  "status": "completed",
  "submittedAt": "2026-01-01T00:00:00.000Z",
  "startedAt": "2026-01-01T00:00:00.200Z",
  "completedAt": "2026-01-01T00:00:01.450Z",
  "result": {
    "source": "basic-fetch",
    "url": "https://example.com/",
    "statusCode": 200,
    "contentType": "text/html",
    "title": "Example Domain"
  }
}
```

## Job Statuses

- `queued` - Job is waiting to be processed
- `processing` - Job is currently being processed
- `completed` - Job completed successfully
- `failed` - Job failed after max retry attempts (3)
- `retrying` - Job failed but will be retried (scheduled for future attempt)

## Retry Behavior

Failed jobs are automatically retried up to 3 times with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds

After 3 failed attempts, the job is marked as permanently failed.

## Callback Notifications

If a `callbackUrl` is provided when submitting a request, the runtime will send a POST notification to that URL when the job completes (success or failure):

```json
{
  "requestId": "9abce2af-52f7-4c59-89dd-2f7a7ef5a6fa",
  "url": "https://example.com/",
  "status": "completed",
  "submittedAt": "2026-01-01T00:00:00.000Z",
  "startedAt": "2026-01-01T00:00:00.200Z",
  "completedAt": "2026-01-01T00:00:01.450Z",
  "result": { ... },
  "error": null
}
```

## Configuration

### Environment Variables

- `TOKENS_CLI_PATH` - Path to tokens extractor CLI (default: `/opt/tokens/index.js`)
- `TOKENS_NO_SANDBOX` - Set to `'true'` to disable sandbox mode for tokens extractor

### Worker Configuration

The worker can be configured when creating the instance:

```typescript
const worker = new SiteProcessingWorker(
  queue,
  processor,
  callbackNotifier,
  pollIntervalMs  // Default: 100ms
)
```

## Production Deployment

The site processing worker is automatically started in the production server (`src/server.ts`):

```typescript
// Site processing infrastructure
const siteJobQueue = new SiteJobQueue()
const siteWorker = new SiteProcessingWorker(
  siteJobQueue,
  defaultSiteProcessor,
  notifySiteJobCallback
)
siteWorker.start()
```

The worker is gracefully shut down on SIGTERM/SIGINT signals.

## Key Benefits

1. **Reliability** - Jobs are crash-safe and remain in queue until acknowledged
2. **Resilience** - Automatic retries for transient failures
3. **Scalability** - Workers can be scaled independently of the API server
4. **Observability** - Job status tracking and callback notifications
5. **Performance** - Non-blocking asynchronous processing

## Demo

Run the demo to see the worker in action:

```bash
npx tsx demo-site-worker.ts
```

This demonstrates:
- Job enqueueing and processing
- Automatic retries on failure
- Callback notifications
- Worker lifecycle management

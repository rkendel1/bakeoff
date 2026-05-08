import http from 'node:http'
import type { RuntimeEvent } from '../../models/event.js'
import type { RuntimeEngine } from '../engine.js'
import type { ExecutionQuery } from '../control-plane/execution-query.js'
import type { RuntimeInspector } from '../control-plane/inspector.js'
import type { TenantRuntimeRegistry } from '../registry/tenant-registry.js'
import type { ExecutionRecord } from '../store/execution-record.js'
import { simulate } from '../simulate/simulation-engine.js'

/**
 * ControlPlaneServer - HTTP API server for the runtime control plane
 * 
 * This server exposes the runtime as a clean control plane API so that:
 * - Tenants can send events externally
 * - Executions can be queried externally
 * - Models can be managed externally
 * - Simulations can be triggered externally
 * 
 * This is the bridge between engine internals → your platform
 */
export class ControlPlaneServer {
  private server: http.Server

  constructor(
    private readonly registry: TenantRuntimeRegistry,
    private readonly engines: Map<string, RuntimeEngine>,
    private readonly executionQuery: ExecutionQuery,
    private readonly inspector: RuntimeInspector
  ) {
    this.server = http.createServer(this.handleRequest.bind(this))
  }

  /**
   * Start the API server
   */
  start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`Control Plane API listening on port ${port}`)
        resolve()
      })
    })
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve()
      })
    })
  }

  /**
   * Main request handler
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    try {
      // Route requests
      if (req.method === 'POST' && pathname === '/events') {
        await this.handleIngestEvent(req, res)
      } else if (req.method === 'GET' && pathname === '/executions') {
        await this.handleQueryExecutions(req, res, url)
      } else if (req.method === 'GET' && pathname.startsWith('/executions/')) {
        await this.handleInspectExecution(req, res, pathname)
      } else if (req.method === 'POST' && pathname === '/simulate') {
        await this.handleSimulate(req, res)
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    } catch (error) {
      console.error('API error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error'
        })
      )
    }
  }

  /**
   * POST /events - Ingest an event
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "entityId": "doc-123",
   *   "entityType": "document",
   *   "type": "document.uploaded",
   *   "payload": {}
   * }
   */
  private async handleIngestEvent(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    let event: RuntimeEvent
    
    try {
      const body = await this.readBody(req)
      event = JSON.parse(body)
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid JSON in request body'
      }))
      return
    }

    // Validate tenant exists
    if (!this.registry.hasTenant(event.tenantId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Tenant not found' }))
      return
    }

    // Get or create engine for tenant
    const engine = this.engines.get(event.tenantId)
    if (!engine) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Runtime engine not initialized for tenant' }))
      return
    }

    // Ingest event
    await engine.ingest(event)

    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'accepted', event }))
  }

  /**
   * GET /executions?tenantId=&entityId=&status=
   * 
   * Query executions with filters
   */
  private async handleQueryExecutions(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const tenantId = url.searchParams.get('tenantId')
    const entityId = url.searchParams.get('entityId')
    const status = url.searchParams.get('status') as 'running' | 'completed' | 'failed' | null

    let executions: ExecutionRecord[]

    if (tenantId && entityId) {
      // Query by entity
      executions = await this.executionQuery.getByEntity(tenantId, entityId)
    } else if (tenantId && status === 'failed') {
      // Query failed executions
      executions = await this.executionQuery.getFailed(tenantId)
    } else if (tenantId) {
      // Query all executions for tenant (not implemented in ExecutionQuery, return empty)
      executions = []
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'tenantId parameter required' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ executions }))
  }

  /**
   * GET /executions/:id - Inspect a specific execution
   * 
   * Returns RuntimeInspector.inspect() output
   */
  private async handleInspectExecution(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    const id = pathname.split('/')[2]
    
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution ID required' }))
      return
    }

    const execution = await this.executionQuery.getById(id)
    
    if (!execution) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Execution not found' }))
      return
    }

    const inspection = this.inspector.inspect(execution)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ inspection }))
  }

  /**
   * POST /simulate - Simulate an execution
   * 
   * Body:
   * {
   *   "tenantId": "t1",
   *   "event": {...},
   *   "modelVersion": "latest",
   *   "currentState": "draft"
   * }
   */
  private async handleSimulate(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    let tenantId: string
    let event: RuntimeEvent
    let modelVersion: string
    let currentState: string | undefined
    
    try {
      const body = await this.readBody(req)
      const parsed = JSON.parse(body)
      tenantId = parsed.tenantId
      event = parsed.event
      modelVersion = parsed.modelVersion || 'latest'
      currentState = parsed.currentState
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid JSON in request body'
      }))
      return
    }

    // Get model version
    const model = this.registry.getModelVersion(tenantId, modelVersion)
    
    if (!model) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Model version not found' }))
      return
    }

    // Run simulation
    const simulation = await simulate(event, model, currentState)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ simulation }))
  }

  /**
   * Helper to read request body with size limit
   */
  private readBody(req: http.IncomingMessage, maxSize: number = 1024 * 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      let size = 0
      
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > maxSize) {
          req.destroy()
          reject(new Error('Request body too large'))
          return
        }
        body += chunk.toString()
      })
      
      req.on('end', () => {
        resolve(body)
      })
      
      req.on('error', reject)
    })
  }
}

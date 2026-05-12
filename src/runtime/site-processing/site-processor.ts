import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const DEFAULT_TOKENS_CLI_PATH = '/opt/tokens/index.js'
const MAX_TOKENS_PROCESS_OUTPUT_CHARS = 1_000_000
const MAX_SITE_RESPONSE_BODY_CHARS = 200_000
const MAX_LOG_STDERR_CHARS = 500

/**
 * Default site processor that uses either tokens CLI or basic fetch
 */
export async function defaultSiteProcessor(url: string): Promise<unknown> {
  const tokensCliPath = process.env.TOKENS_CLI_PATH || DEFAULT_TOKENS_CLI_PATH
  if (existsSync(tokensCliPath)) {
    console.log('[site-processor] tokens CLI found, using extractor', { url, tokensCliPath })
    try {
      return await processWithTokensCli(tokensCliPath, url)
    } catch (error) {
      console.warn('[site-processor] tokens extractor failed, falling back to basic fetch', {
        url,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    console.log('[site-processor] tokens CLI not found, using basic fetch', { url, tokensCliPath })
  }

  return processWithBasicSiteFetch(url)
}

/**
 * Process site using tokens CLI extractor
 */
async function processWithTokensCli(tokensCliPath: string, url: string): Promise<unknown> {
  const startTime = Date.now()
  const cliArgs = [tokensCliPath, url, '--json-only']
  if (process.env.TOKENS_NO_SANDBOX === 'true') {
    cliArgs.push('--no-sandbox')
  }

  console.log('[site-processor] starting tokens extractor', { url, args: cliArgs })

  const { stdout, stderr, exitCode } = await new Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      cliArgs,
      { env: process.env }
    )

    let stdout = ''
    let stderr = ''
    let settled = false

    const fail = (message: string) => {
      if (settled) {
        return
      }
      settled = true
      child.kill()
      reject(new Error(message))
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > MAX_TOKENS_PROCESS_OUTPUT_CHARS) {
        fail('tokens extractor output exceeded maximum allowed size')
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > MAX_TOKENS_PROCESS_OUTPUT_CHARS) {
        fail('tokens extractor error output exceeded maximum allowed size')
      }
    })
    child.on('error', (error) => {
      if (settled) {
        return
      }
      settled = true
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) {
        return
      }
      settled = true
      resolve({ stdout, stderr, exitCode: code ?? 1 })
    })
  })

  const elapsedMs = Date.now() - startTime

  if (exitCode !== 0) {
    console.error('[site-processor] tokens extractor failed', {
      url,
      exitCode,
      elapsedMs,
      stderr: stderr.slice(0, MAX_LOG_STDERR_CHARS) // Log first 500 chars of stderr
    })
    throw new Error(
      `tokens extractor failed (exit=${exitCode}): ${stderr.trim() || 'unknown error'}`
    )
  }

  const parsed = parseJsonFromOutput(stdout)
  if (parsed === null) {
    console.error('[site-processor] tokens extractor returned non-JSON output', { url, elapsedMs })
    throw new Error('tokens extractor returned non-JSON output')
  }

  console.log('[site-processor] tokens extractor completed successfully', {
    url,
    elapsedMs,
    outputSize: stdout.length
  })

  return parsed
}

/**
 * Parse JSON from output, handling cases where output may contain non-JSON text
 */
function parseJsonFromOutput(output: string): unknown | null {
  const trimmed = output.trim()
  if (!trimmed) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1)
      try {
        return JSON.parse(candidate)
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Process site using basic fetch (fallback)
 */
async function processWithBasicSiteFetch(url: string): Promise<unknown> {
  const startTime = Date.now()
  console.log('[site-processor] starting basic fetch', { url })

  const response = await fetch(url)
  const contentType = response.headers.get('content-type') || ''
  const body = (await response.text()).slice(0, MAX_SITE_RESPONSE_BODY_CHARS)

  const title = matchHtmlTagContent(body, 'title')
  const description = matchMetaDescription(body)

  const elapsedMs = Date.now() - startTime
  console.log('[site-processor] basic fetch completed', {
    url,
    statusCode: response.status,
    contentType,
    elapsedMs,
    bodySize: body.length,
    hasTitle: !!title,
    hasDescription: !!description
  })

  return {
    source: 'basic-fetch',
    url: response.url,
    statusCode: response.status,
    contentType,
    title,
    description
  }
}

/**
 * Extract content from HTML tag
 */
function matchHtmlTagContent(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1]?.trim() || null
}

/**
 * Extract meta description from HTML
 */
function matchMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta[^>]+name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i
  )
  return match?.[1]?.trim() || null
}

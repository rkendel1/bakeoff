import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const DEFAULT_TOKENS_CLI_PATH = '/opt/tokens/index.js'
const MAX_TOKENS_PROCESS_OUTPUT_CHARS = 1_000_000
const MAX_SITE_RESPONSE_BODY_CHARS = 200_000

/**
 * Default site processor that uses either tokens CLI or basic fetch
 */
export async function defaultSiteProcessor(url: string): Promise<unknown> {
  const tokensCliPath = process.env.TOKENS_CLI_PATH || DEFAULT_TOKENS_CLI_PATH
  if (existsSync(tokensCliPath)) {
    try {
      return await processWithTokensCli(tokensCliPath, url)
    } catch (error) {
      console.warn('tokens extractor unavailable, falling back to basic fetch', {
        url,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return processWithBasicSiteFetch(url)
}

/**
 * Process site using tokens CLI extractor
 */
async function processWithTokensCli(tokensCliPath: string, url: string): Promise<unknown> {
  const cliArgs = [tokensCliPath, url, '--json-only']
  if (process.env.TOKENS_NO_SANDBOX === 'true') {
    cliArgs.push('--no-sandbox')
  }

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

  if (exitCode !== 0) {
    throw new Error(
      `tokens extractor failed (exit=${exitCode}): ${stderr.trim() || 'unknown error'}`
    )
  }

  const parsed = parseJsonFromOutput(stdout)
  if (parsed === null) {
    throw new Error('tokens extractor returned non-JSON output')
  }

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
  const response = await fetch(url)
  const contentType = response.headers.get('content-type') || ''
  const body = (await response.text()).slice(0, MAX_SITE_RESPONSE_BODY_CHARS)

  const title = matchHtmlTagContent(body, 'title')
  const description = matchMetaDescription(body)

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

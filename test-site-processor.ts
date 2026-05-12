#!/usr/bin/env tsx

/**
 * Test script to verify site processor logging
 */

import { defaultSiteProcessor } from './src/runtime/site-processing/site-processor.js'

async function main() {
  console.log('==============================================')
  console.log('  Testing Site Processor Logging')
  console.log('==============================================\n')

  // Test with a real URL (using basic fetch since tokens CLI is not installed)
  console.log('Testing site processor with real URL...\n')

  try {
    const result = await defaultSiteProcessor('https://example.com')
    console.log('\n✓ Site processing completed successfully')
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('\n✗ Site processing failed:', error)
    process.exit(1)
  }

  console.log('\n==============================================')
  console.log('  Test Complete')
  console.log('==============================================')
}

main()

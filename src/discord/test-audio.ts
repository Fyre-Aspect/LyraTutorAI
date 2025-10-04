#!/usr/bin/env tsx
/**
 * Test runner for audio processor
 */

import { DiscordAudioProcessor } from './audio-processor-v2';

async function main() {
  console.log('Starting Audio Processor Tests...\n');
  
  const processor = new DiscordAudioProcessor();
  await processor.runTests();
  
  console.log('✅ All tests completed successfully!');
}

main().catch(console.error);

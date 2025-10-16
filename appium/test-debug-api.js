#!/usr/bin/env node

const { handleDebugAPI } = require('./app/api/debug/debug');

async function test() {
  console.log('Testing debug API...\n');

  try {
    console.log('1. Testing screenshot...');
    const screenshotResult = await handleDebugAPI('GET', 'screenshot', {}, {});
    console.log('Screenshot result:', {
      success: screenshotResult.success,
      hasImage: !!screenshotResult.image,
      imageLength: screenshotResult.image?.length,
      error: screenshotResult.error
    });

    console.log('\n2. Testing UI dump...');
    const dumpResult = await handleDebugAPI('GET', 'dump', {}, {});
    console.log('Dump result:', {
      success: dumpResult.success,
      nodeCount: dumpResult.data?.length,
      error: dumpResult.error
    });

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();

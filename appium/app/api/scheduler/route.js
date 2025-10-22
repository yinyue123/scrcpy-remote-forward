/**
 * Task Scheduler API Route
 * Endpoint to check and execute scheduled tasks
 *
 * Usage:
 * GET /api/scheduler - Trigger task check and execution
 */

import TaskScheduler from '../../src/scheduler';
import path from 'path';

// GET - Trigger task check and execution
export async function GET(request) {
  try {
    const scriptsDir = path.join(process.cwd(), 'app', 'scripts');
    const scheduler = new TaskScheduler(scriptsDir);

    console.log('[Scheduler API] Task check triggered via GET request');

    // Execute tasks in background (non-blocking)
    scheduler.checkAndExecuteTasks().catch(error => {
      console.error('[Scheduler API] Background task error:', error);
    });

    // Return 204 No Content immediately
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[Scheduler API] Error:', error);
    return Response.json({
      success: false,
      message: 'Failed to trigger task check',
      error: error.message
    }, { status: 500 });
  }
}

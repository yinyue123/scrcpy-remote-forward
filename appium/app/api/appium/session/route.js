import { NextResponse } from 'next/server'
import { startAppiumSession, stopAppiumSession } from '../../../../src/lib/appium'

// API Route: /api/appium/session
// - File: app/api/appium/session/route.js
// - Notice the nested folder structure: api/appium/session/
// - Only POST method is defined, so GET/PUT/DELETE will return 405 Method Not Allowed
export async function POST(request) {
  try {
    // Parse JSON from request body
    const body = await request.json()
    const { action } = body

    // Handle different actions based on request body
    if (action === 'start') {
      await startAppiumSession()
      return NextResponse.json({ success: true, message: 'Appium session started' })
    } else if (action === 'stop') {
      await stopAppiumSession()
      return NextResponse.json({ success: true, message: 'Appium session stopped' })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { startAppiumSession, stopAppiumSession, getDriver } from '../../src/appium'

// API Route: /api/session
// Session management without screenshot

// GET method for checking session status
export async function GET(request) {
  try {
    const driver = getDriver()
    const isConnected = driver !== null

    return NextResponse.json({
      success: true,
      connected: isConnected,
      status: isConnected ? 'Connected' : 'Disconnected'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, connected: false, status: 'Disconnected', error: error.message },
      { status: 500 }
    )
  }
}

// POST method for starting/stopping session
export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body

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

import { NextResponse } from 'next/server'
import { lockDevice, unlockDevice } from '../../../../src/lib/unlock'

export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'unlock') {
      await unlockDevice()
      return NextResponse.json({ success: true, message: 'Device unlocked' })
    } else if (action === 'lock') {
      await lockDevice()
      return NextResponse.json({ success: true, message: 'Device locked' })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "unlock" or "lock"' },
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

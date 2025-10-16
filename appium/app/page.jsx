// 'use client': This directive tells Next.js this is a CLIENT COMPONENT
// - Runs in the browser (can use useState, onClick, browser APIs)
// - Without this, components are SERVER COMPONENTS by default (run on server only)
// - Use 'use client' when you need: state, effects, event handlers, browser APIs
'use client'

// Import React hooks - only works in Client Components
import { useState } from 'react'

// Link: Next.js component for navigation between pages
// - Uses client-side navigation (no full page reload)
// - Prefetches linked pages for faster navigation
// - Example: <Link href="/debug">Go to Debug</Link>
import Link from 'next/link'

// HomePage: This is a PAGE component
// - File location: app/page.jsx → Route: "/"
// - This is the home page of your app
// - Default export is required for page components
export default function HomePage() {
  // useState: React hook for managing component state
  // - Only works in Client Components (needs 'use client')
  // - Re-renders component when state changes
  const [sessionActive, setSessionActive] = useState(false)
  const [status, setStatus] = useState('Disconnected')
  const [logs, setLogs] = useState([])
  const [results, setResults] = useState([])
  const [command, setCommand] = useState('')

  const addLog = (message) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const addResult = (command, status, data = null, error = null) => {
    const result = {
      timestamp: new Date().toLocaleTimeString(),
      command,
      status,
      data,
      error,
      type: status === 'error' ? 'error' : 'success',
    }
    setResults(prev => [result, ...prev])
  }

  // handleStartSession: Event handler for button click
  // - async: allows using 'await' for asynchronous operations
  const handleStartSession = async () => {
    try {
      setStatus('Connecting...')
      addLog('Starting Appium session...')
      addResult('Start Session', 'pending')

      // fetch: Call Next.js API route
      // - Route: /api/appium/session → File: app/api/appium/session/route.js
      // - No need for full URL (e.g., http://localhost:3000), just use relative path
      // - Next.js automatically handles routing
      const res = await fetch('/api/appium/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })
      const data = await res.json()

      if (data.success) {
        setSessionActive(true)
        setStatus('Connected')
        addLog('Session started successfully')
        addResult('Start Session', 'success', 'Appium session started')
      } else {
        throw new Error(data.error || 'Failed to start session')
      }
    } catch (error) {
      setStatus('Error')
      addLog(`Error: ${error.message}`)
      addResult('Start Session', 'error', null, error.message)
    }
  }

  const handleStopSession = async () => {
    try {
      setStatus('Disconnecting...')
      addLog('Stopping Appium session...')
      addResult('Stop Session', 'pending')

      const res = await fetch('/api/appium/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      const data = await res.json()

      if (data.success) {
        setSessionActive(false)
        setStatus('Disconnected')
        addLog('Session stopped successfully')
        addResult('Stop Session', 'success', 'Appium session stopped')
      } else {
        throw new Error(data.error || 'Failed to stop session')
      }
    } catch (error) {
      addLog(`Error: ${error.message}`)
      addResult('Stop Session', 'error', null, error.message)
    }
  }

  const handleExecuteCommand = async () => {
    if (!command) return

    try {
      addLog(`Executing command: ${command}`)
      addResult(command, 'pending')

      const res = await fetch('/api/appium/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      const data = await res.json()

      if (data.success) {
        addLog(`Command completed: ${command}`)
        addResult(command, 'success', data.result)
      } else {
        throw new Error(data.error || 'Command failed')
      }
    } catch (error) {
      addLog(`Error: ${error.message}`)
      addResult(command, 'error', null, error.message)
    }
  }

  const handleUnlockDevice = async () => {
    try {
      addLog('Unlocking device...')
      addResult('Unlock Device', 'pending')

      const res = await fetch('/api/appium/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock' })
      })
      const data = await res.json()

      if (data.success) {
        addLog('Device unlocked successfully')
        addResult('Unlock Device', 'success', 'Device unlocked')
      } else {
        throw new Error(data.error || 'Failed to unlock')
      }
    } catch (error) {
      addLog(`Error: ${error.message}`)
      addResult('Unlock Device', 'error', null, error.message)
    }
  }

  const handleLockDevice = async () => {
    try {
      addLog('Locking device...')
      addResult('Lock Device', 'pending')

      const res = await fetch('/api/appium/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' })
      })
      const data = await res.json()

      if (data.success) {
        addLog('Device locked successfully')
        addResult('Lock Device', 'success', 'Device locked')
      } else {
        throw new Error(data.error || 'Failed to lock')
      }
    } catch (error) {
      addLog(`Error: ${error.message}`)
      addResult('Lock Device', 'error', null, error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-2xl p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Appium Control Interface
              </h1>
              <p className="text-gray-400 mt-1">Device automation and testing platform</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  status === 'Connected' ? 'bg-green-500 animate-pulse' :
                  status === 'Disconnected' ? 'bg-red-500' :
                  'bg-yellow-500 animate-pulse'
                }`}></div>
                <span className="text-sm font-medium">{status}</span>
              </div>
              {/* Link component: Next.js navigation */}
              {/* href="/debug" → goes to app/debug/page.jsx */}
              {/* Client-side navigation (no page reload) */}
              <Link
                href="/debug"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <span>🐛</span>
                <span>Debug</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Control Panel */}
          <div className="space-y-6">
            {/* Session Controls */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <span className="text-2xl">🎮</span>
                <span>Session Control</span>
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleStartSession}
                  disabled={sessionActive}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all duration-200 ${
                    sessionActive
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 hover:shadow-lg hover:shadow-green-500/50'
                  }`}
                >
                  Start Session
                </button>
                <button
                  onClick={handleStopSession}
                  disabled={!sessionActive}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all duration-200 ${
                    !sessionActive
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/50'
                  }`}
                >
                  Stop Session
                </button>
              </div>
            </div>

            {/* Command Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <span className="text-2xl">⚡</span>
                <span>Execute Command</span>
              </h2>
              <div className="space-y-3">
                <select
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={!sessionActive}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a command...</option>
                  <option value="tap">Tap (500, 500)</option>
                  <option value="swipe">Swipe (Bottom to Top)</option>
                  <option value="getSource">Get Page Source</option>
                  <option value="screenshot">Take Screenshot</option>
                </select>
                <button
                  onClick={handleExecuteCommand}
                  disabled={!sessionActive || !command}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/50"
                >
                  Execute
                </button>
              </div>
            </div>

            {/* Unlock Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <span className="text-2xl">🔐</span>
                <span>Device Lock</span>
              </h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleUnlockDevice}
                  disabled={!sessionActive}
                  className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-yellow-500/50"
                >
                  Unlock Device
                </button>
                <button
                  onClick={handleLockDevice}
                  disabled={!sessionActive}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/50"
                >
                  Lock Device
                </button>
              </div>
            </div>
          </div>

          {/* Results and Logs */}
          <div className="space-y-6">
            {/* Results Panel */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <span>Results</span>
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No results yet</p>
                ) : (
                  results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.type === 'error'
                          ? 'bg-red-900/30 border-red-700'
                          : result.status === 'pending'
                          ? 'bg-yellow-900/30 border-yellow-700'
                          : 'bg-green-900/30 border-green-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{result.command}</span>
                        <span className="text-xs text-gray-400">{result.timestamp}</span>
                      </div>
                      {result.data && (
                        <div className="text-sm text-gray-300 mt-1 font-mono">
                          {typeof result.data === 'string' ? result.data : JSON.stringify(result.data)}
                        </div>
                      )}
                      {result.error && (
                        <div className="text-sm text-red-400 mt-1">{result.error}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Logs Panel */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <span className="text-2xl">📝</span>
                <span>Logs</span>
              </h2>
              <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No logs yet</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-gray-300 py-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

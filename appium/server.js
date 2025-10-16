const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')
const {
  getDebugDriver,
  closeDebugSession,
  getUIDump,
  takeScreenshot,
  clickAtCoordinates,
  getCurrentActivity
} = require('./app/api/debug/debug')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Store WebSocket connections with their sessions
const connections = new Map()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  // Create WebSocket server
  const wss = new WebSocketServer({ server, path: '/api/debug/ws' })

  wss.on('connection', async (ws) => {
    const clientId = Date.now() + Math.random()
    console.log(`[WebSocket] Client ${clientId} connected`)

    // Initialize session for this client
    try {
      const driver = await getDebugDriver()
      connections.set(clientId, { ws, driver })

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Session initialized successfully'
      }))
    } catch (error) {
      console.error('Failed to initialize session:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to initialize session: ' + error.message
      }))
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        console.log(`[WebSocket] Received from ${clientId}:`, message.action)

        let response

        switch (message.action) {
          case 'screenshot':
            response = await takeScreenshot()
            break

          case 'dump':
            response = await getUIDump()
            break

          case 'activity':
            response = await getCurrentActivity()
            break

          case 'click':
            response = await clickAtCoordinates(message.x, message.y)
            break

          default:
            response = { success: false, error: 'Unknown action: ' + message.action }
        }

        ws.send(JSON.stringify({
          type: 'response',
          action: message.action,
          requestId: message.requestId,
          ...response
        }))

      } catch (error) {
        console.error(`[WebSocket] Error handling message from ${clientId}:`, error)
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }))
      }
    })

    ws.on('close', async () => {
      console.log(`[WebSocket] Client ${clientId} disconnected`)
      connections.delete(clientId)

      // If no more connections, close the session
      if (connections.size === 0) {
        console.log('[WebSocket] No more clients, closing session...')
        await closeDebugSession()
      }
    })

    ws.on('error', (error) => {
      console.error(`[WebSocket] Error for client ${clientId}:`, error)
    })
  })

  server
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> WebSocket ready on ws://${hostname}:${port}/api/debug/ws`)
    })
})

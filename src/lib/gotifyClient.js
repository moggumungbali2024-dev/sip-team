// Gotify WebSocket client for real-time push notifications
const GOTIFY_URL = import.meta.env.VITE_GOTIFY_URL
const GOTIFY_TOKEN = import.meta.env.VITE_GOTIFY_TOKEN

let ws = null
let listeners = []
let reconnectTimer = null

export function connectGotify(onMessage) {
  // Fix: avoid duplicate listener registration
  if (!listeners.includes(onMessage)) {
    listeners.push(onMessage)
  }

  // Already open — no need to reconnect
  if (ws && ws.readyState === WebSocket.OPEN) return

  // Already connecting
  if (ws && ws.readyState === WebSocket.CONNECTING) return

  _openSocket()
}

function _openSocket() {
  const wsUrl = GOTIFY_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  ws = new WebSocket(`${wsUrl}/stream?token=${GOTIFY_TOKEN}`)

  ws.onopen = () => console.log('✅ Gotify connected')

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      listeners.forEach(fn => fn(data))
    } catch (e) {
      console.error('Gotify parse error:', e)
    }
  }

  ws.onerror = (e) => console.error('Gotify WS error:', e)

  ws.onclose = () => {
    console.log('Gotify disconnected.')
    // Fix: only auto-reconnect if we still have active listeners
    if (listeners.length > 0) {
      console.log('Reconnecting in 5s...')
      reconnectTimer = setTimeout(() => _openSocket(), 5000)
    }
  }
}

export function disconnectGotify() {
  // Fix: clear listeners and cancel pending reconnect before closing
  listeners = []
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.onclose = null // prevent auto-reconnect on intentional close
    ws.close()
    ws = null
  }
}

export async function sendGotifyMessage(title, message, priority = 5) {
  try {
    await fetch(`${GOTIFY_URL}/message?token=${GOTIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, priority })
    })
  } catch (e) {
    console.error('Gotify send error:', e)
  }
}

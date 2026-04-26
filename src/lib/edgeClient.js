// sipOS Edge Service Client
// Base URL: https://service.sip-os.com/
const EDGE_URL = import.meta.env.VITE_EDGE_URL

/**
 * Generic edge fetch — graceful fallback on CORS / network failure
 */
async function edgeFetch(path, options = {}) {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  try {
    const res = await fetch(`${EDGE_URL}${path}`, {
      ...options,
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        ...(options.headers || {}),
      },
    })
    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`)
      throw new Error(err)
    }
    return res.json()
  } catch (e) {
    // CORS or network error — log but don't crash the app
    console.warn(`[EdgeClient] ${path} failed: ${e.message}`)
    return null
  }
}

/**
 * Send WA notification via Edge
 */
export async function edgeSendWA(phone, message, restaurantId) {
  return edgeFetch('/functions/v1/send-wa', {
    method: 'POST',
    body: JSON.stringify({ phone, message, restaurant_id: restaurantId }),
  })
}

/**
 * Send Gotify push notification via Edge
 */
export async function edgeSendNotif(title, message, priority = 5, restaurantId) {
  return edgeFetch('/functions/v1/send-notif', {
    method: 'POST',
    body: JSON.stringify({ title, message, priority, restaurant_id: restaurantId }),
  })
}

/**
 * Trigger task assignment notification via Edge
 */
export async function edgeNotifyTask({ taskTitle, priority, assigneePhone, assigneeName, restaurantId }) {
  return edgeFetch('/functions/v1/notify-task', {
    method: 'POST',
    body: JSON.stringify({
      task_title: taskTitle,
      priority,
      assignee_phone: assigneePhone,
      assignee_name: assigneeName,
      restaurant_id: restaurantId,
    }),
  })
}

/**
 * Health check
 */
export async function edgeHealthCheck() {
  const data = await edgeFetch('/functions/v1/health')
  return data ? { ok: true, data } : { ok: false, error: 'Unreachable' }
}

// sipOS Edge Service Client
// Base URL: https://service.sip-os.com/
const EDGE_URL = import.meta.env.VITE_EDGE_URL

/**
 * Generic edge fetch helper with auth header
 */
async function edgeFetch(path, options = {}) {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${EDGE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Edge error: ${res.status}`)
  }
  return res.json()
}

/**
 * Send WhatsApp notification via Edge
 * POST /functions/v1/send-wa
 */
export async function edgeSendWA(phone, message, restaurantId) {
  return edgeFetch('/functions/v1/send-wa', {
    method: 'POST',
    body: JSON.stringify({ phone, message, restaurant_id: restaurantId }),
  })
}

/**
 * Send Gotify push notification via Edge
 * POST /functions/v1/send-notif
 */
export async function edgeSendNotif(title, message, priority = 5, restaurantId) {
  return edgeFetch('/functions/v1/send-notif', {
    method: 'POST',
    body: JSON.stringify({ title, message, priority, restaurant_id: restaurantId }),
  })
}

/**
 * Trigger task assignment notification via Edge (WA + Gotify)
 * POST /functions/v1/notify-task
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
 * Health check for Edge service
 * GET /functions/v1/health
 */
export async function edgeHealthCheck() {
  try {
    const data = await edgeFetch('/functions/v1/health')
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

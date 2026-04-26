// GoWa WhatsApp Gateway Client — v8 Multi-Device
const GOWA_URL  = import.meta.env.VITE_GOWA_URL
const GOWA_USER = import.meta.env.VITE_GOWA_USER
const GOWA_PASS = import.meta.env.VITE_GOWA_PASS

const basicAuthToken = btoa(`${GOWA_USER}:${GOWA_PASS}`)

// Build headers for GoWa v8 (device_id scoping)
function gowaHeaders(deviceId) {
  const h = {
    'Content-Type': 'application/json',
  }
  if (GOWA_USER && GOWA_PASS) {
    h['Authorization'] = `Basic ${basicAuthToken}`
  }
  if (deviceId) h['X-Device-Id'] = deviceId
  return h
}

async function gowaFetch(path, options = {}, deviceId = null) {
  try {
    const res = await fetch(`${GOWA_URL}${path}`, {
      ...options,
      headers: gowaHeaders(deviceId),
    })
    if (!res.ok) throw new Error(`GoWa ${res.status}`)
    return await res.json()
  } catch (e) {
    console.error(`GoWa error [${path}]:`, e.message)
    return null
  }
}

// ── Device ──────────────────────────────────────────────────

export async function getGoWaDevices() {
  return gowaFetch('/user/info')
}

export async function getGoWaQR(deviceId) {
  return gowaFetch('/user/login', {
    method: 'POST',
    body: JSON.stringify({ phone: deviceId }),
  })
}

export async function logoutGoWa(deviceId) {
  return gowaFetch('/user/logout', {
    method: 'POST',
    body: JSON.stringify({ phone: deviceId }),
  })
}

// ── Messaging ────────────────────────────────────────────────

export async function sendWhatsAppMessage(phone, message, deviceId = null) {
  try {
    const res = await fetch(`${GOWA_URL}/send/message`, {
      method: 'POST',
      headers: gowaHeaders(deviceId),
      body: JSON.stringify({ phone, message }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || 'Failed to send WA')
    return { ok: true, data }
  } catch (error) {
    console.error('GoWa send error:', error)
    return { ok: false, error: error.message }
  }
}

// ── Contacts ─────────────────────────────────────────────────

export async function getGoWaContacts(deviceId = null) {
  return gowaFetch('/contact/list', {}, deviceId)
}

// ── Groups ───────────────────────────────────────────────────

export async function getGoWaGroups(deviceId = null) {
  return gowaFetch('/group/list', {}, deviceId)
}

export async function getGoWaGroupInfo(groupId, deviceId = null) {
  return gowaFetch(`/group/info?group_id=${encodeURIComponent(groupId)}`, {}, deviceId)
}

// ── Chat Messages ─────────────────────────────────────────────

export async function getGoWaChatMessages(chatId, deviceId = null, limit = 20) {
  return gowaFetch(
    `/chat/messages?chat_id=${encodeURIComponent(chatId)}&limit=${limit}`,
    {},
    deviceId
  )
}

// ── Helper: normalize chat_id ─────────────────────────────────
export function normalizePhone(phone) {
  // Remove all non-digits, ensure country code
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

export function isGroup(chatId) {
  return chatId?.endsWith('@g.us')
}

export function displayPhone(chatId) {
  if (!chatId) return ''
  return chatId.replace('@s.whatsapp.net', '').replace('@g.us', '')
}

// GoWa WhatsApp Gateway Client — v8 Multi-Device
const GOWA_URL  = import.meta.env.VITE_GOWA_URL
const GOWA_USER = import.meta.env.VITE_GOWA_USER
const GOWA_PASS = import.meta.env.VITE_GOWA_PASS

const basicAuthToken = btoa(`${GOWA_USER}:${GOWA_PASS}`)

// Build headers for GoWa v8
function gowaHeaders() {
  return {
    'Content-Type': 'application/json',
  }
}

async function gowaFetch(path, options = {}, deviceId = null) {
  try {
    // Append device_id parameter if deviceId is provided (avoids X-Device-Id CORS issue)
    let urlPath = path
    if (deviceId) {
      const sep = path.includes('?') ? '&' : '?'
      urlPath += `${sep}device_id=${encodeURIComponent(deviceId)}`
    }
    
    const res = await fetch(`${GOWA_URL}${urlPath}`, {
      ...options,
      headers: gowaHeaders(),
    })
    if (!res.ok) throw new Error(`GoWa ${res.status}`)
    return await res.json()
  } catch (e) {
    console.error(`GoWa error [${path}]:`, e.message)
    return null
  }
}

// ── Device ──────────────────────────────────────────────────

export async function getGoWaDevices(deviceId) {
  if (!deviceId) return null
  return gowaFetch('/user/info', {}, deviceId)
}

export async function getGoWaQR(deviceId) {
  return gowaFetch('/app/login', {}, deviceId)
}

export async function logoutGoWa(deviceId) {
  return gowaFetch('/app/logout', { method: 'GET' }, deviceId)
}

// ── Messaging ────────────────────────────────────────────────

export async function sendWhatsAppMessage(phone, message, deviceId = null) {
  try {
    let urlPath = '/send/message'
    if (deviceId) urlPath += `?device_id=${encodeURIComponent(deviceId)}`
    
    const res = await fetch(`${GOWA_URL}${urlPath}`, {
      method: 'POST',
      headers: gowaHeaders(),
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
  return gowaFetch('/user/my/contacts', {}, deviceId)
}

// ── Groups ───────────────────────────────────────────────────

export async function getGoWaGroups(deviceId = null) {
  return gowaFetch('/user/my/groups', {}, deviceId)
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
  return chatId.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '')
}

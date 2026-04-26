// GoWa WhatsApp Gateway Client
const GOWA_URL = import.meta.env.VITE_GOWA_URL
const GOWA_USER = import.meta.env.VITE_GOWA_USER
const GOWA_PASS = import.meta.env.VITE_GOWA_PASS

const basicAuthToken = btoa(`${GOWA_USER}:${GOWA_PASS}`)

export async function sendWhatsAppMessage(phone, message) {
  try {
    const response = await fetch(`${GOWA_URL}/send/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.message || 'Failed to send WA')
    return { ok: true, data }
  } catch (error) {
    console.error('GoWa send error:', error)
    return { ok: false, error: error.message }
  }
}

export async function getGoWaDevices() {
  try {
    const response = await fetch(`${GOWA_URL}/user/info`, {
      headers: { 'Authorization': `Basic ${basicAuthToken}` }
    })
    return await response.json()
  } catch (error) {
    console.error('GoWa devices error:', error)
    return null
  }
}

export async function getGoWaQR(deviceId) {
  try {
    const response = await fetch(`${GOWA_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: deviceId })
    })
    return await response.json()
  } catch (error) {
    console.error('GoWa QR error:', error)
    return null
  }
}

export async function logoutGoWa(deviceId) {
  try {
    const response = await fetch(`${GOWA_URL}/user/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: deviceId })
    })
    return await response.json()
  } catch (error) {
    console.error('GoWa logout error:', error)
    return null
  }
}

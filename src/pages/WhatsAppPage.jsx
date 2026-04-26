import React, { useState, useEffect } from 'react'
import { getGoWaDevices, getGoWaQR, logoutGoWa, sendWhatsAppMessage } from '../lib/gowaClient'

export default function WhatsAppPage({ session, userProfile, addToast }) {
  const [devices, setDevices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testTarget, setTestTarget] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => { fetchDevices() }, [])

  const fetchDevices = async () => {
    const savedPhone = localStorage.getItem('gowa_phone')
    if (!savedPhone) {
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await getGoWaDevices(savedPhone)
    setDevices(data)
    setLoading(false)
  }

  const handleGetQR = async () => {
    const cleanPhone = phone.replace(/\D/g, '').trim()
    if (!cleanPhone) { 
      addToast({ type: 'error', title: 'Isi nomor HP', body: 'Masukkan nomor HP yang akan dipasangkan.' }); 
      return 
    }
    setQrLoading(true)
    setQrData(null)
    
    // Save to localStorage so WA Inbox page can find it
    localStorage.setItem('gowa_phone', cleanPhone)
    
    const data = await getGoWaQR(cleanPhone)
    setQrData(data)
    setQrLoading(false)
  }

  const handleLogout = async () => {
    const cleanPhone = phone.replace(/\D/g, '').trim()
    if (!cleanPhone) return
    if (!confirm(`Logout nomor ${cleanPhone} dari GoWa?`)) return
    
    await logoutGoWa(cleanPhone)
    localStorage.removeItem('gowa_phone')
    addToast({ type: 'success', title: 'Logged Out', body: `Nomor ${cleanPhone} berhasil diputus dari GoWa.` })
    fetchDevices()
  }

  const handleSendTest = async () => {
    if (!testTarget || !testMsg) return
    setSendingTest(true)
    const result = await sendWhatsAppMessage(testTarget, testMsg)
    if (result.ok) {
      addToast({ type: 'wa', title: '✅ Pesan Terkirim', body: `Ke ${testTarget}` })
      setTestMsg('')
    } else {
      addToast({ type: 'error', title: '❌ Gagal', body: result.error })
    }
    setSendingTest(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">WhatsApp <span className="gradient-text">Gateway</span></div>
          <div className="page-subtitle">Kelola koneksi WA tim via GoWa</div>
        </div>
        <button className="btn btn-ghost" onClick={fetchDevices}>🔄 Refresh</button>
      </div>

      <div className="page-body">
        <div className="two-col">
          {/* Device Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card card-pad">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📱 Status Perangkat GoWa</h3>
              {loading ? (
                <div className="empty-state"><div className="empty-state-text">Memuat status...</div></div>
              ) : !localStorage.getItem('gowa_phone') ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 14, fontSize: 13, color: '#f87171' }}>
                  ❌ Belum ada nomor yang di-set. Silahkan set nomor di halaman WA Inbox terlebih dahulu.
                </div>
              ) : !devices ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 14, fontSize: 13, color: '#f87171' }}>
                  ❌ Nomor {localStorage.getItem('gowa_phone')} tidak terhubung ke GoWa API. Coba scan QR code ulang.
                </div>
              ) : (
                <div>
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      GoWa API Terhubung
                    </div>
                    {(() => {
                      const devData = devices?.results?.data?.[0] || devices?.data?.[0]
                      if (!devData) return <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status: Terkoneksi, namun detail perangkat tidak tersedia.</div>
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Nama Profile:</span>
                            <span style={{ fontWeight: 600 }}>{devData.name || devData.verified_name || 'Tidak ada nama'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Perangkat Aktif:</span>
                            <span style={{ fontWeight: 600 }}>{(devData.devices || []).length} sesi (Web/Desktop)</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>ID Utama:</span>
                            <span style={{ fontWeight: 600 }}>{devData.id || localStorage.getItem('gowa_phone')}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Test Send */}
            <div className="card card-pad">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>🧪 Test Kirim Pesan WA</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="input-label">Nomor Tujuan (format: 628xxx)</label>
                  <input className="input" placeholder="628123456789" value={testTarget} onChange={e => setTestTarget(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Pesan</label>
                  <textarea className="input" placeholder="Halo! Ini pesan test dari sipOS Team." value={testMsg} onChange={e => setTestMsg(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={handleSendTest} disabled={sendingTest}>
                  {sendingTest ? '⏳ Mengirim...' : '📤 Kirim Test WA'}
                </button>
              </div>
            </div>
          </div>

          {/* Pairing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card card-pad">
              <h3 style={{ fontWeight: 700, marginBottom: 4 }}>🔗 Hubungkan Nomor WA</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Masukkan nomor HP yang ingin dihubungkan ke GoWa, lalu scan QR Code dari WhatsApp Anda.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="input-label">Nomor HP (format: 628xxx)</label>
                  <input className="input" placeholder="628123456789" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGetQR} disabled={qrLoading}>
                    {qrLoading ? '⏳ Memuat QR...' : '📷 Tampilkan QR Code'}
                  </button>
                  <button className="btn btn-danger" onClick={handleLogout}>Putus</button>
                </div>

                {qrData && (
                  <div style={{ marginTop: 8 }}>
                    {qrData.qr_link || qrData.qr ? (
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                          Scan QR ini dengan WhatsApp Anda: <b>Settings → Linked Devices → Link a Device</b>
                        </div>
                        <div className="qr-box">
                          <img
                            src={qrData.qr_link || `data:image/png;base64,${qrData.qr}`}
                            alt="QR Code"
                            style={{ maxWidth: 220, maxHeight: 220 }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>QR Code akan kadaluarsa dalam ~60 detik</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Response GoWa:</div>
                        <pre style={{ fontSize: 11, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(qrData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="card card-pad" style={{ borderColor: 'rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 10 }}>📋 Panduan Integrasi</h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10 }}><span>1️⃣</span><span>Masukkan nomor HP anggota tim (format 628xxx)</span></div>
                <div style={{ display: 'flex', gap: 10 }}><span>2️⃣</span><span>Klik "Tampilkan QR Code"</span></div>
                <div style={{ display: 'flex', gap: 10 }}><span>3️⃣</span><span>Buka WhatsApp di HP → Settings → Linked Devices → Link a Device</span></div>
                <div style={{ display: 'flex', gap: 10 }}><span>4️⃣</span><span>Scan QR Code yang muncul</span></div>
                <div style={{ display: 'flex', gap: 10 }}><span>5️⃣</span><span>Notifikasi tugas baru akan dikirim otomatis via WA!</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

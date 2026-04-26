import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { edgeSendWA } from '../lib/edgeClient'

const ROLE_LABELS = { super_admin: 'Super Admin', resto_admin: 'Pemilik', admin: 'Admin', manager: 'Manager', cashier: 'Kasir', waiter: 'Waiter', leader: 'Leader' }
const ROLE_COLOR  = { super_admin: 'badge-red', resto_admin: 'badge-orange', admin: 'badge-blue', manager: 'badge-green', cashier: 'badge-gray', waiter: 'badge-gray', leader: 'badge-yellow' }

export default function TeamPage({ session, userProfile, addToast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const [waMsg, setWaMsg] = useState('')
  const [sendingWA, setSendingWA] = useState(false)

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    setLoading(true)
    try {
      // Fix: proper chaining + include phone column
      let q = supabase.from('users').select('id, username, role, phone, restaurant_id, created_at')
      if (userProfile?.restaurant_id) q = q.eq('restaurant_id', userProfile.restaurant_id)
      const { data } = await q
      setMembers(data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSendWA = async (member) => {
    if (!waMsg.trim()) return
    setSendingWA(true)
    try {
      if (!member.phone) throw new Error('Anggota tidak punya nomor WhatsApp')
      // Use Edge service for WA delivery
      await edgeSendWA(member.phone, waMsg, userProfile?.restaurant_id)
      addToast({ type: 'wa', title: 'WA Terkirim', body: `Ke ${member.username}` })
      setWaMsg('')
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal Kirim WA', body: e.message })
    } finally { setSendingWA(false) }
  }

  const roles = ['all', ...Object.keys(ROLE_LABELS)]
  const filtered = members
    .filter(m => filterRole === 'all' || m.role === filterRole)
    .filter(m => !search || m.username?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Direktori <span className="gradient-text">Tim</span></div>
          <div className="page-subtitle">{members.length} anggota</div>
        </div>
      </div>

      <div className="page-body">
        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 280 }} placeholder="🔍 Cari anggota..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'Semua Role' : ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-text">Memuat anggota tim...</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">👥</div><div className="empty-state-text">Tidak ada anggota yang cocok</div></div>
        ) : (
          <div className="three-col">
            {filtered.map(member => (
              <div key={member.id} className="member-card">
                <div className="member-avatar-lg">
                  {member.username?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{member.username}</div>
                  <span className={`badge ${ROLE_COLOR[member.role] || 'badge-gray'}`} style={{ marginTop: 6 }}>{ROLE_LABELS[member.role] || member.role}</span>
                </div>
                {member.phone && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📱 {member.phone}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Bergabung {new Date(member.created_at).toLocaleDateString('id-ID')}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => setSelectedMember(member)}
                >
                  📋 Lihat & Kirim WA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Profil Anggota</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMember(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
              <div className="member-avatar-lg">{selectedMember.username?.slice(0, 2).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedMember.username}</div>
                <span className={`badge ${ROLE_COLOR[selectedMember.role] || 'badge-gray'}`}>{ROLE_LABELS[selectedMember.role] || selectedMember.role}</span>
                {selectedMember.phone && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>📱 {selectedMember.phone}</div>}
              </div>
            </div>

            <hr className="divider" style={{ marginBottom: 20 }} />

            <div>
              <label className="input-label">Kirim Pesan WhatsApp</label>
              <textarea
                className="input"
                placeholder="Tulis pesan WA..."
                value={waMsg}
                onChange={e => setWaMsg(e.target.value)}
                style={{ minHeight: 80, marginBottom: 10 }}
              />
              {!selectedMember.phone && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10 }}>⚠️ Anggota ini belum memiliki nomor WhatsApp di database.</div>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => handleSendWA(selectedMember)}
                disabled={sendingWA || !selectedMember.phone}
              >
                {sendingWA ? '⏳ Mengirim...' : '📱 Kirim via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

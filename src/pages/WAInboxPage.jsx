import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  getGoWaContacts, getGoWaGroups, sendWhatsAppMessage,
  getGoWaDevices, displayPhone, isGroup
} from '../lib/gowaClient'

export default function WAInboxPage({ session, userProfile, addToast, onWaBadgeChange }) {
  const [chats, setChats]             = useState([])
  const [activeChat, setActiveChat]   = useState(null)
  const [messages, setMessages]       = useState([])
  const [newMsg, setNewMsg]           = useState('')
  const [sending, setSending]         = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [deviceId, setDeviceId]       = useState(null)
  const [searchQ, setSearchQ]         = useState('')
  const messagesEndRef = useRef(null)
  const restaurantId   = userProfile?.restaurant_id || null

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    loadChats()
    detectDevice()
  }, [])

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id)
      markRead(activeChat.id)
    }
  }, [activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Real-time subscription ───────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('wa_messages_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_messages',
      }, (payload) => {
        const msg = payload.new
        // Append if same chat is active
        if (activeChat && msg.chat_id === activeChat.id) {
          setMessages(prev => [...prev, msg])
          if (msg.direction === 'inbound') markRead(msg.chat_id)
        }
        // Update chat list last message
        setChats(prev => prev.map(c =>
          c.id === msg.chat_id
            ? { ...c, last_message: msg.content, last_msg_at: msg.created_at, unread_count: msg.direction === 'inbound' && (!activeChat || activeChat.id !== msg.chat_id) ? (c.unread_count || 0) + 1 : c.unread_count }
            : c
        ).sort((a, b) => new Date(b.last_msg_at || 0) - new Date(a.last_msg_at || 0)))

        // Update badge
        if (msg.direction === 'inbound') {
          onWaBadgeChange?.(n => n + 1)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeChat])

  // ── Data Fetching ────────────────────────────────────────────
  const detectDevice = async () => {
    const savedPhone = localStorage.getItem('gowa_phone')
    if (savedPhone) {
      setDeviceId(savedPhone.replace(/\D/g, ''))
    }
  }

  const loadChats = async () => {
    if (!deviceId) return
    let q = supabase
      .from('wa_contacts')
      .select('*')
      .eq('device_id', deviceId)
      .order('last_msg_at', { ascending: false, nullsFirst: false })
    if (restaurantId) q = q.eq('restaurant_id', restaurantId)
    const { data } = await q
    setChats(data || [])
  }

  const loadMessages = async (chatId) => {
    setLoadingMsgs(true)
    let q = supabase
      .from('wa_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100)
    const { data } = await q
    setMessages(data || [])
    setLoadingMsgs(false)
  }

  const markRead = async (chatId) => {
    await supabase
      .from('wa_messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .eq('direction', 'inbound')
      .eq('is_read', false)

    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread_count: 0 } : c))
    await supabase.from('wa_contacts').update({ unread_count: 0 }).eq('id', chatId)
  }

  // ── Sync from GoWa ───────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    addToast({ type: 'task', title: '🔄 Sinkronisasi...', body: 'Mengambil kontak & grup dari WhatsApp' })
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        getGoWaContacts(deviceId),
        getGoWaGroups(deviceId),
      ])

      const toUpsert = []

      // Contacts
      const contacts = contactsRes?.results?.data || contactsRes?.results || contactsRes?.data || []
      for (const c of contacts) {
        if (!c.phone && !c.id && !c.jid) continue
        const rawPhone = c.phone || c.id || c.jid || ''
        const chatId = rawPhone.includes('@') ? rawPhone : `${rawPhone.replace(/\D/g,'')}@s.whatsapp.net`
        toUpsert.push({
          id: chatId,
          name: displayPhone(c.name || c.push_name) || displayPhone(chatId),
          phone: displayPhone(chatId),
          is_group: false,
          device_id: deviceId,
          restaurant_id: restaurantId,
        })
      }

      // Groups
      const groups = groupsRes?.results?.data || groupsRes?.results || groupsRes?.data || []
      for (const g of groups) {
        const chatId = g.id?.includes('@') ? g.id : `${g.id}@g.us`
        toUpsert.push({
          id: chatId,
          name: g.name || g.subject || chatId,
          phone: null,
          is_group: true,
          group_desc: g.description || null,
          device_id: deviceId,
          restaurant_id: restaurantId,
        })
      }

      // Deduplicate toUpsert array by ID to prevent ON CONFLICT DO UPDATE error
      const uniqueUpserts = Array.from(new Map(toUpsert.map(item => [item.id, item])).values())

      if (uniqueUpserts.length > 0) {
        // Chunk upserts into batches of 500 to avoid PostgREST/HTTP limits
        const chunkSize = 500
        for (let i = 0; i < uniqueUpserts.length; i += chunkSize) {
          const chunk = uniqueUpserts.slice(i, i + chunkSize)
          const { error } = await supabase
            .from('wa_contacts')
            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })
          if (error) throw error
        }
      }

      await loadChats()
      addToast({ type: 'wa', title: '✅ Sync Selesai', body: `${toUpsert.length} kontak & grup dimuat` })
    } catch (e) {
      addToast({ type: 'error', title: 'Sync Gagal', body: e.message })
    } finally {
      setSyncing(false)
    }
  }

  // ── Send Message ─────────────────────────────────────────────
  const handleSend = async () => {
    if (!newMsg.trim() || !activeChat || sending) return
    setSending(true)
    try {
      const phone = displayPhone(activeChat.id)
      const result = await sendWhatsAppMessage(phone, newMsg.trim(), deviceId)
      if (!result.ok) throw new Error(result.error)

      // Save outbound to DB
      const outbound = {
        chat_id: activeChat.id,
        sender_id: 'me',
        sender_name: session.user.email?.split('@')[0] || 'Me',
        content: newMsg.trim(),
        direction: 'outbound',
        msg_type: 'text',
        device_id: deviceId,
        restaurant_id: restaurantId,
        is_read: true,
      }
      const { data } = await supabase.from('wa_messages').insert(outbound).select().single()
      if (data) setMessages(prev => [...prev, data])
      setNewMsg('')
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal Kirim', body: e.message })
    } finally {
      setSending(false)
    }
  }

  // ── UI Helpers ───────────────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  const filteredChats = chats.filter(c =>
    !searchQ || c.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.phone?.includes(searchQ)
  )

  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">
            💚 WA <span className="gradient-text">Inbox</span>
          </div>
          <div className="page-subtitle">
            {deviceId
              ? `Terhubung: ${displayPhone(deviceId)} · ${chats.length} chat`
              : 'Belum ada perangkat terhubung. Masukkan nomor HP (628...) di bawah.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!deviceId ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                className="input" 
                placeholder="Nomor WA (628...)" 
                id="waPhoneInput"
                style={{ width: 150, padding: '6px 12px', fontSize: 13 }}
              />
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  const val = document.getElementById('waPhoneInput').value
                  if(val) {
                    localStorage.setItem('gowa_phone', val)
                    setDeviceId(val)
                  }
                }}
              >Set Nomor</button>
            </div>
          ) : (
            <>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  if(!confirm('Ganti nomor akan menghapus daftar chat dari layar. Lanjutkan?')) return
                  localStorage.removeItem('gowa_phone')
                  setDeviceId(null)
                  setChats([])
                  setActiveChat(null)
                  setMessages([])
                }}
                style={{ fontSize: 12, color: 'var(--text-muted)' }}
              >Ganti Nomor</button>
              <button className="btn btn-ghost" onClick={loadChats}>🔄</button>
              <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
                {syncing ? '⏳ Sinkronisasi...' : '📥 Sync Kontak & Grup'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page-body">
        <div className={`wa-inbox-layout ${activeChat ? 'chat-active' : ''}`}>
          {/* ── Sidebar Chat List ── */}
          <div className="wa-chat-list">
            {/* Search */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <input
                className="input"
                placeholder="🔍 Cari nama atau nomor..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ fontSize: 13, padding: '8px 12px' }}
              />
            </div>

            {/* Header */}
            <div style={{
              padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>
              <span>Chat ({filteredChats.length})</span>
              {totalUnread > 0 && (
                <span style={{
                  background: '#25d366', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '2px 7px',
                  borderRadius: 999
                }}>{totalUnread}</span>
              )}
            </div>

            {/* Chat items */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredChats.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-state-icon">💬</div>
                  <div className="empty-state-text" style={{ fontSize: 13 }}>
                    {chats.length === 0
                      ? 'Belum ada chat. Klik "Sync Kontak & Grup"'
                      : 'Tidak ditemukan'}
                  </div>
                </div>
              ) : filteredChats.map(chat => (
                <div
                  key={chat.id}
                  className={`wa-chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                  onClick={() => setActiveChat(chat)}
                >
                  {/* Avatar */}
                  <div className={`wa-avatar ${chat.is_group ? 'wa-avatar-group' : ''}`}>
                    {chat.is_group ? '👥' : getInitials(chat.name)}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayPhone(chat.name) || displayPhone(chat.phone) || displayPhone(chat.id)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {formatTime(chat.last_msg_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {chat.last_message || (chat.is_group ? 'Grup WhatsApp' : displayPhone(chat.phone) || '')}
                      </div>
                      {chat.unread_count > 0 && (
                        <span style={{
                          background: '#25d366', color: '#fff',
                          fontSize: 10, fontWeight: 700, padding: '2px 6px',
                          borderRadius: 999, minWidth: 18, textAlign: 'center',
                          marginLeft: 8, flexShrink: 0
                        }}>{chat.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Message Panel ── */}
          <div className="wa-msg-panel">
            {!activeChat ? (
              <div className="empty-state" style={{ margin: 'auto' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💚</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>sipOS WA Inbox</div>
                <div className="empty-state-text">Pilih chat di sebelah kiri untuk mulai percakapan</div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(255,255,255,0.02)'
                }}>
                  <button className="mobile-back-btn" onClick={() => setActiveChat(null)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div className={`wa-avatar ${activeChat.is_group ? 'wa-avatar-group' : ''}`} style={{ width: 38, height: 38, fontSize: 14 }}>
                    {activeChat.is_group ? '👥' : getInitials(activeChat.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {displayPhone(activeChat.name) || displayPhone(activeChat.phone)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {activeChat.is_group
                        ? `Grup · ${activeChat.group_desc || 'WhatsApp Group'}`
                        : `📱 ${displayPhone(activeChat.phone) || displayPhone(activeChat.id)}`}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="wa-messages">
                  {loadingMsgs ? (
                    <div className="empty-state" style={{ margin: 'auto' }}>
                      <div className="empty-state-text">⏳ Memuat pesan...</div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="empty-state" style={{ margin: 'auto' }}>
                      <div className="empty-state-icon">💬</div>
                      <div className="empty-state-text">Belum ada pesan. Kirim pesan pertama!</div>
                    </div>
                  ) : messages.map(msg => {
                    const isMe = msg.direction === 'outbound'
                    return (
                      <div key={msg.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                      }}>
                        {/* Sender name (groups, inbound) */}
                        {!isMe && activeChat.is_group && msg.sender_name && (
                          <div style={{ fontSize: 11, color: '#25d366', marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>
                            {msg.sender_name}
                          </div>
                        )}
                        <div className={`wa-bubble ${isMe ? 'wa-bubble-out' : 'wa-bubble-in'}`}>
                          {msg.msg_type !== 'text' && (
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                              {msg.msg_type === 'image' ? '📷 Gambar' :
                               msg.msg_type === 'video' ? '🎥 Video' :
                               msg.msg_type === 'audio' ? '🎵 Audio' :
                               msg.msg_type === 'document' ? '📄 Dokumen' : ''}
                            </div>
                          )}
                          <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {msg.content}
                          </div>
                          <div style={{
                            fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)',
                            marginTop: 4, textAlign: 'right'
                          }}>
                            {formatTime(msg.created_at)}
                            {isMe && <span style={{ marginLeft: 4 }}>✓✓</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                  padding: '14px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex', gap: 10, alignItems: 'flex-end'
                }}>
                  <textarea
                    className="input"
                    placeholder="Tulis pesan WhatsApp..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    style={{ resize: 'none', minHeight: 44, maxHeight: 120, flex: 1 }}
                    rows={1}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSend}
                    disabled={sending || !newMsg.trim()}
                    style={{ padding: '10px 16px', flexShrink: 0, background: 'linear-gradient(135deg, #25d366, #128c7e)' }}
                  >
                    {sending ? '⏳' : '📤'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

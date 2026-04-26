import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ChatPage({ session, userProfile, addToast }) {
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { fetchRooms() }, [])
  useEffect(() => { if (activeRoom) fetchMessages(activeRoom) }, [activeRoom])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchRooms = async () => {
    // Use team_tasks as "rooms" — each task has its own thread
    const restaurantId = userProfile?.restaurant_id
    // Fix: proper chaining — reassign query variable
    let q = supabase.from('team_tasks').select('id, title, status').order('created_at', { ascending: false })
    if (restaurantId) q = q.eq('restaurant_id', restaurantId)
    const { data } = await q
    const roomList = [
      { id: 'general', title: '# Umum', status: 'general' },
      ...(data || []).map(t => ({ id: t.id, title: `# ${t.title}`, status: t.status }))
    ]
    setRooms(roomList)
    if (!activeRoom) setActiveRoom(roomList[0]?.id)
  }

  const fetchMessages = async (roomId) => {
    const q = supabase
      .from('team_messages')
      .select('id, content, source, created_at, sender_id, users(username)')
      .order('created_at', { ascending: true })

    if (roomId === 'general') {
      q.is('task_id', null)
    } else {
      q.eq('task_id', roomId)
    }

    const { data } = await q
    setMessages(data || [])
  }

  // Real-time subscription
  useEffect(() => {
    if (!activeRoom) return
    const channel = supabase
      .channel(`chat:${activeRoom}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeRoom])

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return
    setSending(true)
    try {
      const payload = {
        content: newMsg.trim(),
        sender_id: session.user.id,
        source: 'web',
        restaurant_id: userProfile?.restaurant_id || null,
        task_id: activeRoom === 'general' ? null : activeRoom,
      }
      await supabase.from('team_messages').insert(payload)
      setNewMsg('')
      fetchMessages(activeRoom)
    } catch (e) {
      addToast({ type: 'error', title: 'Error', body: e.message })
    } finally { setSending(false) }
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const currentUserId = session.user.id

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Chat <span className="gradient-text">Tim</span></div>
          <div className="page-subtitle">Komunikasi internal & per-tugas</div>
        </div>
      </div>

      <div className="page-body">
        <div className="chat-layout" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Room List */}
          <div className="chat-sidebar">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Ruang Chat
            </div>
            {rooms.map(room => (
              <div
                key={room.id}
                className={`chat-room-item ${activeRoom === room.id ? 'active' : ''}`}
                onClick={() => setActiveRoom(room.id)}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{room.title}</div>
                {room.status !== 'general' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{room.status?.replace('_', ' ')}</div>
                )}
              </div>
            ))}
          </div>

          {/* Messages */}
          <div className="chat-main">
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
              {rooms.find(r => r.id === activeRoom)?.title || 'Chat'}
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-state" style={{ margin: 'auto' }}>
                  <div className="empty-state-icon">💬</div>
                  <div className="empty-state-text">Belum ada pesan. Mulai percakapan!</div>
                </div>
              ) : messages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                const isWA  = msg.source === 'whatsapp'
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && <div className="message-sender">{msg.users?.username || 'Unknown'} {isWA && '📱'}</div>}
                    <div className={`message-bubble ${isMe ? 'message-mine' : isWA ? 'message-wa' : 'message-other'}`}>
                      {msg.content}
                    </div>
                    <div className="message-time">{formatTime(msg.created_at)}</div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <input
                className="input"
                placeholder="Tulis pesan..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending || !newMsg.trim()}
                style={{ flexShrink: 0 }}
              >
                {sending ? '⏳' : '📤'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

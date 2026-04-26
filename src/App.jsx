import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import { connectGotify, disconnectGotify } from './lib/gotifyClient'
import './App.css'
import './index.css'

import LoginPage      from './pages/LoginPage'
import DashboardPage  from './pages/DashboardPage'
import TasksPage      from './pages/TasksPage'
import TeamPage       from './pages/TeamPage'
import ChatPage       from './pages/ChatPage'
import WhatsAppPage   from './pages/WhatsAppPage'
import WAInboxPage    from './pages/WAInboxPage'
import Sidebar        from './components/Sidebar'
import NotifToast     from './components/NotifToast'

export default function App() {
  const [session, setSession]           = useState(null)
  const [userProfile, setUserProfile]   = useState(null)
  const [page, setPage]                 = useState('dashboard')
  const [loading, setLoading]           = useState(true)
  const [toasts, setToasts]             = useState([])
  const [taskBadge, setTaskBadge]       = useState(0)
  const [chatBadge, setChatBadge]       = useState(0)
  const [waBadge, setWaBadge]           = useState(0)
  const [sidebarOpen, setSidebarOpen]   = useState(false)

  // ── Toast helpers ────────────────────────────────────────────
  const addToast = useCallback((toast) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, ...toast }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Load user profile ────────────────────────────────────────
  const loadUserProfile = async (authUser) => {
    const { data } = await supabase
      .from('users')
      .select('id, username, role, phone, restaurant_id')
      .eq('username', authUser.email)
      .maybeSingle()
    if (data) setUserProfile(data)
  }

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserProfile(session.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUserProfile(session.user)
      else setUserProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Gotify real-time notifications ───────────────────────────
  useEffect(() => {
    if (!session) return
    const handleGotifyMessage = (data) => {
      addToast({
        type: data.title?.toLowerCase().includes('wa') ? 'wa' : 'task',
        title: data.title || 'Notifikasi Baru',
        body: data.message || '',
      })
      if (data.title?.toLowerCase().includes('tugas') || data.title?.toLowerCase().includes('task')) {
        setTaskBadge(b => b + 1)
      }
      if (data.title?.toLowerCase().includes('pesan') || data.title?.toLowerCase().includes('chat')) {
        setChatBadge(b => b + 1)
      }
    }
    connectGotify(handleGotifyMessage)
    return () => disconnectGotify()
  }, [session, addToast])

  // ── Logout ───────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUserProfile(null)
    setPage('dashboard')
  }

  const handleNavChange = (p) => {
    setPage(p)
    setSidebarOpen(false) // close sidebar on mobile after nav
    if (p === 'tasks')    setTaskBadge(0)
    if (p === 'chat')     setChatBadge(0)
    if (p === 'wa-inbox') setWaBadge(0)
  }

  // ── Loading screen ───────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading sipOS Team...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage onLogin={(s) => setSession(s)} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage  session={session} userProfile={userProfile} onNav={handleNavChange} addToast={addToast} />
      case 'tasks':     return <TasksPage      session={session} userProfile={userProfile} addToast={addToast} />
      case 'team':      return <TeamPage       session={session} userProfile={userProfile} addToast={addToast} />
      case 'chat':      return <ChatPage       session={session} userProfile={userProfile} addToast={addToast} />
      case 'wa-inbox':  return <WAInboxPage    session={session} userProfile={userProfile} addToast={addToast} onWaBadgeChange={setWaBadge} />
      case 'whatsapp':  return <WhatsAppPage   session={session} userProfile={userProfile} addToast={addToast} />
      default:          return <DashboardPage  session={session} userProfile={userProfile} onNav={handleNavChange} addToast={addToast} />
    }
  }

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
        <div style={{width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, rgb(249, 115, 22), rgb(234, 88, 12))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'rgba(249, 115, 22, 0.4) 0px 2px 12px', color: '#fff', marginRight: '8px', flexShrink: 0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
        </div>
        <div className="mobile-logo" style={{ whiteSpace: 'nowrap' }}>sip<span>OS</span> Team</div>
        {(taskBadge + chatBadge + waBadge) > 0 && (
          <div className="mobile-badge-dot" />
        )}
      </div>

      <Sidebar
        page={page}
        onNav={handleNavChange}
        onLogout={handleLogout}
        session={session}
        userProfile={userProfile}
        taskBadge={taskBadge}
        chatBadge={chatBadge}
        waBadge={waBadge}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        {renderPage()}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav">
        {[
          { id: 'dashboard', icon: '🏠', label: 'Home' },
          { id: 'tasks',     icon: '✅', label: 'Tugas',  badge: taskBadge },
          { id: 'wa-inbox',  icon: '💚', label: 'WA',     badge: waBadge, badgeColor: '#25d366' },
          { id: 'chat',      icon: '💬', label: 'Chat',   badge: chatBadge },
          { id: 'team',      icon: '👥', label: 'Tim' },
        ].map(item => (
          <button
            key={item.id}
            className={`mobile-tab-btn ${page === item.id ? 'active' : ''}`}
            onClick={() => handleNavChange(item.id)}
          >
            <span className="mobile-tab-icon">
              {item.icon}
              {item.badge > 0 && (
                <span
                  className="mobile-tab-badge"
                  style={item.badgeColor ? { background: item.badgeColor } : {}}
                >{item.badge}</span>
              )}
            </span>
            <span className="mobile-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <NotifToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

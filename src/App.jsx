import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import { connectGotify, disconnectGotify } from './lib/gotifyClient'
import './App.css'
import './index.css'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import TeamPage from './pages/TeamPage'
import ChatPage from './pages/ChatPage'
import WhatsAppPage from './pages/WhatsAppPage'
import Sidebar from './components/Sidebar'
import NotifToast from './components/NotifToast'

export default function App() {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const [taskBadge, setTaskBadge] = useState(0)
  const [chatBadge, setChatBadge] = useState(0)

  // Add a toast notification
  const addToast = useCallback((toast) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, ...toast }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  // Remove a toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Load user profile from public.users
  const loadUserProfile = async (authUser) => {
    const { data } = await supabase
      .from('users')
      .select('id, username, role, restaurant_id')
      .eq('username', authUser.email)
      .maybeSingle()
    if (data) setUserProfile(data)
  }

  // Auth state listener
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

  // Connect Gotify for real-time notifications
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUserProfile(null)
    setPage('dashboard')
  }

  const handleNavChange = (p) => {
    setPage(p)
    if (p === 'tasks') setTaskBadge(0)
    if (p === 'chat') setChatBadge(0)
  }

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
      case 'dashboard': return <DashboardPage session={session} userProfile={userProfile} onNav={handleNavChange} addToast={addToast} />
      case 'tasks':     return <TasksPage session={session} userProfile={userProfile} addToast={addToast} />
      case 'team':      return <TeamPage session={session} userProfile={userProfile} addToast={addToast} />
      case 'chat':      return <ChatPage session={session} userProfile={userProfile} addToast={addToast} />
      case 'whatsapp':  return <WhatsAppPage session={session} userProfile={userProfile} addToast={addToast} />
      default:          return <DashboardPage session={session} userProfile={userProfile} onNav={handleNavChange} addToast={addToast} />
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        onNav={handleNavChange}
        onLogout={handleLogout}
        session={session}
        userProfile={userProfile}
        taskBadge={taskBadge}
        chatBadge={chatBadge}
      />
      <div className="main-content">
        {renderPage()}
      </div>
      <NotifToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

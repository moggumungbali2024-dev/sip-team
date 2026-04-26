import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { edgeSendNotif } from '../lib/edgeClient'

export default function DashboardPage({ session, userProfile, onNav, addToast }) {
  const [stats, setStats] = useState({ total: 0, todo: 0, inProgress: 0, done: 0 })
  const [recentTasks, setRecentTasks] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const uid = session.user.id
      const restaurantId = userProfile?.restaurant_id

      // Fix: proper chaining — reassign query variable
      let query = supabase.from('team_tasks').select('*').order('created_at', { ascending: false })
      if (restaurantId) query = query.eq('restaurant_id', restaurantId)

      const { data: tasks } = await query
      const allTasks = tasks || []

      setStats({
        total: allTasks.length,
        todo: allTasks.filter(t => t.status === 'todo').length,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        done: allTasks.filter(t => t.status === 'done').length,
      })

      setRecentTasks(allTasks.slice(0, 5))
      setMyTasks(allTasks.filter(t => t.assigned_to === uid).slice(0, 5))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const STATUS_COLOR = {
    todo: 'badge-blue',
    in_progress: 'badge-yellow',
    done: 'badge-green',
    cancelled: 'badge-gray',
  }

  const PRIORITY_COLOR = {
    high: 'badge-red',
    medium: 'badge-orange',
    low: 'badge-blue',
  }

  const greet = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Selamat Pagi'
    if (h < 17) return 'Selamat Siang'
    return 'Selamat Malam'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{greet()}, <span className="gradient-text">{session.user.email.split('@')[0]}</span> 👋</div>
          <div className="page-subtitle">Berikut ringkasan aktivitas tim Anda hari ini</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => onNav('tasks')}
        >
          ➕ Tugas Baru
        </button>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stat-grid">
          {[
            { label: 'Total Tugas', value: stats.total, icon: '📋', color: '#6366f1' },
            { label: 'Belum Mulai', value: stats.todo, icon: '⏳', color: '#f59e0b' },
            { label: 'Sedang Berjalan', value: stats.inProgress, icon: '🔄', color: '#f97316' },
            { label: 'Selesai', value: stats.done, icon: '✅', color: '#10b981' },
          ].map((s, i) => (
            <div key={i} className="stat-card animate-in" style={{ borderLeft: `3px solid ${s.color}`, animationDelay: `${i * 0.08}s` }}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{loading ? '—' : s.value}</div>
            </div>
          ))}
        </div>

        <div className="main-side">
          {/* Recent Tasks */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>Tugas Terbaru</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav('tasks')}>Lihat Semua →</button>
            </div>
            {loading ? (
              <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-text">Memuat...</div></div>
            ) : recentTasks.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">Belum ada tugas</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentTasks.map(task => (
                  <div key={task.id} className="task-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div className={`task-priority-bar priority-${task.priority}`} style={{ height: 'auto', alignSelf: 'stretch' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                      {task.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{task.description.slice(0, 60)}...</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <span className={`badge ${STATUS_COLOR[task.status] || 'badge-gray'}`}>{task.status?.replace('_', ' ')}</span>
                        <span className={`badge ${PRIORITY_COLOR[task.priority] || 'badge-gray'}`}>{task.priority}</span>
                      </div>
                    </div>
                    {task.due_date && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        📅 {new Date(task.due_date).toLocaleDateString('id-ID')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-pad">
              <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Tugas Saya</h3>
              {loading ? (
                <div className="empty-state"><div className="empty-state-text">Memuat...</div></div>
              ) : myTasks.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🎉</div><div className="empty-state-text">Tidak ada tugas aktif</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myTasks.map(task => (
                    <div key={task.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</div>
                      <span className={`badge ${STATUS_COLOR[task.status] || 'badge-gray'}`} style={{ marginTop: 4 }}>{task.status?.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card card-pad">
              <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Akses Cepat</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '✅', label: 'Kelola Tugas', page: 'tasks' },
                  { icon: '👥', label: 'Direktori Tim', page: 'team' },
                  { icon: '💬', label: 'Chat Internal', page: 'chat' },
                  { icon: '📱', label: 'WhatsApp', page: 'whatsapp' },
                ].map(a => (
                  <button key={a.page} className="nav-item" style={{ justifyContent: 'flex-start' }} onClick={() => onNav(a.page)}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontSize: 13 }}>{a.label}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

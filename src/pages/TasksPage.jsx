import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { edgeNotifyTask, edgeSendNotif } from '../lib/edgeClient'

const STATUS_COLS = [
  { id: 'todo',        label: 'Belum Mulai', color: '#6366f1' },
  { id: 'in_progress', label: 'Berjalan',    color: '#f97316' },
  { id: 'done',        label: 'Selesai',     color: '#10b981' },
  { id: 'cancelled',   label: 'Dibatalkan',  color: '#6b7280' },
]

const PRIORITY_OPTS = ['low', 'medium', 'high']
const STATUS_OPTS   = ['todo', 'in_progress', 'done', 'cancelled']

export default function TasksPage({ session, userProfile, addToast }) {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [viewMode, setViewMode] = useState('kanban') // kanban | list
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'todo', assigned_to: '', due_date: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const restaurantId = userProfile?.restaurant_id

      // Fix: proper chaining — reassign query variable
      let tq = supabase.from('team_tasks').select('*').order('created_at', { ascending: false })
      if (restaurantId) tq = tq.eq('restaurant_id', restaurantId)
      const { data: taskData } = await tq

      // Fix: include 'phone' column in members query
      let mq = supabase.from('users').select('id, username, role, phone')
      if (restaurantId) mq = mq.eq('restaurant_id', restaurantId)
      const { data: memberData } = await mq

      setTasks(taskData || [])
      setMembers(memberData || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditingTask(null)
    setForm({ title: '', description: '', priority: 'medium', status: 'todo', assigned_to: '', due_date: '' })
    setShowModal(true)
  }

  const openEdit = (task) => {
    setEditingTask(task)
    setForm({ title: task.title, description: task.description || '', priority: task.priority || 'medium', status: task.status, assigned_to: task.assigned_to || '', due_date: task.due_date ? task.due_date.slice(0, 10) : '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        restaurant_id: userProfile?.restaurant_id || null,
        created_by: session.user.id,
      }

      if (editingTask) {
        await supabase.from('team_tasks').update(payload).eq('id', editingTask.id)
        addToast({ type: 'task', title: 'Tugas Diperbarui', body: form.title })
      } else {
        await supabase.from('team_tasks').insert(payload)
        addToast({ type: 'task', title: 'Tugas Baru Dibuat', body: form.title })

        // Notify via Edge service (handles Gotify + WA internally)
        if (form.assigned_to) {
          const member = members.find(m => m.id === form.assigned_to)
          try {
            await edgeNotifyTask({
              taskTitle: form.title,
              priority: form.priority,
              assigneePhone: member?.phone || null,
              assigneeName: member?.username || '',
              restaurantId: userProfile?.restaurant_id || null,
            })
          } catch (edgeErr) {
            // Fallback: still show toast but don't block the save
            console.warn('Edge notify failed:', edgeErr.message)
          }
        } else {
          // No assignee — just send Gotify broadcast
          try {
            await edgeSendNotif('📋 Tugas Baru', `${form.title} — Prioritas: ${form.priority}`, 5, userProfile?.restaurant_id)
          } catch (e) { console.warn('Edge notif failed:', e.message) }
        }
      }

      setShowModal(false)
      fetchData()
    } catch (e) {
      addToast({ type: 'error', title: 'Error', body: e.message })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus tugas ini?')) return
    await supabase.from('team_tasks').delete().eq('id', id)
    fetchData()
  }

  const handleQuickStatus = async (taskId, newStatus) => {
    await supabase.from('team_tasks').update({ status: newStatus }).eq('id', taskId)
    if (newStatus === 'done') {
      try {
        await edgeSendNotif('✅ Tugas Selesai', 'Sebuah tugas telah diselesaikan!', 5, userProfile?.restaurant_id)
      } catch (e) { console.warn('Edge notif failed:', e.message) }
    }
    fetchData()
  }

  const STATUS_COLOR = { todo: '#6366f1', in_progress: '#f97316', done: '#10b981', cancelled: '#6b7280' }
  const PRIORITY_COLOR = { high: '#ef4444', medium: '#f97316', low: '#6366f1' }

  const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus)
  const tasksByStatus = (statusId) => filteredTasks.filter(t => t.status === statusId)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Manajemen <span className="gradient-text">Tugas</span></div>
          <div className="page-subtitle">{tasks.length} tugas total</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['kanban', 'list'].map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding: '7px 14px', background: viewMode === v ? 'var(--primary)' : 'transparent', color: viewMode === v ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {v === 'kanban' ? '🗂 Kanban' : '📋 List'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={openCreate}>➕ Buat Tugas</button>
        </div>
      </div>

      <div className="page-body">
        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterStatus('all')} className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-ghost'}`}>Semua ({tasks.length})</button>
          {STATUS_COLS.map(s => (
            <button key={s.id} onClick={() => setFilterStatus(s.id)} className={`btn btn-sm ${filterStatus === s.id ? 'btn-secondary' : 'btn-ghost'}`} style={{ borderColor: filterStatus === s.id ? s.color : undefined, color: filterStatus === s.id ? s.color : undefined }}>
              {s.label} ({tasks.filter(t => t.status === s.id).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-text">Memuat tugas...</div></div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board */
          <div className="kanban-board">
            {STATUS_COLS.map(col => (
              <div key={col.id} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title" style={{ color: col.color }}>{col.label}</span>
                  <span className="kanban-count">{tasksByStatus(col.id).length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasksByStatus(col.id).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Kosong</div>
                  ) : tasksByStatus(col.id).map(task => {
                    const assignedMember = members.find(m => m.id === task.assigned_to)
                    return (
                      <div key={task.id} className="task-card" onClick={() => openEdit(task)} style={{ display: 'flex', gap: 10 }}>
                        <div className={`task-priority-bar priority-${task.priority}`} style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</div>
                          {task.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{task.description.slice(0, 50)}{task.description.length > 50 ? '...' : ''}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <span className="badge" style={{ fontSize: 10, background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>
                            {assignedMember && (
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                {assignedMember.username?.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          {task.due_date && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>📅 {new Date(task.due_date).toLocaleDateString('id-ID')}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8, borderStyle: 'dashed' }} onClick={openCreate}>+ Tambah</button>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tugas', 'Prioritas', 'Status', 'Ditugaskan', 'Due Date', 'Aksi'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Belum ada tugas</td></tr>
                ) : filteredTasks.map(task => {
                  const assignedMember = members.find(m => m.id === task.assigned_to)
                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                        {task.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.description.slice(0, 40)}...</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge" style={{ background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={task.status}
                          onChange={e => handleQuickStatus(task.id, e.target.value)}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: STATUS_COLOR[task.status], fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {STATUS_OPTS.map(s => <option key={s} value={s} style={{ background: '#111118' }}>{s.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{assignedMember?.username || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID') : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(task)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{editingTask ? 'Edit Tugas' : '➕ Tugas Baru'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">Judul Tugas *</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Cek stok bahan baku" autoFocus />
              </div>
              <div>
                <label className="input-label">Deskripsi</label>
                <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detail tugas..." />
              </div>
              <div className="two-col">
                <div>
                  <label className="input-label">Prioritas</label>
                  <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="two-col">
                <div>
                  <label className="input-label">Ditugaskan Ke</label>
                  <select className="input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">— Pilih Anggota —</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Due Date</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{editingTask ? '💾 Simpan Perubahan' : '✅ Buat Tugas'}</button>
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React from 'react'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'tasks',     icon: '✅', label: 'Tugas',    badge: 'taskBadge' },
  { id: 'team',      icon: '👥', label: 'Tim' },
  { id: 'chat',      icon: '💬', label: 'Chat',     badge: 'chatBadge' },
  { id: 'wa-inbox',  icon: '💚', label: 'WA Inbox', badge: 'waBadge', badgeColor: '#25d366' },
  { id: 'whatsapp',  icon: '📱', label: 'WA Gateway' },
]

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  resto_admin: 'Resto Admin',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Kasir',
  waiter: 'Waiter',
  leader: 'Leader',
}

export default function Sidebar({ page, onNav, onLogout, session, userProfile, taskBadge, chatBadge, waBadge, isOpen, onClose }) {
  const badges = { taskBadge, chatBadge, waBadge }
  const email = session?.user?.email || ''
  const initials = email.slice(0, 2).toUpperCase()
  const role = userProfile?.role || 'user'

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header sidebar-logo">
          <div style={{width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgb(249, 115, 22), rgb(234, 88, 12))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'rgba(249, 115, 22, 0.4) 0px 2px 12px', color: '#fff', flexShrink: 0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
          </div>
          <div className="logo-text" style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap' }}>sip<span>OS</span> Team</div>
        </div>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABELS[role] || role}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const badgeCount = item.badge ? badges[item.badge] : 0
          return (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => onNav(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {badgeCount > 0 && (
                <span
                  className="nav-badge"
                  style={item.badgeColor ? { background: item.badgeColor } : {}}
                >{badgeCount}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="nav-item" onClick={onLogout} style={{ width: '100%', color: '#f87171' }}>
          <span className="nav-icon">🚪</span>
          <span>Keluar</span>
        </button>
        </div>
      </aside>
    </>
  )
}

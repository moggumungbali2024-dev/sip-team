import React from 'react'

export default function NotifToast({ toasts, onRemove }) {
  if (!toasts.length) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type || 'task'}`}
          onClick={() => onRemove(toast.id)}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {toast.type === 'wa' ? '📱' : '🔔'}
            </span>
            <div style={{ flex: 1 }}>
              <div className="toast-title">{toast.title}</div>
              {toast.body && <div className="toast-body">{toast.body}</div>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(toast.id) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
            >✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}

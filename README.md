# sipOS Team

**Real-time Team Management** — React + Vite + Supabase + Gotify + GoWa

## Stack
- **Frontend**: React 19 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Push Notif**: Gotify WebSocket
- **WhatsApp**: GoWa Gateway
- **Edge Functions**: service.sip-os.com

## Pages
| Route | Deskripsi |
|-------|-----------|
| `/` | Dashboard — statistik & task summary |
| `tasks` | Kanban + List view manajemen tugas |
| `team` | Direktori anggota tim + kirim WA |
| `chat` | Chat internal real-time per task |
| `whatsapp` | Kelola perangkat GoWa & test kirim |

## Deploy

Built & deployed via **Coolify** with Docker (multi-stage):
- `node:20-alpine` → `npm run build`
- `nginx:alpine` → serve `/dist` on port 80

### Env Variables (set in Coolify)
```env
VITE_SUPABASE_URL=https://db.sip-os.com
VITE_SUPABASE_ANON_KEY=...
VITE_EDGE_URL=https://service.sip-os.com
VITE_GOTIFY_URL=https://ok.sip-os.com
VITE_GOTIFY_TOKEN=...
VITE_GOWA_URL=https://wap.sip-os.com
VITE_GOWA_USER=...
VITE_GOWA_PASS=...
```

## Supabase Tables Required
- `users` — id, username, role, phone, restaurant_id
- `team_tasks` — id, title, description, priority, status, assigned_to, due_date, restaurant_id, created_by
- `team_messages` — id, content, source, sender_id, task_id, restaurant_id, created_at

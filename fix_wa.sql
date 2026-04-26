ALTER TABLE public.wa_contacts
ADD COLUMN IF NOT EXISTS last_msg_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
NOTIFY pgrst, 'reload schema';

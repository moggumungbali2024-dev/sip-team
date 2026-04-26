ALTER TABLE public.wa_contacts
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS restaurant_id UUID;
NOTIFY pgrst, 'reload schema';

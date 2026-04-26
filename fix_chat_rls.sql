
-- Fix RLS for team_messages
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_messages_select" ON team_messages;
CREATE POLICY "team_messages_select" ON team_messages
  FOR SELECT USING (restaurant_id IN (
    SELECT restaurant_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "team_messages_insert" ON team_messages;
CREATE POLICY "team_messages_insert" ON team_messages
  FOR INSERT WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM users WHERE id = auth.uid()
  ));

-- Ensure team_tasks has update policy for drag and drop
ALTER TABLE team_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_tasks_update" ON team_tasks;
CREATE POLICY "team_tasks_update" ON team_tasks
  FOR UPDATE USING (restaurant_id IN (
    SELECT restaurant_id FROM users WHERE id = auth.uid()
  ));

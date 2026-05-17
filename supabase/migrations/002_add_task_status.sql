-- Add status and completion tracking to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_url TEXT;

-- Set existing tasks to pending
UPDATE tasks SET status = 'pending' WHERE status IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);

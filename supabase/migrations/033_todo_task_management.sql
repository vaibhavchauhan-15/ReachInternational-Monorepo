-- Migration 033: To-Do & Task Management Module Schema, RLS, & Indexes
-- Description: Establishes enterprise task management tables, multi-employee assignments, attachments, comment threads, activity audit logs, and RLS security policies.

-- 1. Create sequence for task numbering
CREATE SEQUENCE IF NOT EXISTS task_no_seq START WITH 1 INCREMENT BY 1;

-- 2. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_no TEXT UNIQUE NOT NULL DEFAULT ('TSK-' || LPAD(nextval('task_no_seq')::TEXT, 5, '0')),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME WITHOUT TIME ZONE,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled', 'reopened')) DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  reminder_offset TEXT DEFAULT 'none',
  completion_notes TEXT,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create task_assignees junction table (supports assigning single or multiple employees)
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_task_user_assignee UNIQUE (task_id, user_id)
);

-- 4. Create task_attachments table (supports task reference files & employee completion proof)
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('attachment', 'completion_proof')) DEFAULT 'attachment',
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create task_comments table (supports threaded discussions between employees and managers)
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create task_activity_logs table (tracks full audit history of task actions)
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. High-Performance Database Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_branch_id ON public.tasks(branch_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_task_id ON public.task_activity_logs(task_id);

-- 8. Automatic Updated_At Triggers
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON public.tasks;
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- 9. Enable Row-Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for Tasks
DROP POLICY IF EXISTS tasks_select_policy ON public.tasks;
CREATE POLICY tasks_select_policy ON public.tasks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN (
        'super_admin', 'admin', 'service_manager', 'branch_manager',
        'supervisor', 'hr_manager', 'rental_manager', 'sales_manager',
        'finance_manager', 'store_manager'
      )
    )
    OR created_by = auth.uid()
    OR id IN (SELECT task_id FROM public.task_assignees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tasks_insert_policy ON public.tasks;
CREATE POLICY tasks_insert_policy ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN (
        'super_admin', 'admin', 'service_manager', 'branch_manager',
        'supervisor', 'hr_manager', 'rental_manager', 'sales_manager',
        'finance_manager', 'store_manager'
      )
    )
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS tasks_update_policy ON public.tasks;
CREATE POLICY tasks_update_policy ON public.tasks
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN (
        'super_admin', 'admin', 'service_manager', 'branch_manager',
        'supervisor', 'hr_manager', 'rental_manager', 'sales_manager',
        'finance_manager', 'store_manager'
      )
    )
    OR created_by = auth.uid()
    OR id IN (SELECT task_id FROM public.task_assignees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tasks_delete_policy ON public.tasks;
CREATE POLICY tasks_delete_policy ON public.tasks
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'service_manager', 'branch_manager', 'supervisor')
    )
    OR created_by = auth.uid()
  );

-- RLS Policies for Task Assignees
DROP POLICY IF EXISTS task_assignees_all_policy ON public.task_assignees;
CREATE POLICY task_assignees_all_policy ON public.task_assignees
  FOR ALL USING (true);

-- RLS Policies for Task Attachments
DROP POLICY IF EXISTS task_attachments_all_policy ON public.task_attachments;
CREATE POLICY task_attachments_all_policy ON public.task_attachments
  FOR ALL USING (true);

-- RLS Policies for Task Comments
DROP POLICY IF EXISTS task_comments_all_policy ON public.task_comments;
CREATE POLICY task_comments_all_policy ON public.task_comments
  FOR ALL USING (true);

-- RLS Policies for Task Activity Logs
DROP POLICY IF EXISTS task_activity_logs_all_policy ON public.task_activity_logs;
CREATE POLICY task_activity_logs_all_policy ON public.task_activity_logs
  FOR ALL USING (true);

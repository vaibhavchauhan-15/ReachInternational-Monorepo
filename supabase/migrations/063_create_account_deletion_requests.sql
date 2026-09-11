-- ==============================================================================
-- Migration 063: Create Account Deletion Requests Table & Policies
-- 1. Creates public.account_deletion_requests table for web & mobile erasure requests.
-- 2. Performance indexes on status, user_id, email, and created_at.
-- 3. RLS policies allowing authenticated self-insert, admin review, and public self-serve.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'public_web')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON public.account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_email ON public.account_deletion_requests(email);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_created_at ON public.account_deletion_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can view their own requests; admins & managers can view all requests
DROP POLICY IF EXISTS "account_deletion_requests_select" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_select" ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager')
  );

-- 2. INSERT (Authenticated): Logged-in users can request deletion for their own account
DROP POLICY IF EXISTS "account_deletion_requests_insert_auth" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_insert_auth" ON public.account_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 3. INSERT (Anon/Public): Public web portal can submit deletion requests with email
DROP POLICY IF EXISTS "account_deletion_requests_insert_anon" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_insert_anon" ON public.account_deletion_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- 4. UPDATE: Admins can approve/reject; users can cancel their own pending request
DROP POLICY IF EXISTS "account_deletion_requests_update" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_update" ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending') OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager')
  )
  WITH CHECK (
    (user_id = auth.uid() AND status IN ('pending', 'cancelled')) OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager')
  );

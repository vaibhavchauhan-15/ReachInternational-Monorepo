-- ==============================================================================
-- Migration 042: Add Shift Time, Address & Profile Change Requests Table
-- 1. Adds shift_time and address columns to public.users.
-- 2. Creates public.profile_change_requests table for hierarchical profile approval workflow.
-- 3. Adds indexes on user_id, status, target_approver_role, and created_at.
-- 4. Establishes RLS policies for profile change requests.
-- 5. Updates handle_new_user() trigger to capture address and shift_time.
-- ==============================================================================

-- 1. Add shift_time and address columns to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift_time TEXT;

-- 2. Create public.profile_change_requests table
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_role TEXT NOT NULL,
  current_data JSONB NOT NULL,
  requested_data JSONB NOT NULL,
  target_approver_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_user_id ON public.profile_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_status ON public.profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_created_at ON public.profile_change_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_target_role ON public.profile_change_requests(target_approver_role);

-- 4. Enable RLS and create policies
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_change_requests_select" ON public.profile_change_requests;
CREATE POLICY "profile_change_requests_select" ON public.profile_change_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager', 'store_manager')
  );

DROP POLICY IF EXISTS "profile_change_requests_insert_self" ON public.profile_change_requests;
CREATE POLICY "profile_change_requests_insert_self" ON public.profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profile_change_requests_update_authorized" ON public.profile_change_requests;
CREATE POLICY "profile_change_requests_update_authorized" ON public.profile_change_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending') OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager')
  )
  WITH CHECK (
    (user_id = auth.uid() AND status IN ('pending', 'cancelled')) OR
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'hr_manager')
  );

-- 5. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    city,
    district,
    state,
    aadhaar_number,
    license_number,
    address,
    shift_time
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), ''),
    'operator',
    'pending',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), ''),
    NULLIF(NEW.raw_user_meta_data->>'aadhaar_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'license_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    NULLIF(NEW.raw_user_meta_data->>'shift_time', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    aadhaar_number = COALESCE(EXCLUDED.aadhaar_number, public.users.aadhaar_number),
    license_number = COALESCE(EXCLUDED.license_number, public.users.license_number),
    address = COALESCE(EXCLUDED.address, public.users.address),
    shift_time = COALESCE(EXCLUDED.shift_time, public.users.shift_time),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Migration 001: Create public.users table, auth triggers, RLS policies, and indexes
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (mirrors auth.users, extended profile)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL CONSTRAINT users_email_not_empty CHECK (btrim(email) <> ''),
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'engineer' CHECK (role IN (
    'super_admin', 'admin', 'company_admin', 'service_manager',
    'rental_manager', 'sales_manager', 'store_manager', 'hr_manager', 'finance_manager',
    'supervisor', 'service_engineer', 'engineer', 'mechanic', 'operator'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 3. Auto-update updated_at Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_status TEXT := 'pending';
BEGIN
  -- Dashboard-created users (or confirmed email) get 'active' status directly
  IF NEW.email_confirmed_at IS NOT NULL OR (NEW.raw_user_meta_data->>'status') = 'active' THEN
    user_status := 'active';
  END IF;

  INSERT INTO public.users (id, full_name, email, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'),
    user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_super_admin" ON public.users;
CREATE POLICY "users_insert_super_admin" ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE TO authenticated USING (public.current_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "users_delete_super_admin" ON public.users;
CREATE POLICY "users_delete_super_admin" ON public.users
  FOR DELETE TO authenticated USING (public.current_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

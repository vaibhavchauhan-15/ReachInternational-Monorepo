-- ============================================
-- Reach Internationa — Initial Database Schema
-- Phase 1: Machine Service Tracking & Alerts
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (mirrors auth.users, extended profile)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('super_admin','admin','engineer')),
  status text NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- MACHINES TABLE (master data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_code text UNIQUE NOT NULL,
  machine_name text NOT NULL,
  model text,
  customer_name text NOT NULL,
  customer_mobile text NOT NULL,
  customer_address text,
  city text NOT NULL,
  state text NOT NULL,
  engineer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_service_date date,
  next_service_due_date date NOT NULL,
  service_interval_days int NOT NULL DEFAULT 90,
  status text NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for machines
CREATE INDEX IF NOT EXISTS idx_machines_next_service_due_date ON public.machines(next_service_due_date);
CREATE INDEX IF NOT EXISTS idx_machines_engineer_id ON public.machines(engineer_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON public.machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_next_service_status ON public.machines(next_service_due_date, status);

-- ============================================
-- SERVICE RECORDS TABLE (append-only history)
-- ============================================
CREATE TABLE IF NOT EXISTS public.service_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  engineer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  service_date date NOT NULL,
  notes text,
  photo_urls text[],
  next_service_due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_records_machine_id ON public.service_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_service_records_engineer_id ON public.service_records(engineer_id);
CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON public.service_records(service_date);

-- ============================================
-- NOTIFICATIONS TABLE (one row per machine + alert_type + date)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('today','tomorrow','overdue')),
  alert_date date NOT NULL,
  channel text DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  status text NOT NULL CHECK (status IN ('pending','sent','failed')) DEFAULT 'pending',
  whatsapp_message_id text,
  retry_count int DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (machine_id, recipient_id, alert_type, alert_date)  -- idempotency guard
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_date ON public.notifications(alert_date);
CREATE INDEX IF NOT EXISTS idx_notifications_machine_id ON public.notifications(machine_id);

-- ============================================
-- IMPORT BATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  total_rows int DEFAULT 0,
  success_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('processing','completed','failed')) DEFAULT 'processing',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- IMPORT ERRORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.import_errors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number int NOT NULL,
  error_message text NOT NULL,
  raw_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_import_errors_batch_id ON public.import_errors(batch_id);

-- ============================================
-- AUDIT LOGS TABLE (insert-only, immutable)
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_phone_number_id text,
  whatsapp_access_token_ref text,
  daily_run_time time DEFAULT '08:00',
  default_service_interval_days int DEFAULT 90,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.system_settings (whatsapp_phone_number_id, whatsapp_access_token_ref, daily_run_time, default_service_interval_days)
VALUES (NULL, NULL, '08:00', 90)
ON CONFLICT DO NOTHING;

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_machines_updated_at ON public.machines;
CREATE TRIGGER trigger_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trigger_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- TRIGGER: Auto-create user profile on auth signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'),
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES: USERS
-- ============================================
-- All authenticated users can view users
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Only super_admin can insert/update/delete users
CREATE POLICY "users_insert_super_admin" ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE TO authenticated USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

CREATE POLICY "users_delete_super_admin" ON public.users
  FOR DELETE TO authenticated USING (public.current_user_role() = 'super_admin');

-- Users can update their own profile (limited)
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- RLS POLICIES: MACHINES
-- ============================================
-- Super admin and admin can see all machines; engineers see only assigned
CREATE POLICY "machines_select_all_admin" ON public.machines
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "machines_select_assigned_engineer" ON public.machines
  FOR SELECT TO authenticated
  USING (engineer_id = auth.uid());

-- Only super_admin and admin can insert/update/delete machines
CREATE POLICY "machines_insert_admin" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "machines_update_admin" ON public.machines
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'))
  WITH CHECK (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "machines_delete_admin" ON public.machines
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

-- Engineers can update machines assigned to them (for service completion)
CREATE POLICY "machines_update_assigned_engineer" ON public.machines
  FOR UPDATE TO authenticated
  USING (engineer_id = auth.uid() AND public.current_user_role() = 'engineer')
  WITH CHECK (engineer_id = auth.uid() AND public.current_user_role() = 'engineer');

-- ============================================
-- RLS POLICIES: SERVICE RECORDS
-- ============================================
-- Super admin and admin can see all service records; engineers see only their own
CREATE POLICY "service_records_select_all_admin" ON public.service_records
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "service_records_select_own_engineer" ON public.service_records
  FOR SELECT TO authenticated
  USING (engineer_id = auth.uid());

-- All authenticated users can insert service records
CREATE POLICY "service_records_insert_authenticated" ON public.service_records
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Super admin and admin can update/delete; engineers can update their own
CREATE POLICY "service_records_update_admin" ON public.service_records
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "service_records_update_own_engineer" ON public.service_records
  FOR UPDATE TO authenticated
  USING (engineer_id = auth.uid());

-- ============================================
-- RLS POLICIES: NOTIFICATIONS
-- ============================================
-- Super admin and admin can see all notifications; engineers see their own
CREATE POLICY "notifications_select_all_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "notifications_select_own_engineer" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- All authenticated can insert (for the alert engine)
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Super admin and admin can update (for resend, status updates)
CREATE POLICY "notifications_update_admin" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

-- ============================================
-- RLS POLICIES: IMPORT BATCHES
-- ============================================
CREATE POLICY "import_batches_select_admin" ON public.import_batches
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "import_batches_insert_admin" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "import_batches_update_admin" ON public.import_batches
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

-- ============================================
-- RLS POLICIES: IMPORT ERRORS
-- ============================================
CREATE POLICY "import_errors_select_admin" ON public.import_errors
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin','admin'));

CREATE POLICY "import_errors_insert_admin" ON public.import_errors
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('super_admin','admin'));

-- ============================================
-- RLS POLICIES: AUDIT LOGS
-- ============================================
-- Super admin can see all; admin can see own; engineers cannot see
CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'super_admin');

CREATE POLICY "audit_logs_select_own_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin' AND user_id = auth.uid());

-- All authenticated can insert (for audit logging)
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No update or delete policies — audit logs are immutable

-- ============================================
-- RLS POLICIES: SYSTEM SETTINGS
-- ============================================
-- Super admin can do everything
CREATE POLICY "system_settings_select_super_admin" ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'super_admin');

CREATE POLICY "system_settings_update_super_admin" ON public.system_settings
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

-- ============================================
-- STORAGE BUCKET: Service Photos
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-photos', 'service-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies: authenticated users can upload; public can read
CREATE POLICY "service_photos_upload_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-photos');

CREATE POLICY "service_photos_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'service-photos');
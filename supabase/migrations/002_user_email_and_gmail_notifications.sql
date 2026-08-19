-- ============================================
-- Reach Internationa — Migration 002
-- 1. Require an email ID for EVERY user role (super_admin, admin, engineer)
-- 2. Enable Gmail email notifications alongside WhatsApp
-- ============================================
--
-- After applying this migration:
--   * public.users.email is NOT NULL, unique, format-validated, and kept in
--     sync with the login email in auth.users (a BEFORE-trigger rejects any
--     attempt to insert/update a user without an email).
--   * notifications.channel accepts 'email' in addition to 'whatsapp'.
--   * system_settings exposes Gmail sender config. The actual Gmail app
--     password is NEVER stored in the DB — only a reference name is kept
--     (matching the existing whatsapp_access_token_ref pattern). The secret
--     lives in the app's environment (e.g. Vercel env var GMAIL_APP_PASSWORD).
--   * The app-side worker consumes the pending_email_notifications view and the
--     build_service_alert_email() helper to send via Gmail SMTP/API and mark
--     each notification as sent, storing the Gmail message id.

-- ============================================
-- PART A: public.users — add required email
-- ============================================

-- 1. Add the column (nullable first so existing rows can be backfilled)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email text;
  END IF;
END $$;

-- 2. Backfill from auth.users (the source of truth for login emails)
UPDATE public.users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR btrim(u.email) = '');

-- 3. Fallback for any orphan rows (deterministic, valid, unique-ish)
UPDATE public.users
SET email = 'user_' || replace(id::text, '-', '') || '@reachinternation.com'
WHERE email IS NULL OR btrim(email) = '';

-- 4. Enforce NOT NULL (idempotent — re-running on an already NOT NULL column is a no-op)
ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;

-- 5. Unique email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users(email);

-- 6. Data quality constraints: non-empty and valid format
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_email_not_empty CHECK (btrim(email) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_format;
ALTER TABLE public.users ADD CONSTRAINT users_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ============================================
-- PART B: Enforce email on every insert/update for ALL roles
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_email text;
BEGIN
  -- A user without an email can never be created or updated, regardless of role.
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Email is required for all users (role: %)', NEW.role
      USING ERRCODE = '23514',
            HINT = 'Every user — super_admin, admin, and engineer — must have an email ID so alerts can be sent to Gmail.';
  END IF;

  IF NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', NEW.email
      USING ERRCODE = '23514';
  END IF;

  -- Keep public.users.email in sync with the login identity.
  SELECT email INTO v_auth_email FROM auth.users WHERE id = NEW.id;
  IF NEW.email IS DISTINCT FROM v_auth_email THEN
    RAISE EXCEPTION 'Email must match the login email in auth.users.'
      USING ERRCODE = '23514',
            HINT = 'Change the email via Supabase Auth so it stays in sync.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_users_require_email ON public.users;
CREATE TRIGGER trigger_users_require_email
  BEFORE INSERT OR UPDATE OF email, role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_email();

-- ============================================
-- PART C: handle_new_user — persist email on auth signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone, role, status, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'),
    'active',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$;

-- Sync email into public.users whenever it changes in auth.users
CREATE OR REPLACE FUNCTION public.sync_user_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_on_auth_user_email_updated ON auth.users;
CREATE TRIGGER trigger_on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_email_from_auth();

-- ============================================
-- PART D: notifications — support Gmail 'email' channel
-- ============================================

-- Allow the email channel alongside whatsapp
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check
  CHECK (channel IN ('whatsapp', 'email'));

-- Store the Gmail API / SMTP message id after a successful send
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'email_message_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN email_message_id text;
  END IF;
END $$;

-- The idempotency guard must include channel so the SAME machine + recipient
-- can receive BOTH a WhatsApp alert and a Gmail alert on the same day.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.notifications'::regclass
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%machine_id%'
    AND pg_get_constraintdef(c.oid) LIKE '%alert_date%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_machine_recipient_type_date_channel_key
  UNIQUE (machine_id, recipient_id, alert_type, alert_date, channel);

-- Partial index for the Gmail dispatch worker (status = 'pending', channel = 'email')
CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON public.notifications(status, channel)
  WHERE channel = 'email';

-- ============================================
-- PART E: system_settings — Gmail sender configuration
-- ============================================
-- NOTE: gmail_app_password_ref is ONLY a reference to the secret name stored
-- in the app environment (never the password itself) — secret-in-DB is forbidden.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'gmail_sender_email'
  ) THEN
    ALTER TABLE public.system_settings ADD COLUMN gmail_sender_email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'gmail_app_password_ref'
  ) THEN
    ALTER TABLE public.system_settings ADD COLUMN gmail_app_password_ref text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'email_from_name'
  ) THEN
    ALTER TABLE public.system_settings ADD COLUMN email_from_name text DEFAULT 'Reach Internationa';
  END IF;
END $$;

-- ============================================
-- PART F: Helpers for the Gmail dispatch worker
-- ============================================

-- View: every pending email notification joined with recipient + machine
-- details so the app worker has everything needed to compose and send via Gmail.
-- security_invoker = true -> RLS on the underlying tables is enforced for the
-- caller, so a non-admin client can never read machines/emails it shouldn't see.
CREATE OR REPLACE VIEW public.pending_email_notifications
WITH (security_invoker = true) AS
SELECT
  n.id            AS notification_id,
  n.alert_type,
  n.alert_date,
  n.recipient_id,
  u.email         AS recipient_email,
  u.full_name     AS recipient_name,
  m.id            AS machine_id,
  m.machine_code,
  m.machine_name,
  m.customer_name,
  m.customer_mobile,
  m.next_service_due_date
FROM public.notifications n
JOIN public.users   u ON u.id = n.recipient_id
JOIN public.machines m ON m.id = n.machine_id
WHERE n.channel = 'email'
  AND n.status = 'pending';

-- Function: builds { subject, html } for a service-alert email.
-- The worker calls this, sends via Gmail SMTP/API, then marks the
-- notification as 'sent' with the Gmail message id.
CREATE OR REPLACE FUNCTION public.build_service_alert_email(
  p_machine_id uuid,
  p_alert_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_machine public.machines%ROWTYPE;
  v_subject text;
  v_html    text;
BEGIN
  SELECT * INTO v_machine FROM public.machines WHERE id = p_machine_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_subject := format(
    'Service %s — %s (%s)',
    CASE p_alert_type
      WHEN 'today'    THEN 'Due Today'
      WHEN 'tomorrow' THEN 'Due Tomorrow'
      WHEN 'overdue'  THEN 'Overdue'
      ELSE p_alert_type
    END,
    v_machine.machine_name,
    v_machine.machine_code
  );

  v_html := format(
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
    || '<div style="background:#1f2937;color:#ffffff;padding:16px 24px;"><h2 style="margin:0;">Reach Internationa</h2></div>'
    || '<div style="padding:24px;">'
    || '<p>Hello,</p>'
    || '<p>This machine requires service <strong>%s</strong>:</p>'
    || '<table style="border-collapse:collapse;width:100%%;">'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Machine</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Machine Code</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Customer</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Customer Mobile</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Next Service Due</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '</table>'
    || '<p style="margin-top:24px;color:#6b7280;font-size:13px;">This is an automated alert from Reach Internationa. Do not reply to this email.</p>'
    || '</div></div>',
    CASE p_alert_type
      WHEN 'today'    THEN 'DUE TODAY'
      WHEN 'tomorrow' THEN 'DUE TOMORROW'
      WHEN 'overdue'  THEN 'OVERDUE'
      ELSE UPPER(p_alert_type)
    END,
    v_machine.machine_name,
    v_machine.machine_code,
    v_machine.customer_name,
    v_machine.customer_mobile,
    to_char(v_machine.next_service_due_date, 'DD Mon YYYY')
  );

  RETURN jsonb_build_object('subject', v_subject, 'html', v_html);
END;
$$;

-- ============================================
-- End of Migration 002
-- ============================================
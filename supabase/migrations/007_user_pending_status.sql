-- ============================================
-- Reach Internationa — Migration 007
-- Fix user signup → admin approval flow
-- 1. Add 'pending' to users.status CHECK constraint
-- 2. Update handle_new_user() trigger to insert new
--    auth signups with status = 'pending' (not 'active')
-- 3. Backfill stuck engineers (active but unconfirmed email)
-- ============================================

-- ============================================
-- PART A: Add 'pending' to users.status CHECK constraint
-- ============================================

-- Drop the old constraint that only allowed ('active','inactive')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

-- Add the new constraint that includes 'pending'
ALTER TABLE public.users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active','inactive','pending'));

-- ============================================
-- PART B: Update handle_new_user() to set status = 'pending'
-- ============================================
-- New users signing up via the public signup page should start
-- as 'pending' so an admin can review and approve them.
-- Admin-created users (via createUser action) are inserted with
-- email_confirm: true and then updated to 'active' by the action,
-- so the trigger default of 'pending' is overridden there.

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
    'pending',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$;

-- ============================================
-- PART C: Backfill stuck engineers
-- ============================================
-- Any engineer who signed up before this fix and is stuck as
-- 'active' in public.users but has an unconfirmed email in
-- auth.users should be moved to 'pending' so the admin can
-- approve them properly.

UPDATE public.users u
SET status = 'pending'
FROM auth.users au
WHERE u.id = au.id
  AND u.role = 'engineer'
  AND u.status = 'active'
  AND au.email_confirmed_at IS NULL;

-- ============================================
-- End of Migration 007
-- ============================================
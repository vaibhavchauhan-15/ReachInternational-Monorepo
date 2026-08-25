-- ============================================
-- Migration 008: Enforce Unique Constraints on Email and Mobile Phone Number in public.users
-- ============================================

-- 1. Create Unique Index on Email (case-insensitive & trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users (lower(btrim(email)));

-- 2. Create Unique Index on Mobile Phone Number (non-empty & trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON public.users (btrim(phone))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

-- 3. Add explicit UNIQUE constraints for schema integrity tools
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;

-- ============================================
-- Reach Internationa — Migration 006
-- 1. Add customer_email to machines table
-- 2. Update notifications channel to support 'email'
-- ============================================

-- ============================================
-- PART A: machines — add customer_email
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE public.machines ADD COLUMN customer_email text;
  END IF;
END $$;

-- ============================================
-- PART B: notifications — support 'email' channel
-- ============================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check
  CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app'));

-- ============================================
-- End of Migration 006
-- ============================================
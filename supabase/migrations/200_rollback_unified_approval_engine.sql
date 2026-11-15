-- ==============================================================================
-- Rollback Migration 200: Unified Approval & Verification Engine
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- Drops all objects created by unified approval engine in reverse order safely.
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'approval_events'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_approval_events_immutable ON public.approval_events';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.trg_block_approval_events_mutation() CASCADE;

DROP FUNCTION IF EXISTS public.approval_counts();
DROP FUNCTION IF EXISTS public.approval_get(UUID);
DROP FUNCTION IF EXISTS public.approval_list(TEXT, TEXT, TIMESTAMPTZ, UUID, INT);
DROP FUNCTION IF EXISTS public.approval_expire_due();
DROP FUNCTION IF EXISTS public.approval_cancel(UUID, TEXT);
DROP FUNCTION IF EXISTS public.approval_decide(UUID, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.approval_submit(TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT);

DROP FUNCTION IF EXISTS public.approval_apply_handler(UUID);
DROP FUNCTION IF EXISTS public.approval_apply_account_deletion(UUID);
DROP FUNCTION IF EXISTS public.approval_apply_document_replace(UUID);
DROP FUNCTION IF EXISTS public.approval_apply_registration(UUID);
DROP FUNCTION IF EXISTS public.approval_apply_profile_change(UUID);
DROP FUNCTION IF EXISTS public.approval_apply_document_verify(UUID);

DROP TABLE IF EXISTS public.approval_outbox CASCADE;
DROP TABLE IF EXISTS public.approval_events CASCADE;
DROP TABLE IF EXISTS public.approval_decisions CASCADE;
DROP TABLE IF EXISTS public.approval_requests CASCADE;
DROP TABLE IF EXISTS public.approval_types CASCADE;

DROP TYPE IF EXISTS public.approval_status CASCADE;

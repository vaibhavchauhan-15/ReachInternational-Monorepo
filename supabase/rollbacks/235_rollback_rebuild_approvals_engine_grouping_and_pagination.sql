-- ==============================================================================
-- Rollback Migration 235: Rebuild Approvals Engine Grouping and Pagination
-- Reverts parent_id, partial indexes, and resets triggers/indexes
-- Target: Development (vlmxciuogczumumrwyot)
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_approval_queue_toplevel;
DROP INDEX IF EXISTS public.idx_approval_queue_toplevel_type;
DROP INDEX IF EXISTS public.idx_approval_queue_all_toplevel;

ALTER TABLE public.approval_requests
  DROP COLUMN IF EXISTS parent_id;

NOTIFY pgrst, 'reload schema';

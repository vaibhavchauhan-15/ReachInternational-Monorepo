-- ==============================================================================
-- Migration 219: Rollback Atomic Bulk "Approve All" Engine
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.approval_approve_all(UUID, TEXT, UUID[], TEXT);

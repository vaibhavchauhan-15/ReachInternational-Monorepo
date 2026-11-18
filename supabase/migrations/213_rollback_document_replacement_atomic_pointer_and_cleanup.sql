-- ==============================================================================
-- Migration 208 Rollback: Document Replacement Atomic Pointer & Cleanup
-- ==============================================================================

DROP FUNCTION IF EXISTS public.apply_document_replacement_pointer(UUID, TEXT, TEXT, TEXT, UUID, TEXT, BIGINT, TEXT, UUID);

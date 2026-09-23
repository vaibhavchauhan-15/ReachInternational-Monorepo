-- ==============================================================================
-- Migration 102: Add uploaded_by to user_documents
--
-- Tracks the user who performed the upload (owner or admin/HR staff).
-- ==============================================================================

ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_documents_uploaded_by ON public.user_documents(uploaded_by);

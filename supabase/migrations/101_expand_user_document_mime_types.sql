-- ==============================================================================
-- Migration 101: Expand User Document Allowed MIME Types & Storage Config
--
-- Supports all standard identity document formats up to 2MB (2,097,152 bytes):
-- - Images: JPEG, JPG, PNG, WEBP, HEIC, HEIF
-- - Documents: PDF, DOC, DOCX, TXT
-- Sets storage bucket user_files allowed_mime_types to NULL (allowing all MIME types
-- within the 2MB limit).
-- ==============================================================================

UPDATE public.user_document_types
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
WHERE code IN ('aadhaar', 'driving_license');

UPDATE storage.buckets
SET allowed_mime_types = NULL, file_size_limit = 2097152
WHERE id = 'user_files';

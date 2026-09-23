-- ==============================================================================
-- Migration 101: Remove Profile Photo Document Type
--
-- Remove profile photo from user_document_types and clean up any orphan records.
-- Profile photo feature / upload is explicitly excluded from the platform.
-- ==============================================================================

-- Delete any existing user documents of type 'profile_photo'
DELETE FROM public.user_documents WHERE document_type_code = 'profile_photo';

-- Delete the 'profile_photo' document type from the reference table
DELETE FROM public.user_document_types WHERE code = 'profile_photo';

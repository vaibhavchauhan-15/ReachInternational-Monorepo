-- Migration 149: Remove duplicate bank_passbook document type and consolidate to canonical bank_document
-- Fixes duplicate passbook box bug in Profile documents upload section

-- 1. Safely migrate any existing user documents recorded under 'bank_passbook' to 'bank_document'
UPDATE public.user_documents
SET document_type_code = 'bank_document'
WHERE document_type_code = 'bank_passbook';

-- 2. Update canonical bank_document label to 'Bank Passbook / Cheque'
UPDATE public.user_document_types
SET label = 'Bank Passbook / Cheque'
WHERE code = 'bank_document';

-- 3. Delete redundant duplicate bank_passbook entry
DELETE FROM public.user_document_types
WHERE code = 'bank_passbook';

    -- ==============================================================================
    -- Rollback Migration 203: Guarantee Registration & Document Approvals
    -- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
    -- ==============================================================================

    -- 1. Drop auto-creation triggers
    DROP TRIGGER IF EXISTS trg_users_auto_create_registration_approval ON public.users;
    DROP FUNCTION IF EXISTS public.users_auto_create_registration_approval();

    DROP TRIGGER IF EXISTS trg_user_documents_auto_create_verification_approval ON public.user_documents;
    DROP FUNCTION IF EXISTS public.user_documents_auto_create_verification_approval();

    -- Note: The updated approval_apply_* handlers are backwards-compatible
    -- and do not need to be reverted.

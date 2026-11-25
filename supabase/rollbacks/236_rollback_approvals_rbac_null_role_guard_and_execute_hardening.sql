-- ==============================================================================
-- Rollback: 236_approvals_rbac_null_role_guard_and_execute_hardening.sql
-- Description:
--   Restores the pre-236 EXECUTE privileges only. The hardened function bodies
--   deliberately remain in place, because reverting them re-opens three confirmed
--   privilege-escalation holes (NULL-role decide, approval_get `OR v_role IS NULL`,
--   forged p_actor_id in approval_approve_all).
--
--   If a full body-level rollback is ever required, re-run the function
--   definitions from 235_rebuild_approvals_engine_grouping_and_pagination.sql
--   AFTER re-creating the (v_req.payload->>'user_id')::uuid casts it depends on.
--
--   Target: Development (vlmxciuogczumumrwyot)
-- ==============================================================================

BEGIN;

REVOKE ALL ON FUNCTION public.approval_approve_all(uuid, text, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_cancel(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_get(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_submit(text, text, uuid, jsonb, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_handler(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_registration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_document_verify(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_document_replace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_profile_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_apply_account_deletion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approval_expire_due() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approval_apply_handler(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_document_verify(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_document_replace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_profile_change(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_apply_account_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_expire_due() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
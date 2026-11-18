-- ==============================================================================
-- Rollback Migration 202: Admin-Only Approvals & Performance Scalability Optimization
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- Safely rolls back changes introduced in Migration 202.
-- ==============================================================================

DROP INDEX IF EXISTS idx_approval_requests_status_created;
DROP INDEX IF EXISTS idx_approval_requests_status_type_created;
DROP INDEX IF EXISTS idx_approval_decisions_approver;

-- Revert RLS policies to Migration 201 state
DROP POLICY IF EXISTS approval_requests_read ON public.approval_requests;
CREATE POLICY approval_requests_read ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'hr')
    OR requested_by = auth.uid()
    OR subject_id = auth.uid()
    OR public.current_user_role() IN (
      SELECT unnest(approver_roles) FROM public.approval_types WHERE key = type_key
    )
  );

DROP POLICY IF EXISTS approval_decisions_read ON public.approval_decisions;
CREATE POLICY approval_decisions_read ON public.approval_decisions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (
          public.current_user_role() IN ('super_admin', 'admin', 'hr')
          OR r.requested_by = auth.uid()
          OR r.subject_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS approval_events_read ON public.approval_events;
CREATE POLICY approval_events_read ON public.approval_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id
        AND (
          public.current_user_role() IN ('super_admin', 'admin', 'hr')
          OR r.requested_by = auth.uid()
          OR r.subject_id = auth.uid()
        )
    )
  );

-- ==============================================================================
-- Migration 233: Set-based supervisor RLS predicate for machines
-- ==============================================================================
-- 231 routed every machines row through the plpgsql helper
-- check_user_can_access_machine(), including manager-tier rows that need no
-- check at all. Measured on Dev (6 machines, supervisor): 5.66 ms exec and
-- ~665 shared buffer hits for a 6-row fleet read.
--
-- This migration keeps the helper as the canonical predicate for operators
-- (their fleet is bounded to one active machine) and for triggers/RPCs, but
-- inlines the supervisor predicate so PostgreSQL can resolve the role once
-- and use uq_client_supervisors_client_supervisor for inherited allocations.
--
-- Semantics are unchanged:
--   manager tier  -> all rows, no helper call
--   supervisor    -> client allocation when client_id is set, otherwise direct
--                    current_supervisor_id / supervisor_ids (matches 231)
--   operator      -> helper (active effective-dated assignment or direct)
--   hr/sales/...  -> none
--
-- Apply with: supabase db push (or the Management API query endpoint for Dev).
-- Rollback: supabase/rollbacks/233_rollback_set_based_machines_rls.sql
-- ==============================================================================

DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
        OR (
          client_id IS NULL
          AND (
            current_supervisor_id = auth.uid()
            OR auth.uid() = ANY (supervisor_ids)
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
        OR (
          client_id IS NULL
          AND (
            current_supervisor_id = auth.uid()
            OR auth.uid() = ANY (supervisor_ids)
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  )
  WITH CHECK (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) = 'supervisor'
      AND (
        (
          client_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.client_supervisors cs
            WHERE cs.client_id = machines.client_id
              AND cs.supervisor_id = auth.uid()
          )
        )
        OR (
          client_id IS NULL
          AND (
            current_supervisor_id = auth.uid()
            OR auth.uid() = ANY (supervisor_ids)
          )
        )
      )
    )
    OR (
      (SELECT public.current_user_role()) = 'operator'
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );

# Incident: Shift Log Overlap, Meter Discrepancy & Atomic RPC Reconciliation

## Purpose
This runbook provides diagnostic queries and safe data reconciliation procedures when operator shift submissions are rejected by PostgreSQL triggers (`033`, `046`, `047`, `050`), when hour meter readings are non-monotonic, or when machine running hour totals drift.

## Impact
- **Systems Affected**: `public.machine_hour_logs`, `public.machines`, Stored Procedure `submit_operator_hour_log_atomic`, Mobile Shift Logger.
- **User Impact**: Machine operators are blocked from logging daily work shifts. Site supervisors cannot approve daily machine running hours.
- **Business Impact**: Delayed machinery timesheet recording and inaccurate billing/maintenance hour tracking.

## Symptoms
- **Shift Overlap Trigger Rejection**:
  Postgres exception during `submit_operator_hour_log_atomic`:
  ```text
  ERROR: Shift time window overlaps with an existing logged shift for machine [ID] on [DATE].
  ```
  *(Enforced by migrations `033` and `050`).*
- **Non-Monotonic Meter Reading Error**:
  ```text
  ERROR: Starting hour meter (1204.5) cannot be lower than the previous approved ending meter (1210.0).
  ```
- **Future Shift Timestamp Rejection**:
  ```text
  ERROR: Shift end time cannot be set in the future (exceeds current server timestamp + grace period).
  ```
  *(Enforced by migration `046_validate_shift_end_not_future.sql`).*
- **Fleet Summary Desync**: Total running hours displayed on machine cards do not match the sum of approved shift logs.

## Severity
**P1 / P2 (P1 if fleet-wide trigger locking; P2 if isolated machine typo)**

## Immediate Actions
1. **Identify Machine and Operator Context (< 2 min)** `[SAFE AUTOMATION]`:
   - Extract `machine_id`, `operator_id`, and `log_date` from the error toast or server log.
2. **Query Machine's Current Running State (< 3 min)** `[SAFE AUTOMATION]`:
   ```sql
   SELECT id, machine_code, machine_name, status, health_status, total_running_hours 
   FROM public.machines 
   WHERE id = '<MACHINE_ID>';
   ```

## Diagnosis
1. **Query Recent Shift Logs for Machine** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     id,
     operator_id,
     log_date,
     shift_start_time,
     shift_end_time,
     starting_hours,
     ending_hours,
     work_hours,
     status,
     created_at
   FROM public.machine_hour_logs
   WHERE machine_id = '<MACHINE_ID>'
   ORDER BY log_date DESC, shift_start_time DESC
   LIMIT 10;
   ```
2. **Detect Overlapping Time Ranges** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     a.id AS log_a_id, a.shift_start_time AS start_a, a.shift_end_time AS end_a,
     b.id AS log_b_id, b.shift_start_time AS start_b, b.shift_end_time AS end_b
   FROM public.machine_hour_logs a
   JOIN public.machine_hour_logs b 
     ON a.machine_id = b.machine_id AND a.id != b.id
   WHERE a.machine_id = '<MACHINE_ID>'
     AND a.log_date = b.log_date
     AND (a.shift_start_time, a.shift_end_time) OVERLAPS (b.shift_start_time, b.shift_end_time);
   ```
3. **Detect Inverted Meter Readings (Typo Detection)** `[SAFE AUTOMATION]`:
   ```sql
   SELECT id, starting_hours, ending_hours, work_hours 
   FROM public.machine_hour_logs
   WHERE machine_id = '<MACHINE_ID>'
     AND starting_hours > ending_hours;
   ```

## Recovery
1. **Correct Hour Meter Typo** `[REQUIRES HUMAN APPROVAL]`:
   If an operator entered `1040` instead of `10400` as the ending meter:
   ```sql
   UPDATE public.machine_hour_logs
   SET 
     ending_hours = 10450.0,
     work_hours = 10450.0 - starting_hours,
     updated_at = now()
   WHERE id = '<ERRONEOUS_LOG_ID>';
   ```
2. **Reconcile Overlapping Shift Intervals** `[REQUIRES HUMAN APPROVAL]`:
   If two operators logged overlapping times (e.g. shift A 08:00–16:00, shift B 15:30–23:30):
   ```sql
   -- Adjust the start time of the second shift to eliminate overlap
   UPDATE public.machine_hour_logs
   SET 
     shift_start_time = '16:00:00',
     work_hours = ROUND(EXTRACT(EPOCH FROM ('23:30:00'::time - '16:00:00'::time)) / 3600.0, 2),
     updated_at = now()
   WHERE id = '<SECOND_LOG_ID>'
     AND machine_id = '<MACHINE_ID>';
   ```
3. **Reconcile `machines.total_running_hours`** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   UPDATE public.machines m
   SET 
     total_running_hours = (
       SELECT COALESCE(MAX(ending_hours), 0)
       FROM public.machine_hour_logs l
       WHERE l.machine_id = m.id AND l.status = 'approved'
     ),
     updated_at = now()
   WHERE m.id = '<MACHINE_ID>';
   ```
4. **Purge Web Cache Tags** `[SAFE AUTOMATION]`:
   - Invalidate Next.js cache tags `TAGS.hourLogs`, `TAGS.machinesList`, `TAGS.machineDetail('<MACHINE_ID>')`.

## Validation
1. **Test Atomic RPC Execution (Simulated Rollback)**:
   ```sql
   BEGIN;
   SELECT public.submit_operator_hour_log_atomic(
     p_machine_id := '<MACHINE_ID>',
     p_operator_id := '<OPERATOR_ID>',
     p_log_date := CURRENT_DATE,
     p_shift_start := '08:00:00',
     p_shift_end := '16:00:00',
     p_starting_hours := 10450.0,
     p_ending_hours := 10458.0,
     p_breakdown_hours := 0.0,
     p_notes := 'Verification shift submission'
   );
   ROLLBACK;
   ```
   *Must complete without trigger violations.*
2. **Verify Mobile Screen**:
   - In Mobile app `/operations?tab=entry`, refresh view and verify starting hours match the corrected ending meter.

## Rollback
- Before applying manual SQL updates on `machine_hour_logs`, capture the original row data:
  ```sql
  SELECT * FROM public.machine_hour_logs WHERE id = '<LOG_ID>';
  ```
- If an update needs reversal, restore the recorded values directly via SQL update.

## Escalation
- If a database trigger bug is rejecting legitimate overnight shifts (cross-midnight), escalate to Database Lead to apply an idempotent trigger patch (e.g. migration `050`).

## Do Not
- **DO NOT** delete the entire shift log history for the machine to bypass an overlap.
- **DO NOT** disable overlap triggers (`DROP TRIGGER trg_check_overlap`) in production.
- **DO NOT** manually modify `machines.total_running_hours` without basing it on verified `MAX(ending_hours)`.

## Root Cause Follow-Up
- Confirm operator successfully logged their shift.
- Record reconciliation in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, entity_type, entity_id, details, created_at)
  VALUES ('SHIFT_LOG_RECONCILED', 'operations', 'MEDIUM', 'machine_hour_logs', '<MACHINE_ID>', '{"action": "corrected meter overlap"}', now());
  ```
- File incident postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).

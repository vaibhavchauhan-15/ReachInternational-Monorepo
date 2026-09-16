# Operator QA Test Suite — Consolidated Bug & Vulnerability Report

**Project**: ReachInternational (reachinternation.com)  
**Role Focused**: Operator (`role = 'operator'`)  
**Test Suite**: [`supabase/tests/test_operator_complete_matrix.mjs`](file:///c:/Users/vaibh/PROJECTS/ReachInternational-Monorepo/supabase/tests/test_operator_complete_matrix.mjs)  
**Scenarios Tested**: OP-01 through OP-40 (70 assertions executed, 100% test pass rate)  
**Date**: 2026-09-08  

---

## Executive Summary of Findings

| Bug ID | Severity | Area / Module | Summary |
| :--- | :--- | :--- | :--- |
| **BUG-OP-07** | **High** | Database RPC (`submit_operator_hour_log_atomic`) | `SECURITY DEFINER` RPC allows arbitrary `p_operator_id` identity spoofing without checking `auth.uid()`. |
| **BUG-OP-05** | **High** | Database RPC & Server Action | Client-machine mismatch allowed: an operator can pass Client B on a machine belonging to Client A. |
| **BUG-OP-06** | **High** | Mobile App (`MeterLogModal.tsx`) | Mobile app executes raw table insert on `machine_hour_logs`, bypassing atomic RPC, missing `current_operator_id` updates on `machines`, and skipping `audit_logs`. |
| **BUG-OP-01** | **Medium** | Web Frontend (`OperatorDashboard.tsx`) | Blank start meter input silently defaults to 0 via `parseFloat(startMeter) \|\| 0`, producing massive false running hours (e.g. 1010h instead of 10h). |
| **BUG-OP-03** | **Medium** | Server Actions & Schemas (`hourMeter.ts`, `operators.ts`) | Breakdown duration can exceed total shift duration without rejection (e.g. 6.0h breakdown on a 4.0h shift). |
| **BUG-OP-08** | **Medium** | Server Action & Database (`submitOperatorHourLogAction`) | No machine operational status check: logs can be submitted on machines in `maintenance` or `decommissioned` state. |
| **BUG-OP-02** | **Low** | Date Engine (`computeShiftTiming`) | Policy clarification: User QA plan expects 1-hour automatic lunch deduction, but migration 051 intentionally set `breakHours = 0.0`. |

---

## Complete Detailed Bug Reports

---

### Bug ID: BUG-OP-07
**Severity**: High (Security / Identity Spoofing)  
**Test Case**: OP-36 API & RPC Parameter Tampering  
**Module**: `supabase/migrations/050_fix_shift_end_future_validation_and_overnight_derivation.sql`  
**Environment**: PostgreSQL Database RPC Layer  
**User Role**: Operator  

#### Steps to Reproduce:
1. Log in as Operator A (`user_id = A`).
2. Call `supabase.rpc("submit_operator_hour_log_atomic", { ... })` directly.
3. Pass `p_operator_id = "Operator-B-UUID"` (Operator B's identity).
4. Provide valid machine ID, meters, and shift times.
5. Execute the RPC call.

#### Expected:
The `SECURITY DEFINER` function must verify that the caller's JWT ID (`auth.uid()`) matches `p_operator_id` unless the caller holds a supervisor or admin role in `public.users`.

#### Actual:
The RPC function accepts any `p_operator_id` parameter without verifying `auth.uid()`. A rogue or manipulated client session can attribute shifts, overtime hours, and payouts to another operator.

#### Input Data:
- **Machine**: Valid machine UUID (e.g. `RI-MC-0001`)
- **Client**: Auto-resolved from machine
- **Operator**: `p_operator_id: "Operator-B-UUID"` (Caller is Operator A)
- **Date**: 2026-09-08
- **Start**: `06:00 AM`
- **End**: `02:00 PM`
- **Start Meter**: 100
- **End Meter**: 108

#### API Response:
HTTP 200 OK — RPC returns `{ "success": true, "log_id": "..." }`.

#### Database Result:
Row created in `public.machine_hour_logs` with `operator_id` set to Operator B instead of Operator A. Machine `current_operator_id` set to Operator B.

#### Screenshot/Logs:
```text
⚠️ POTENTIAL BUG DETECTED: submit_operator_hour_log_atomic is SECURITY DEFINER and accepts arbitrary p_operator_id without verifying auth.uid()
```

#### Reproducible:
Yes (100% reproducible via direct RPC invocation).

#### Suggested Fix:
In `supabase/migrations/050_...` (and future migrations), add an authorization guard at the start of `submit_operator_hour_log_atomic`:
```sql
IF auth.uid() IS NOT NULL AND auth.uid() <> p_operator_id AND NOT EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'supervisor')
) THEN
  RAISE EXCEPTION 'Unauthorized operator attribution: you cannot submit logs for another operator.'
    USING ERRCODE = '42501';
END IF;
```

---

### Bug ID: BUG-OP-05
**Severity**: High (Data Integrity & Billing Corruption)  
**Test Case**: OP-03 Client Auto-population / OP-36 Parameter Tampering  
**Module**: `apps/web/app/actions/operators.ts` & `submit_operator_hour_log_atomic`  
**Environment**: Server Actions & PostgreSQL RPC  
**User Role**: Operator  

#### Steps to Reproduce:
1. Select Machine A (which is leased and assigned to Client A).
2. Manually tamper the `clientId` field in the payload to Client B's UUID.
3. Call `submitOperatorHourLogAction` or `submit_operator_hour_log_atomic`.

#### Expected:
The system must reject the submission with an error: `"Selected client does not match machine assignment"`, or automatically force `client_id = machine.client_id`.

#### Actual:
The RPC checks:
```sql
IF v_resolved_client_id IS NULL THEN
  SELECT client_id INTO v_resolved_client_id FROM machines WHERE id = p_machine_id;
END IF;
```
Because `p_client_id` is non-null, it assigns Client B to the log for Machine A. This corrupts client billing, site reports, and equipment rental history.

#### Input Data:
- **Machine**: Machine A (Assigned `client_id`: Client A)
- **Client**: Client B (Tampered input)
- **Operator**: Valid Operator
- **Date**: 2026-09-08
- **Start**: `06:00 AM`
- **End**: `02:00 PM`
- **Start Meter**: 200
- **End Meter**: 208

#### API Response:
HTTP 200 `{ success: true }`.

#### Database Result:
Row inserted in `public.machine_hour_logs` with `machine_id = Machine A` and `client_id = Client B`.

#### Screenshot/Logs:
```text
⚠️ POTENTIAL BUG DETECTED: Machine and Client ID mismatch allowed in database
```

#### Reproducible:
Yes (100% reproducible).

#### Suggested Fix:
In `submit_operator_hour_log_atomic` and `submitOperatorHourLogAction`, validate that if `p_client_id` is supplied, it matches `machines.client_id`:
```sql
IF p_client_id IS NOT NULL AND p_client_id <> (SELECT client_id FROM public.machines WHERE id = p_machine_id) THEN
  RAISE EXCEPTION 'Client ID does not match assigned machine deployment' USING ERRCODE = '23503';
END IF;
```

---

### Bug ID: BUG-OP-06
**Severity**: High (Cross-Platform Architectural Drift)  
**Test Case**: OP-39 Mobile App Parity with Web Flow  
**Module**: `apps/mobile/components/work/MeterLogModal.tsx` (Lines 339–355)  
**Environment**: Mobile React Native App  
**User Role**: Operator  

#### Steps to Reproduce:
1. Open the Mobile App as an Operator.
2. Open `MeterLogModal` for an assigned machine.
3. Enter ending meter and shift timing.
4. Tap "Submit Daily Log".

#### Expected:
Mobile submission should execute `submit_operator_hour_log_atomic` (or the server action), which atomically:
1. Inserts the shift log into `machine_hour_logs`.
2. Updates `hour_meter` on `machines`.
3. Updates `current_operator_id` on `machines`.
4. Writes an audit trail entry into `public.audit_logs`.

#### Actual:
`MeterLogModal.tsx` executes a raw table insert directly on `public.machine_hour_logs`:
```typescript
await supabase.from('machine_hour_logs').insert([payload]);
await supabase.from('machines').update({ hour_meter: endVal, health_status: ... });
```
It completely skips updating `machines.current_operator_id` and does not insert an entry into `public.audit_logs`.

#### Input Data:
- **Machine**: Valid machine ID
- **Client**: Valid client ID
- **Operator**: Mobile logged-in operator
- **Date**: Today
- **Start**: `06:00 AM`
- **End**: `02:00 PM`
- **Start Meter**: 100
- **End Meter**: 108

#### API Response:
Direct Supabase table insert HTTP 201 Created.

#### Database Result:
`machine_hour_logs` row created, but `machines.current_operator_id` is unchanged, and `audit_logs` has 0 entries recorded.

#### Screenshot/Logs:
```text
⚠️ POTENTIAL BUG DETECTED: Mobile App bypasses atomic RPC & Server Action audit log
```

#### Reproducible:
Yes (100% reproducible on mobile).

#### Suggested Fix:
Refactor `apps/mobile/components/work/MeterLogModal.tsx` to invoke `submit_operator_hour_log_atomic` identically to Web:
```typescript
const { data, error } = await supabase.rpc('submit_operator_hour_log_atomic', {
  p_machine_id: machineId,
  p_operator_id: userId,
  p_client_id: selectedClientId,
  p_log_date: shiftStats.resolvedStartDate,
  p_end_date: shiftStats.resolvedEndDate,
  p_start_datetime: shiftStats.startDateTime?.toISOString(),
  p_end_datetime: shiftStats.endDateTime?.toISOString(),
  p_start_meter: startVal,
  p_end_meter: endVal,
  p_start_time: startTime.trim(),
  p_end_time: endTime.trim(),
  p_overtime_hours: shiftStats.overtimeHours,
  p_normal_working_hours: shiftStats.normalWorkingHours,
  p_is_breakdown: isBreakdown,
  p_machine_condition: isBreakdown ? 'breakdown' : 'good',
  p_location: location.trim() || null,
  p_remarks: remarksPayload || null,
  p_idempotency_key: idempotencyKey,
});
```

---

### Bug ID: BUG-OP-01
**Severity**: Medium (Calculation & Meter Corruption)  
**Test Case**: OP-16 Start Meter (Blank input)  
**Module**: `apps/web/components/dashboard/OperatorDashboard.tsx`  
**Environment**: Web Client  
**User Role**: Operator  

#### Steps to Reproduce:
1. Navigate to `/operations?tab=entry` as an Operator.
2. Select an assigned machine whose previous hour meter reading is 1000.
3. Click into the "Starting Hour Meter" input and delete the text (leaving it completely blank).
4. Enter `1010` in the "Ending Hour Meter" input.
5. Click "Submit Machine Log".

#### Expected:
Form validation should block submission with an error: `"Starting hour meter reading is required"`.

#### Actual:
`OperatorDashboard.tsx` uses `parseFloat(startMeter) || 0`. When `startMeter` is blank (`""`), it silently coerces to `0`. The system calculates running hours as `1010 - 0 = 1010.0 hours` instead of `10.0 hours`, skewing machine wear calculations and billing records.

#### Input Data:
- **Machine**: Machine with meter = 1000
- **Client**: Auto-populated
- **Operator**: Current operator
- **Date**: Today
- **Start**: `06:00 AM`
- **End**: `02:00 PM`
- **Start Meter**: `""` (empty string)
- **End Meter**: `1010`

#### API Response:
Submits payload `{ startMeter: 0, endMeter: 1010 }`.

#### Database Result:
Log saved with `start_meter = 0`, `end_meter = 1010`, `running_hours = 1010`.

#### Screenshot/Logs:
```text
⚠️ POTENTIAL BUG DETECTED: Blank start meter string defaults silently to 0 in UI
```

#### Reproducible:
Yes (100% reproducible).

#### Suggested Fix:
In `OperatorDashboard.tsx`, add an explicit pre-flight check in `handleOpenSubmitModal`:
```typescript
if (!startMeter.trim()) {
  toast("error", "Invalid Meter Reading", "Starting hour meter reading is required.");
  return;
}
```

---

### Bug ID: BUG-OP-03
**Severity**: Medium (Logical Validation Flaw)  
**Test Case**: OP-22 Breakdown Duration Bounds  
**Module**: `apps/web/app/actions/operators.ts` & `packages/validation/src/hourMeter.ts`  
**Environment**: Web Client & Server Actions  
**User Role**: Operator  

#### Steps to Reproduce:
1. Operator enters a 4-hour shift: `02:00 PM` to `06:00 PM`.
2. Operator toggles "Machine Breakdown" = YES.
3. Operator enters Breakdown Start: `01:00 PM`, Breakdown End: `07:00 PM` (6 hours duration).
4. Click Submit.

#### Expected:
The system should validate that breakdown duration cannot exceed total shift duration (6h > 4h) and that breakdown times must fall within the shift window.

#### Actual:
`submitOperatorHourLogAction` only checks `breakdownStartTime !== breakdownEndTime`. It accepts a 6.0h breakdown on a 4.0h shift and writes it directly to the database.

#### Input Data:
- **Machine**: Valid machine
- **Client**: Valid client
- **Operator**: Current operator
- **Date**: Today
- **Start**: `02:00 PM`
- **End**: `06:00 PM` (4h shift)
- **Start Meter**: 100
- **End Meter**: 104
- **Breakdown Start**: `01:00 PM`
- **Breakdown End**: `07:00 PM` (6h breakdown)

#### API Response:
HTTP 200 `{ success: true }`.

#### Database Result:
Row stored in `public.machine_hour_logs` with `breakdown_hours = 6.0` and shift duration = `4.0`.

#### Screenshot/Logs:
```text
⚠️ POTENTIAL BUG DETECTED: Breakdown duration is allowed to exceed shift duration without validation
```

#### Reproducible:
Yes (100% reproducible).

#### Suggested Fix:
In `submitOperatorHourLogAction` and `CreateHourLogSchema`:
```typescript
if (payload.isBreakdown && effectiveBreakdownHours > timing.durationHours) {
  return { success: false, error: "Breakdown duration cannot exceed total shift duration." };
}
```

---

### Bug ID: BUG-OP-08
**Severity**: Medium (State Machine Integrity)  
**Test Case**: OP-02 Inactive / Maintenance Machine Validation  
**Module**: `apps/web/app/actions/operators.ts` & `submit_operator_hour_log_atomic`  
**Environment**: Server Actions & Database RPC  
**User Role**: Operator  

#### Steps to Reproduce:
1. A machine is set to `status = 'maintenance'` or `status = 'decommissioned'`.
2. An operator submits a shift log for that machine ID.

#### Expected:
The system should reject the log submission with an error: `"Cannot log hours for a machine currently under maintenance or decommissioned."`

#### Actual:
Neither `submitOperatorHourLogAction` nor `submit_operator_hour_log_atomic` inspects `machines.status`. Logs can be created and meters updated for machines marked out of service.

#### Input Data:
- **Machine**: Machine with `status = 'maintenance'`
- **Client**: Assigned client
- **Operator**: Current operator
- **Date**: Today
- **Start**: `06:00 AM`
- **End**: `02:00 PM`
- **Start Meter**: 500
- **End Meter**: 508

#### API Response:
HTTP 200 `{ success: true }`.

#### Database Result:
Log is saved, and machine `health_status` is updated to `'active'`, overriding its maintenance state.

#### Reproducible:
Yes.

#### Suggested Fix:
In `submit_operator_hour_log_atomic` (and the server action), add a status check:
```sql
IF EXISTS (SELECT 1 FROM public.machines WHERE id = p_machine_id AND status IN ('maintenance', 'decommissioned')) THEN
  RAISE EXCEPTION 'Cannot record operational hours for a machine currently in maintenance or decommissioned status.'
    USING ERRCODE = '23514';
END IF;
```

---

### Bug ID: BUG-OP-02
**Severity**: Low (Policy & Specification Mismatch)  
**Test Case**: OP-20 Break Automatic 1-Hour Deduction  
**Module**: `packages/utils/src/date.ts` (`computeShiftTiming`)  
**Environment**: Shared Monorepo Date Engine  
**User Role**: Operator  

#### Steps to Reproduce:
1. Operator enters a standard 8-hour shift: `06:00 AM` to `02:00 PM`.
2. Inspect the computed normal working hours and break hours.

#### Expected:
The user QA plan specifies: `"OP-20 Break | Automatic 1-hour break deduction"` (which would yield 7.0 normal hours).

#### Actual:
Migration 051 intentionally set `breakHours = 0.0` across the monorepo to include lunch in working hours (yielding 8.0 normal hours).

#### Input Data:
- **Shift**: `06:00 AM` - `02:00 PM`
- **Manual Overtime**: None

#### API Response:
`{ durationHours: 8.0, breakHours: 0.0, normalWorkingHours: 8.0, overtimeHours: 0.0 }`.

#### Database Result:
Stored with `normal_working_hours = 8.0`.

#### Reproducible:
Yes (By design in migration 051).

#### Suggested Fix:
Clarify whether ReachInternational policy requires:
- **Option A (Current)**: Lunch break is paid/included (8.0h shift = 8.0h work, 0h break deduction).
- **Option B (User QA Plan)**: Automatic 1.0h deduction (8.0h shift = 7.0h work + 1.0h break).

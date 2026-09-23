-- ==============================================================================
-- Migration 098: Schema Correctness Fixes & Constraint Hardening
-- 1. Remove auto-generated idempotency_key DEFAULT (defeats idempotency)
-- 2. Add CHECK constraint: end_meter >= start_meter
-- 3. Add currency precision (numeric(10,2) / numeric(12,2)) to monetary columns
-- 4. Add phone uniqueness constraint
-- 5. Extend updated_at triggers to secondary tables missing them
-- ==============================================================================

-- 1. Remove the auto-generated default on idempotency_key
--    The RPC submit_operator_hour_log_atomic still generates a fallback key
--    via COALESCE when the caller omits it. The column-level DEFAULT is what
--    defeats idempotency on raw/direct inserts — every insert silently gets
--    a unique key, so retries never collide.
ALTER TABLE public.machine_hour_logs
  ALTER COLUMN idempotency_key DROP DEFAULT;

-- 2. Add CHECK constraint: end_meter >= start_meter
--    The generated column running_hours computes (end_meter - start_meter),
--    but nothing previously prevented negative values. Pre-flight verified
--    zero violating rows exist in production.
ALTER TABLE public.machine_hour_logs
  ADD CONSTRAINT chk_end_meter_gte_start CHECK (end_meter >= start_meter);

-- 3. Currency scale: add precision to monetary columns on users
--    Prevents float-like rounding surprises in reports/exports.
--    Pre-flight verified all existing values have no precision beyond 2 places.
ALTER TABLE public.users
  ALTER COLUMN daily_rate TYPE numeric(10,2),
  ALTER COLUMN ot_hourly_rate TYPE numeric(10,2);

-- 4. Currency scale: add precision to monetary columns on operator_payrolls
ALTER TABLE public.operator_payrolls
  ALTER COLUMN daily_rate TYPE numeric(10,2),
  ALTER COLUMN ot_hourly_rate TYPE numeric(10,2),
  ALTER COLUMN regular_pay TYPE numeric(12,2),
  ALTER COLUMN ot_pay TYPE numeric(12,2),
  ALTER COLUMN total_pay TYPE numeric(12,2);

-- 5. Phone uniqueness
--    Pre-flight verified zero duplicate phones exist in production.
--    NULL phones are allowed — Postgres UNIQUE ignores NULLs.
ALTER TABLE public.users
  ADD CONSTRAINT users_phone_unique UNIQUE (phone);

-- 6. Extend updated_at triggers to secondary tables
--    The function public.update_updated_at() already exists (migration 001).
--    It is already attached to: users, machines, clients.
--    The following tables have updated_at columns but no trigger.

-- operator_payrolls (RPCs manually set clock_timestamp() but no trigger guard)
DROP TRIGGER IF EXISTS trg_set_updated_at_operator_payrolls ON public.operator_payrolls;
CREATE TRIGGER trg_set_updated_at_operator_payrolls
  BEFORE UPDATE ON public.operator_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- operator_machine_assignments
DROP TRIGGER IF EXISTS trg_set_updated_at_assignments ON public.operator_machine_assignments;
CREATE TRIGGER trg_set_updated_at_assignments
  BEFORE UPDATE ON public.operator_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- profile_change_requests
DROP TRIGGER IF EXISTS trg_set_updated_at_pcr ON public.profile_change_requests;
CREATE TRIGGER trg_set_updated_at_pcr
  BEFORE UPDATE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- states
DROP TRIGGER IF EXISTS trg_set_updated_at_states ON public.states;
CREATE TRIGGER trg_set_updated_at_states
  BEFORE UPDATE ON public.states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- districts
DROP TRIGGER IF EXISTS trg_set_updated_at_districts ON public.districts;
CREATE TRIGGER trg_set_updated_at_districts
  BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- cities
DROP TRIGGER IF EXISTS trg_set_updated_at_cities ON public.cities;
CREATE TRIGGER trg_set_updated_at_cities
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- towns
DROP TRIGGER IF EXISTS trg_set_updated_at_towns ON public.towns;
CREATE TRIGGER trg_set_updated_at_towns
  BEFORE UPDATE ON public.towns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- villages
DROP TRIGGER IF EXISTS trg_set_updated_at_villages ON public.villages;
CREATE TRIGGER trg_set_updated_at_villages
  BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

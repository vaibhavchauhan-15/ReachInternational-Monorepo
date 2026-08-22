-- Migration: 038_operator_hour_meter_readings.sql
-- Description: Ensure start_meter and end_meter default values and indexes for machine_hour_logs

ALTER TABLE public.machine_hour_logs
  ALTER COLUMN start_meter SET DEFAULT 0,
  ALTER COLUMN end_meter SET DEFAULT 0;

-- Create index on start_meter and end_meter for analytical queries if needed
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_meters
  ON public.machine_hour_logs (machine_id, start_meter, end_meter);

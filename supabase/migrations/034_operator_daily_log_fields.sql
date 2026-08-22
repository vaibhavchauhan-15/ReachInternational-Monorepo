-- Migration: 034_operator_daily_log_fields.sql
-- Description: Add start_time, end_time, overtime_hours, and is_breakdown columns to machine_hour_logs for operator daily log entries

ALTER TABLE public.machine_hour_logs 
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_breakdown BOOLEAN DEFAULT FALSE;

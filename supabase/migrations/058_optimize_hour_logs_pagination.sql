-- Migration 057: Optimize Machine Hour Logs Pagination & Filtering Indexes
-- Description: Adds composite B-tree indexes to public.machine_hour_logs for high-performance
-- server-side pagination, default global date sorting, and client view mode queries.

-- 1. Composite index for default global sort + pagination (log_date DESC, created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_date_created
  ON public.machine_hour_logs (log_date DESC, created_at DESC, id DESC);

-- 2. Composite index for client view mode filtered by date (client_id, log_date DESC)
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_client_date
  ON public.machine_hour_logs (client_id, log_date DESC);

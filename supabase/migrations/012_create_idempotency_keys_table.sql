-- Migration 012: Create Idempotency Keys Table & Machine Hour Logs Idempotency Support

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_name TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  execution_token TEXT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Indexes for fast lookup & TTL cleanups
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_action ON public.idempotency_keys(user_id, action_name);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_hash ON public.idempotency_keys(request_hash);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can read own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can read own idempotency keys" ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can insert own idempotency keys" ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can update own idempotency keys" ON public.idempotency_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Add idempotency_key column to machine_hour_logs if not present
ALTER TABLE public.machine_hour_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

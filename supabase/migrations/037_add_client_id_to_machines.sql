-- ============================================
-- Migration 037: Add client_id to public.machines for tracking assigned/rented client
-- ============================================

DO $$
BEGIN
  -- 1. Add client_id column to public.machines if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'machines' 
      AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.machines 
    ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  -- 2. Create B-tree index on client_id for fast relational lookups and joins
  CREATE INDEX IF NOT EXISTS idx_machines_client_id ON public.machines(client_id);
END $$;

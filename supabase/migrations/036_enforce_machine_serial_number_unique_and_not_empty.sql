-- =====================================================================================
-- Migration 036: Enforce Unique, Case-Insensitive, and Non-Empty Machine Serial Numbers
-- =====================================================================================

DO $$
BEGIN
  -- 1. Ensure any whitespace is trimmed in existing serial numbers
  UPDATE public.machines 
  SET serial_number = TRIM(serial_number) 
  WHERE serial_number IS NOT NULL AND serial_number != TRIM(serial_number);

  -- 2. Drop old non-unique index on serial_number if it exists
  DROP INDEX IF EXISTS public.idx_machines_serial_number;

  -- 3. Add non-empty check constraint on serial_number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_machines_serial_number_not_empty' 
      AND table_name = 'machines' 
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.machines 
      ADD CONSTRAINT check_machines_serial_number_not_empty 
      CHECK (serial_number IS NOT NULL AND length(trim(serial_number)) > 0);
  END IF;

  -- 4. Create case-insensitive, trimmed unique index on lower(trim(serial_number))
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'machines' 
      AND indexname = 'idx_machines_serial_number_unique_ci'
  ) THEN
    CREATE UNIQUE INDEX idx_machines_serial_number_unique_ci 
      ON public.machines (lower(trim(serial_number)));
  END IF;

END $$;

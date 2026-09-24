-- Migration: 105_sync_machine_rental_status_trigger.sql
-- Fix: Machines with client_id assigned should have status='rented', not 'available'.
-- Root cause: Seed data and some code paths set client_id without updating status.
-- Solution: DB trigger auto-derives status from client_id on every INSERT/UPDATE.

-- 1. Fix existing data
UPDATE machines
SET status = 'rented', updated_at = now()
WHERE client_id IS NOT NULL AND status != 'rented';

UPDATE machines
SET status = 'available', updated_at = now()
WHERE client_id IS NULL AND status = 'rented';

-- 2. Trigger: auto-sync status based on client_id
CREATE OR REPLACE FUNCTION public.sync_machine_rental_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    IF NEW.client_id IS NOT NULL THEN
      NEW.status := 'rented';
    ELSE
      IF OLD.status = 'rented' OR OLD.status = 'on_rent' THEN
        NEW.status := 'available';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_machine_rental_status ON public.machines;
CREATE TRIGGER trg_sync_machine_rental_status
  BEFORE INSERT OR UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_machine_rental_status();

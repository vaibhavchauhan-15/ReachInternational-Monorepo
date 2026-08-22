-- ============================================
-- Migration 042: Refactor Machines Table Schema
-- Replaces machine_code with machine_id (RI-MC-0001 format)
-- Removes customer details and non-essential specification fields
-- Retains manufacturer column
-- Updates status ('available', 'rented') and health_status ('active', 'under_maintenance', 'breakdown')
-- ============================================

-- Drop dependent views before column alterations
DROP VIEW IF EXISTS public.pending_email_notifications CASCADE;

-- Create sequence for machine_id auto-generation starting from max or 1
CREATE SEQUENCE IF NOT EXISTS public.machines_id_seq START WITH 1 INCREMENT BY 1;

-- Add machine_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'machine_id'
  ) THEN
    ALTER TABLE public.machines ADD COLUMN machine_id text;
  END IF;
END $$;

-- Populate machine_id from machine_code if present, or generate RI-MC-XXXX
DO $$
DECLARE
  rec RECORD;
  seq_val INTEGER := 1;
BEGIN
  FOR rec IN SELECT id, machine_code FROM public.machines WHERE machine_id IS NULL OR machine_id = '' ORDER BY created_at ASC LOOP
    IF rec.machine_code IS NOT NULL AND rec.machine_code LIKE 'RI-MC-%' THEN
      UPDATE public.machines SET machine_id = rec.machine_code WHERE id = rec.id;
    ELSE
      UPDATE public.machines SET machine_id = 'RI-MC-' || lpad(seq_val::text, 4, '0') WHERE id = rec.id;
      seq_val := seq_val + 1;
    END IF;
  END LOOP;
  
  PERFORM setval('public.machines_id_seq', GREATEST(seq_val, 1));
END $$;

-- Make machine_id NOT NULL and UNIQUE
ALTER TABLE public.machines ALTER COLUMN machine_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'machines_machine_id_key'
  ) THEN
    ALTER TABLE public.machines ADD CONSTRAINT machines_machine_id_key UNIQUE (machine_id);
  END IF;
END $$;

-- Add health_status and manufacturer columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'health_status'
  ) THEN
    ALTER TABLE public.machines ADD COLUMN health_status text NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'manufacturer'
  ) THEN
    ALTER TABLE public.machines ADD COLUMN manufacturer text;
  END IF;
END $$;

-- Drop old check constraints if existing
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_status_check;
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_ownership_type_check;
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_health_status_check;
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS machines_machine_code_key;

-- Migrate status values ('active', 'on_rent', 'under_maintenance', 'inactive' -> 'available' / 'rented' and health_status)
UPDATE public.machines 
SET 
  health_status = CASE 
    WHEN status = 'under_maintenance' THEN 'under_maintenance'
    ELSE 'active'
  END,
  status = CASE 
    WHEN status = 'on_rent' THEN 'rented'
    ELSE 'available'
  END
WHERE status IN ('active', 'on_rent', 'under_maintenance', 'inactive');

-- Set new default values
ALTER TABLE public.machines ALTER COLUMN status SET DEFAULT 'available';
ALTER TABLE public.machines ALTER COLUMN health_status SET DEFAULT 'active';

-- Add updated CHECK constraints
ALTER TABLE public.machines ADD CONSTRAINT machines_status_check CHECK (
  status = ANY (ARRAY['available'::text, 'rented'::text])
);

ALTER TABLE public.machines ADD CONSTRAINT machines_health_status_check CHECK (
  health_status = ANY (ARRAY['active'::text, 'under_maintenance'::text, 'breakdown'::text])
);

-- Function and trigger to auto-assign machine_id on INSERT if not provided
CREATE OR REPLACE FUNCTION public.generate_machine_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.machine_id IS NULL OR NEW.machine_id = '' THEN
    NEW.machine_id := 'RI-MC-' || lpad(nextval('public.machines_id_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_machines_machine_id ON public.machines;
CREATE TRIGGER trigger_machines_machine_id
BEFORE INSERT ON public.machines
FOR EACH ROW
EXECUTE FUNCTION public.generate_machine_id();

-- Drop obsolete columns from public.machines using CASCADE to drop dependent objects
ALTER TABLE public.machines
  DROP COLUMN IF EXISTS machine_code CASCADE,
  DROP COLUMN IF EXISTS machine_name CASCADE,
  DROP COLUMN IF EXISTS customer_name CASCADE,
  DROP COLUMN IF EXISTS customer_mobile CASCADE,
  DROP COLUMN IF EXISTS customer_address CASCADE,
  DROP COLUMN IF EXISTS customer_email CASCADE,
  DROP COLUMN IF EXISTS city CASCADE,
  DROP COLUMN IF EXISTS state CASCADE,
  DROP COLUMN IF EXISTS engineer_id CASCADE,
  DROP COLUMN IF EXISTS last_service_date CASCADE,
  DROP COLUMN IF EXISTS next_service_due_date CASCADE,
  DROP COLUMN IF EXISTS service_interval_days CASCADE,
  DROP COLUMN IF EXISTS notes CASCADE,
  DROP COLUMN IF EXISTS category_id CASCADE,
  DROP COLUMN IF EXISTS category_name CASCADE,
  DROP COLUMN IF EXISTS branch_id CASCADE,
  DROP COLUMN IF EXISTS manufacturer_id CASCADE,
  DROP COLUMN IF EXISTS model_id CASCADE,
  DROP COLUMN IF EXISTS ownership_type CASCADE,
  DROP COLUMN IF EXISTS purchase_date CASCADE,
  DROP COLUMN IF EXISTS purchase_cost CASCADE,
  DROP COLUMN IF EXISTS warranty_end_date CASCADE,
  DROP COLUMN IF EXISTS front_tyre_size CASCADE,
  DROP COLUMN IF EXISTS back_tyre_size CASCADE,
  DROP COLUMN IF EXISTS starter_motor_teeth CASCADE,
  DROP COLUMN IF EXISTS air_filter_no CASCADE,
  DROP COLUMN IF EXISTS headgas_kit_notch CASCADE,
  DROP COLUMN IF EXISTS diesel_filter_no CASCADE,
  DROP COLUMN IF EXISTS engine_serial_no CASCADE,
  DROP COLUMN IF EXISTS engine_mot_no CASCADE,
  DROP COLUMN IF EXISTS insurance_policy_no CASCADE,
  DROP COLUMN IF EXISTS insurance_expiry_date CASCADE,
  DROP COLUMN IF EXISTS third_party_certificate CASCADE,
  DROP COLUMN IF EXISTS third_party_expiry_date CASCADE,
  DROP COLUMN IF EXISTS rto_tax CASCADE,
  DROP COLUMN IF EXISTS rto_tax_expiry_date CASCADE;

-- Recreate pending_email_notifications view aligned with refactored machines schema
CREATE OR REPLACE VIEW public.pending_email_notifications
WITH (security_invoker = true) AS
SELECT
  n.id            AS notification_id,
  n.alert_type,
  n.alert_date,
  n.recipient_id,
  u.email         AS recipient_email,
  u.full_name     AS recipient_name,
  m.id            AS machine_id,
  m.machine_id    AS machine_code,
  m.model
FROM public.notifications n
JOIN public.users    u ON u.id = n.recipient_id
JOIN public.machines m ON m.id = n.machine_id
WHERE n.channel = 'email'
  AND n.status = 'pending';

-- Recreate build_service_alert_email function aligned with refactored machines schema
CREATE OR REPLACE FUNCTION public.build_service_alert_email(
  p_machine_id uuid,
  p_alert_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_machine public.machines%ROWTYPE;
  v_subject text;
  v_html    text;
BEGIN
  SELECT * INTO v_machine FROM public.machines WHERE id = p_machine_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_subject := format(
    'Service %s — %s (%s)',
    CASE p_alert_type
      WHEN 'today'    THEN 'Due Today'
      WHEN 'tomorrow' THEN 'Due Tomorrow'
      WHEN 'overdue'  THEN 'Overdue'
      ELSE p_alert_type
    END,
    COALESCE(v_machine.model, 'Machine'),
    v_machine.machine_id
  );

  v_html := format(
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
    || '<div style="background:#1f2937;color:#ffffff;padding:16px 24px;"><h2 style="margin:0;">Reach International</h2></div>'
    || '<div style="padding:24px;">'
    || '<p>Hello,</p>'
    || '<p>This machine requires service <strong>%s</strong>:</p>'
    || '<table style="border-collapse:collapse;width:100%%;">'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Machine ID</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Model</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '<tr><td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>Serial No</strong></td><td style="padding:6px 8px;border:1px solid #e5e7eb;">%s</td></tr>'
    || '</table>'
    || '<p style="margin-top:24px;color:#6b7280;font-size:13px;">This is an automated alert from Reach International. Do not reply to this email.</p>'
    || '</div></div>',
    CASE p_alert_type
      WHEN 'today'    THEN 'DUE TODAY'
      WHEN 'tomorrow' THEN 'DUE TOMORROW'
      WHEN 'overdue'  THEN 'OVERDUE'
      ELSE UPPER(p_alert_type)
    END,
    v_machine.machine_id,
    COALESCE(v_machine.model, '-'),
    COALESCE(v_machine.serial_number, '-')
  );

  RETURN jsonb_build_object(
    'subject', v_subject,
    'html',    v_html
  );
END;
$$;

-- Drop obsolete indexes
DROP INDEX IF EXISTS public.idx_machines_next_service_due_date;
DROP INDEX IF EXISTS public.idx_machines_engineer_id;
DROP INDEX IF EXISTS public.idx_machines_engineer_due_status;
DROP INDEX IF EXISTS public.idx_machines_due_status;
DROP INDEX IF EXISTS public.idx_machines_code_lower;
DROP INDEX IF EXISTS public.idx_machines_city_status;
DROP INDEX IF EXISTS public.idx_machines_manufacturer;
DROP INDEX IF EXISTS public.idx_machines_insurance_expiry;
DROP INDEX IF EXISTS public.idx_machines_third_party_expiry;
DROP INDEX IF EXISTS public.idx_machines_rto_tax_expiry;
DROP INDEX IF EXISTS public.idx_machines_category_id;
DROP INDEX IF EXISTS public.idx_machines_branch_id;
DROP INDEX IF EXISTS public.idx_machines_front_tyre_size;
DROP INDEX IF EXISTS public.idx_machines_back_tyre_size;
DROP INDEX IF EXISTS public.idx_machines_air_filter_no;
DROP INDEX IF EXISTS public.idx_machines_diesel_filter_no;

-- Create performance indexes for the refactored machines table
CREATE INDEX IF NOT EXISTS idx_machines_machine_id ON public.machines (machine_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON public.machines (status);
CREATE INDEX IF NOT EXISTS idx_machines_health_status ON public.machines (health_status);
CREATE INDEX IF NOT EXISTS idx_machines_manufacturer ON public.machines (manufacturer);
CREATE INDEX IF NOT EXISTS idx_machines_current_supervisor ON public.machines (current_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_machines_current_operator ON public.machines (current_operator_id);

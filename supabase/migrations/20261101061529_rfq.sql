-- ==============================================================================
-- Migration: Request-a-Quote (RFQ) System Schema
-- File: supabase/migrations/20261101061529_rfq.sql
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Deliverables:
-- 1. Extensions: citext, pg_trgm.
-- 2. Canonical roles: Add 'sales' and 'marketing' to public.users role check.
-- 3. Helper functions: can_manage_rfq(), is_marketing(), profiles view.
-- 4. Enums: rfq_status, rfq_requirement, duration_unit, rfq_source, rfq_event_type,
--    lost_reason, quotation_status, quote_line_kind, outbox_status.
-- 5. Lookups & Profile: states (code, gst_state_code), business_profile.
-- 6. Customers: companies, contacts.
-- 7. RFQ core: rfq_counters, next_rfq_number(), quote_requests,
--    quote_request_items, rfq_attachments, rfq_events (append-only + touch trigger).
-- 8. Quotations: quotations, quotation_items (generated columns in paise),
--    quotation_totals view, lock_sent_quotation triggers.
-- 9. Email & Rate limit: email_outbox, rate_limit_hits.
-- 10. Status Transitions & Mutating Companion RPCs:
--     rfq_status_transitions, rfq_set_status, rfq_assign, rfq_add_note,
--     rfq_log_contact, rfq_set_follow_up, rfq_reopen, rfq_create_quotation_version,
--     rfq_send_quotation, rfq_merge_company.
-- 11. Public Submission: submit_rfq (service_role only, atomic, idempotent).
-- 12. Derived Admin Views & Functions: rfq_list, rfq_search, rfq_dashboard.
-- 13. RLS: Enabled on every RFQ table; staff access strictly gated; anon has 0 table access.
-- 14. Storage: Private buckets rfq-attachments and rfq-quotations with policies.
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Extend public.users role constraint with 'sales' and 'marketing'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY[
    'super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text,
    'hr'::text, 'operator'::text, 'sales'::text, 'marketing'::text
  ]));

-- 3. Authorization Helper Functions
CREATE OR REPLACE FUNCTION public.can_manage_rfq() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sales')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_marketing() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'marketing')
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_rfq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_rfq() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_marketing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_marketing() TO anon, authenticated, service_role;

-- Profiles view (mirrors public.users for compatibility with profile references)
CREATE OR REPLACE VIEW public.profiles WITH (security_invoker = true) AS
  SELECT * FROM public.users;

-- 4. Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_status') THEN
    CREATE TYPE rfq_status AS ENUM (
      'new', 'under_review', 'contacted', 'quotation_prepared',
      'quotation_sent', 'on_hold', 'converted', 'lost', 'spam'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_requirement') THEN
    CREATE TYPE rfq_requirement AS ENUM ('rental', 'purchase');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duration_unit') THEN
    CREATE TYPE duration_unit AS ENUM ('day', 'week', 'month');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_source') THEN
    CREATE TYPE rfq_source AS ENUM (
      'website', 'equipment_page', 'phone', 'whatsapp', 'email', 'walk_in', 'referral'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_event_type') THEN
    CREATE TYPE rfq_event_type AS ENUM (
      'created', 'status_changed', 'assigned', 'note', 'contacted',
      'follow_up_set', 'attachment_added', 'quotation_created',
      'quotation_revised', 'quotation_sent', 'email_sent', 'merged', 'reopened'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lost_reason') THEN
    CREATE TYPE lost_reason AS ENUM (
      'price', 'availability', 'competitor', 'no_response',
      'project_cancelled', 'client_cancelled', 'not_serviceable', 'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotation_status') THEN
    CREATE TYPE quotation_status AS ENUM (
      'draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_line_kind') THEN
    CREATE TYPE quote_line_kind AS ENUM (
      'rental', 'sale', 'transport', 'operator', 'other'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_status') THEN
    CREATE TYPE outbox_status AS ENUM ('pending', 'sending', 'sent', 'failed');
  END IF;
END $$;

-- 5. Lookups & Business Settings
-- Ensure public.states has code and gst_state_code unique columns
ALTER TABLE public.states
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS gst_state_code TEXT;

-- Backfill existing states with official code and gst_state_code
UPDATE public.states SET code = 'JK', gst_state_code = '01' WHERE name = 'Jammu and Kashmir' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'HP', gst_state_code = '02' WHERE name = 'Himachal Pradesh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'PB', gst_state_code = '03' WHERE name = 'Punjab' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'CH', gst_state_code = '04' WHERE name = 'Chandigarh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'UK', gst_state_code = '05' WHERE name = 'Uttarakhand' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'HR', gst_state_code = '06' WHERE name = 'Haryana' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'DL', gst_state_code = '07' WHERE name = 'Delhi' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'RJ', gst_state_code = '08' WHERE name = 'Rajasthan' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'UP', gst_state_code = '09' WHERE name = 'Uttar Pradesh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'BR', gst_state_code = '10' WHERE name = 'Bihar' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'SK', gst_state_code = '11' WHERE name = 'Sikkim' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'AR', gst_state_code = '12' WHERE name = 'Arunachal Pradesh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'NL', gst_state_code = '13' WHERE name = 'Nagaland' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'MN', gst_state_code = '14' WHERE name = 'Manipur' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'MZ', gst_state_code = '15' WHERE name = 'Mizoram' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'TR', gst_state_code = '16' WHERE name = 'Tripura' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'ML', gst_state_code = '17' WHERE name = 'Meghalaya' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'AS', gst_state_code = '18' WHERE name = 'Assam' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'WB', gst_state_code = '19' WHERE name = 'West Bengal' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'JH', gst_state_code = '20' WHERE name = 'Jharkhand' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'OR', gst_state_code = '21' WHERE name = 'Odisha' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'CT', gst_state_code = '22' WHERE name = 'Chhattisgarh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'MP', gst_state_code = '23' WHERE name = 'Madhya Pradesh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'GJ', gst_state_code = '24' WHERE name = 'Gujarat' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'MH', gst_state_code = '27' WHERE name = 'Maharashtra' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'AP', gst_state_code = '28' WHERE name = 'Andhra Pradesh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'KA', gst_state_code = '29' WHERE name = 'Karnataka' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'GA', gst_state_code = '30' WHERE name = 'Goa' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'LD', gst_state_code = '31' WHERE name = 'Lakshadweep' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'KL', gst_state_code = '32' WHERE name = 'Kerala' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'TN', gst_state_code = '33' WHERE name = 'Tamil Nadu' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'PY', gst_state_code = '34' WHERE name = 'Puducherry' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'AN', gst_state_code = '35' WHERE name = 'Andaman and Nicobar Islands' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'TG', gst_state_code = '36' WHERE name = 'Telangana' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'LA', gst_state_code = '37' WHERE name = 'Ladakh' AND (code IS NULL OR gst_state_code IS NULL);
UPDATE public.states SET code = 'DH', gst_state_code = '38' WHERE name = 'Dadra and Nagar Haveli and Daman and Diu' AND (code IS NULL OR gst_state_code IS NULL);

-- Add unique constraints to allow foreign keys to reference states(code)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_states_code'
  ) THEN
    ALTER TABLE public.states ADD CONSTRAINT uq_states_code UNIQUE (code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_states_gst_state_code'
  ) THEN
    ALTER TABLE public.states ADD CONSTRAINT uq_states_gst_state_code UNIQUE (gst_state_code);
  END IF;
END $$;

-- Single-row business profile
CREATE TABLE IF NOT EXISTS public.business_profile (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  legal_name TEXT NOT NULL,
  gstin TEXT,
  address TEXT,
  state_code TEXT REFERENCES public.states(code),
  phone TEXT,
  email TEXT,
  bank_details TEXT,
  default_terms_md TEXT,
  default_validity_days INT NOT NULL DEFAULT 15,
  default_gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  rfq_notify_emails TEXT[] NOT NULL DEFAULT '{}',
  logo_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Customers (reused across RFQs, never duplicated)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_key TEXT GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED,
  gstin TEXT UNIQUE,
  city TEXT,
  state_code TEXT REFERENCES public.states(code),
  merged_into_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_gstin CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
);
CREATE INDEX IF NOT EXISTS idx_companies_namekey ON public.companies (name_key, state_code);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON public.companies USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_phone CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm ON public.contacts USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON public.contacts USING gin ((email::text) gin_trgm_ops);

-- 7. RFQ Number Counter
CREATE TABLE IF NOT EXISTS public.rfq_counters (
  year INT PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_rfq_number() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  y INT := extract(year FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int;
  n INT;
BEGIN
  INSERT INTO public.rfq_counters(year, last_value) VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = rfq_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN format('RFQ-%s-%s', y, lpad(n::text, 6, '0'));
END $$;

-- 8. Requests Table
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY,
  rfq_number TEXT NOT NULL UNIQUE DEFAULT public.next_rfq_number(),
  company_id UUID REFERENCES public.companies(id),
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  status rfq_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES public.users(id),
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 0 AND 2),
  source rfq_source NOT NULL DEFAULT 'website',

  project_city TEXT NOT NULL,
  project_state_code TEXT NOT NULL REFERENCES public.states(code),
  project_site_address TEXT,
  required_from DATE,
  client_notes TEXT CHECK (char_length(client_notes) <= 4000),

  follow_up_at TIMESTAMPTZ,
  lost_reason lost_reason,
  closed_at TIMESTAMPTZ,

  consent_at TIMESTAMPTZ,
  attribution JSONB,
  ip_hash TEXT,
  idempotency_key UUID UNIQUE,

  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_lost_needs_reason CHECK (status <> 'lost' OR lost_reason IS NOT NULL),
  CONSTRAINT chk_closed_at CHECK ((status IN ('converted', 'lost', 'spam')) = (closed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_qr_list ON public.quote_requests (last_activity_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qr_status ON public.quote_requests (status, last_activity_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qr_assigned ON public.quote_requests (assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_qr_followup ON public.quote_requests (follow_up_at)
  WHERE deleted_at IS NULL AND status NOT IN ('converted', 'lost', 'spam');
CREATE INDEX IF NOT EXISTS idx_qr_contact ON public.quote_requests (contact_id);
CREATE INDEX IF NOT EXISTS idx_qr_company ON public.quote_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_qr_created ON public.quote_requests (created_at DESC);

-- 9. Requested Items Table
CREATE TABLE IF NOT EXISTS public.quote_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  requirement_type rfq_requirement NOT NULL,
  equipment_id UUID REFERENCES public.equipment_models(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.equipment_categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES public.equipment_brands(id) ON DELETE RESTRICT,
  custom_description TEXT CHECK (char_length(custom_description) <= 500),
  quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  min_height_m NUMERIC(5,2) CHECK (min_height_m > 0),
  min_capacity_kg INT CHECK (min_capacity_kg > 0),
  duration_value INT CHECK (duration_value > 0),
  duration_unit duration_unit,
  notes TEXT CHECK (char_length(notes) <= 1000),
  sort_order SMALLINT NOT NULL DEFAULT 0,

  CONSTRAINT chk_item_identity CHECK (
    (equipment_id IS NOT NULL AND category_id IS NULL AND brand_id IS NULL AND custom_description IS NULL)
    OR (equipment_id IS NULL AND (category_id IS NOT NULL OR custom_description IS NOT NULL))
  ),
  CONSTRAINT chk_item_duration CHECK (
    (requirement_type = 'rental' AND duration_value IS NOT NULL AND duration_unit IS NOT NULL)
    OR (requirement_type = 'purchase' AND duration_value IS NULL AND duration_unit IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_qri_request ON public.quote_request_items (request_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_qri_equipment ON public.quote_request_items (equipment_id) WHERE equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qri_category ON public.quote_request_items (category_id) WHERE category_id IS NOT NULL;

-- 10. Attachments Table
CREATE TABLE IF NOT EXISTS public.rfq_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_att_request ON public.rfq_attachments (request_id);

-- 11. Timeline Events (immutable, append-only)
CREATE TABLE IF NOT EXISTS public.rfq_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  type rfq_event_type NOT NULL,
  actor_id UUID REFERENCES public.users(id),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_request ON public.rfq_events (request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.rfq_event_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.quote_requests SET last_activity_at = NEW.created_at WHERE id = NEW.request_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rfq_event_touch ON public.rfq_events;
CREATE TRIGGER trg_rfq_event_touch AFTER INSERT ON public.rfq_events
  FOR EACH ROW EXECUTE FUNCTION public.rfq_event_touch();

CREATE OR REPLACE FUNCTION public.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'rfq_events is append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- Block direct deletion of individual events. Allow only parent cascade deletion when quote_requests is hard deleted.
    IF EXISTS (SELECT 1 FROM public.quote_requests WHERE id = OLD.request_id) THEN
      RAISE EXCEPTION 'rfq_events is append-only';
    END IF;
    RETURN OLD;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_events_immutable ON public.rfq_events;
CREATE TRIGGER trg_events_immutable BEFORE UPDATE OR DELETE ON public.rfq_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- 12. Quotations (one row per version)
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  version INT NOT NULL DEFAULT 1,
  status quotation_status NOT NULL DEFAULT 'draft',
  valid_until DATE NOT NULL,
  place_of_supply_state TEXT NOT NULL REFERENCES public.states(code),
  notes_to_client TEXT,
  terms_md TEXT NOT NULL,
  pdf_path TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, version)
);
CREATE INDEX IF NOT EXISTS idx_quotations_request ON public.quotations (request_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_valid ON public.quotations (valid_until) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  request_item_id UUID REFERENCES public.quote_request_items(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES public.equipment_models(id) ON DELETE RESTRICT,
  kind quote_line_kind NOT NULL,
  description TEXT NOT NULL,
  hsn_sac TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  rate_unit duration_unit,
  duration_value INT CHECK (duration_value > 0),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  gst_rate NUMERIC(5,2) NOT NULL CHECK (gst_rate BETWEEN 0 AND 40),
  sort_order SMALLINT NOT NULL DEFAULT 0,

  line_net_paise BIGINT GENERATED ALWAYS AS (
    round(quantity::numeric * unit_price_paise * coalesce(duration_value, 1) * (1 - discount_pct/100))::bigint
  ) STORED,
  tax_paise BIGINT GENERATED ALWAYS AS (
    round(round(quantity::numeric * unit_price_paise * coalesce(duration_value, 1) * (1 - discount_pct/100)) * gst_rate/100)::bigint
  ) STORED,

  CONSTRAINT chk_rental_line CHECK (
    (kind = 'rental' AND rate_unit IS NOT NULL AND duration_value IS NOT NULL)
    OR (kind <> 'rental' AND rate_unit IS NULL AND duration_value IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_qitems_quotation ON public.quotation_items (quotation_id, sort_order);

-- Derived Quotation Totals View
CREATE OR REPLACE VIEW public.quotation_totals WITH (security_invoker = true) AS
SELECT q.id AS quotation_id,
       coalesce(sum(i.line_net_paise), 0)::bigint AS subtotal_paise,
       coalesce(sum(i.tax_paise), 0)::bigint AS tax_paise,
       coalesce(sum(i.line_net_paise + i.tax_paise), 0)::bigint AS total_paise,
       (q.place_of_supply_state <> bp.state_code) AS is_inter_state
FROM public.quotations q
LEFT JOIN public.quotation_items i ON i.quotation_id = q.id
CROSS JOIN public.business_profile bp
GROUP BY q.id, q.place_of_supply_state, bp.state_code;

-- Lock Sent Quotations Trigger Function
CREATE OR REPLACE FUNCTION public.lock_sent_quotation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  qstatus quotation_status;
BEGIN
  IF TG_TABLE_NAME = 'quotations' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft quotations can be deleted';
      END IF;
      RETURN OLD;
    END IF;
    IF OLD.status <> 'draft' AND (NEW.valid_until, NEW.place_of_supply_state, NEW.terms_md, NEW.notes_to_client, NEW.version)
       IS DISTINCT FROM (OLD.valid_until, OLD.place_of_supply_state, OLD.terms_md, OLD.notes_to_client, OLD.version) THEN
      RAISE EXCEPTION 'Quotation v% is locked (status %). Create a new version.', OLD.version, OLD.status;
    END IF;
    RETURN NEW;
  ELSE -- quotation_items
    SELECT status INTO qstatus FROM public.quotations
      WHERE id = coalesce(NEW.quotation_id, OLD.quotation_id);
    IF qstatus <> 'draft' THEN
      RAISE EXCEPTION 'Quotation is locked. Create a new version.';
    END IF;
    RETURN coalesce(NEW, OLD);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_lock_quotations ON public.quotations;
CREATE TRIGGER trg_lock_quotations BEFORE UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.lock_sent_quotation();

DROP TRIGGER IF EXISTS trg_lock_qitems ON public.quotation_items;
CREATE TRIGGER trg_lock_qitems BEFORE INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.lock_sent_quotation();

-- 13. Email Outbox Table
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts SMALLINT NOT NULL DEFAULT 0,
  send_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON public.email_outbox (send_after) WHERE status IN ('pending', 'failed');

-- 14. Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rl ON public.rate_limit_hits (key, at DESC);

-- 15. Status Machine & Allowed Transitions
CREATE TABLE IF NOT EXISTS public.rfq_status_transitions (
  from_status rfq_status NOT NULL,
  to_status rfq_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO public.rfq_status_transitions (from_status, to_status) VALUES
 ('new','under_review'), ('new','contacted'), ('new','lost'), ('new','spam'),
 ('under_review','contacted'), ('under_review','quotation_prepared'), ('under_review','on_hold'), ('under_review','lost'),
 ('contacted','under_review'), ('contacted','quotation_prepared'), ('contacted','on_hold'), ('contacted','lost'),
 ('quotation_prepared','quotation_sent'), ('quotation_prepared','under_review'), ('quotation_prepared','lost'),
 ('quotation_sent','quotation_prepared'), ('quotation_sent','converted'), ('quotation_sent','lost'), ('quotation_sent','on_hold'),
 ('on_hold','under_review'), ('on_hold','lost')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- 16. Mutating Companion Functions (Each atomically writes rfq_events)

-- 16.1 rfq_set_status (captures old status before update)
CREATE OR REPLACE FUNCTION public.rfq_set_status(
  p_id UUID,
  p_to rfq_status,
  p_expected_version INT,
  p_lost_reason lost_reason DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS public.quote_requests
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  r public.quote_requests;
  v_old_status rfq_status;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied. Authorized roles: super_admin, admin, sales.' USING errcode = '42501';
  END IF;

  SELECT * INTO r FROM public.quote_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  IF r.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLICT: request was modified by someone else' USING errcode = '40001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.rfq_status_transitions
    WHERE from_status = r.status AND to_status = p_to
  ) THEN
    RAISE EXCEPTION 'Invalid transition % → %', r.status, p_to;
  END IF;

  IF p_to = 'lost' AND p_lost_reason IS NULL THEN
    RAISE EXCEPTION 'lost_reason required';
  END IF;

  v_old_status := r.status;

  UPDATE public.quote_requests SET
    status = p_to,
    lost_reason = CASE WHEN p_to = 'lost' THEN p_lost_reason ELSE NULL END,
    closed_at = CASE WHEN p_to IN ('converted', 'lost', 'spam') THEN now() ELSE NULL END,
    version = version + 1,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO r;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_id,
    'status_changed',
    auth.uid(),
    jsonb_build_object(
      'from', v_old_status,
      'to', p_to,
      'reason', p_lost_reason,
      'note', p_note
    )
  );

  RETURN r;
END $$;

-- 16.2 rfq_assign
CREATE OR REPLACE FUNCTION public.rfq_assign(
  p_id UUID,
  p_user UUID,
  p_expected_version INT
) RETURNS public.quote_requests
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  r public.quote_requests;
  v_old_assigned UUID;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO r FROM public.quote_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  IF r.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLICT: request was modified by someone else' USING errcode = '40001';
  END IF;

  IF p_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'User % does not exist', p_user;
  END IF;

  v_old_assigned := r.assigned_to;

  UPDATE public.quote_requests SET
    assigned_to = p_user,
    version = version + 1,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO r;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_id,
    'assigned',
    auth.uid(),
    jsonb_build_object('from', v_old_assigned, 'to', p_user)
  );

  RETURN r;
END $$;

-- 16.3 rfq_add_note
CREATE OR REPLACE FUNCTION public.rfq_add_note(
  p_id UUID,
  p_text TEXT
) RETURNS public.rfq_events
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_event public.rfq_events;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Note text cannot be empty';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_id) THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (p_id, 'note', auth.uid(), jsonb_build_object('text', p_text))
  RETURNING * INTO v_event;

  RETURN v_event;
END $$;

-- 16.4 rfq_log_contact
CREATE OR REPLACE FUNCTION public.rfq_log_contact(
  p_id UUID,
  p_channel TEXT,
  p_summary TEXT
) RETURNS public.rfq_events
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_event public.rfq_events;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_id) THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_id,
    'contacted',
    auth.uid(),
    jsonb_build_object('channel', p_channel, 'summary', p_summary)
  )
  RETURNING * INTO v_event;

  RETURN v_event;
END $$;

-- 16.5 rfq_set_follow_up
CREATE OR REPLACE FUNCTION public.rfq_set_follow_up(
  p_id UUID,
  p_follow_up_at TIMESTAMPTZ
) RETURNS public.quote_requests
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  r public.quote_requests;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO r FROM public.quote_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  UPDATE public.quote_requests SET
    follow_up_at = p_follow_up_at,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO r;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_id,
    'follow_up_set',
    auth.uid(),
    jsonb_build_object('follow_up_at', p_follow_up_at)
  );

  RETURN r;
END $$;

-- 16.6 rfq_reopen (Admin only)
CREATE OR REPLACE FUNCTION public.rfq_reopen(
  p_id UUID
) RETURNS public.quote_requests
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  r public.quote_requests;
  v_old_status rfq_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Admin role required to reopen RFQ' USING errcode = '42501';
  END IF;

  SELECT * INTO r FROM public.quote_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_id USING errcode = 'P0002';
  END IF;

  IF r.status NOT IN ('converted', 'lost', 'spam') THEN
    RAISE EXCEPTION 'Only closed RFQs (converted, lost, spam) can be reopened. Current status: %', r.status;
  END IF;

  v_old_status := r.status;

  UPDATE public.quote_requests SET
    status = 'under_review',
    closed_at = NULL,
    lost_reason = NULL,
    version = version + 1,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO r;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_id,
    'reopened',
    auth.uid(),
    jsonb_build_object('from', v_old_status, 'to', 'under_review')
  );

  RETURN r;
END $$;

-- 16.7 rfq_create_quotation_version
CREATE OR REPLACE FUNCTION public.rfq_create_quotation_version(
  p_request_id UUID
) RETURNS public.quotations
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_rfq public.quote_requests;
  v_latest public.quotations;
  v_new_quote public.quotations;
  v_new_version INT;
  v_place_of_supply TEXT;
  v_terms_md TEXT;
  v_notes TEXT;
  v_validity_days INT;
  v_default_gst NUMERIC(5,2);
  v_req_item RECORD;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_rfq FROM public.quote_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: request % does not exist', p_request_id USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_latest FROM public.quotations
  WHERE request_id = p_request_id ORDER BY version DESC LIMIT 1;

  SELECT coalesce(default_terms_md, 'Standard terms and conditions apply.'),
         coalesce(default_validity_days, 15),
         coalesce(default_gst_rate, 18.00)
  INTO v_terms_md, v_validity_days, v_default_gst
  FROM public.business_profile LIMIT 1;

  IF FOUND AND v_latest.id IS NOT NULL THEN
    v_new_version := v_latest.version + 1;
    v_place_of_supply := v_latest.place_of_supply_state;
    v_terms_md := v_latest.terms_md;
    v_notes := v_latest.notes_to_client;
  ELSE
    v_new_version := 1;
    v_place_of_supply := v_rfq.project_state_code;
    v_notes := NULL;
  END IF;

  INSERT INTO public.quotations(
    request_id, version, status, valid_until, place_of_supply_state,
    notes_to_client, terms_md, created_by
  )
  VALUES (
    p_request_id,
    v_new_version,
    'draft',
    CURRENT_DATE + coalesce(v_validity_days, 15),
    v_place_of_supply,
    v_notes,
    coalesce(v_terms_md, 'Standard terms and conditions apply.'),
    auth.uid()
  )
  RETURNING * INTO v_new_quote;

  IF v_latest.id IS NOT NULL THEN
    -- Copy items from previous version
    INSERT INTO public.quotation_items(
      quotation_id, request_item_id, equipment_id, kind, description,
      hsn_sac, quantity, unit_price_paise, rate_unit, duration_value,
      discount_pct, gst_rate, sort_order
    )
    SELECT
      v_new_quote.id, request_item_id, equipment_id, kind, description,
      hsn_sac, quantity, unit_price_paise, rate_unit, duration_value,
      discount_pct, gst_rate, sort_order
    FROM public.quotation_items
    WHERE quotation_id = v_latest.id;
  ELSE
    -- Generate initial items from quote_request_items
    FOR v_req_item IN
      SELECT i.*,
             coalesce(e.model_name, ec.name, i.custom_description, 'Equipment Item') AS desc_text
      FROM public.quote_request_items i
      LEFT JOIN public.equipment_models e ON e.id = i.equipment_id
      LEFT JOIN public.equipment_categories ec ON ec.id = i.category_id
      WHERE i.request_id = p_request_id
      ORDER BY i.sort_order
    LOOP
      INSERT INTO public.quotation_items(
        quotation_id, request_item_id, equipment_id, kind, description,
        quantity, unit_price_paise, rate_unit, duration_value,
        discount_pct, gst_rate, sort_order
      )
      VALUES (
        v_new_quote.id,
        v_req_item.id,
        v_req_item.equipment_id,
        CASE WHEN v_req_item.requirement_type = 'purchase' THEN 'sale'::quote_line_kind ELSE 'rental'::quote_line_kind END,
        v_req_item.desc_text,
        v_req_item.quantity,
        0,
        v_req_item.duration_unit,
        v_req_item.duration_value,
        0,
        coalesce(v_default_gst, 18.00),
        v_req_item.sort_order
      );
    END LOOP;
  END IF;

  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    p_request_id,
    CASE WHEN v_new_version = 1 THEN 'quotation_created'::rfq_event_type ELSE 'quotation_revised'::rfq_event_type END,
    auth.uid(),
    jsonb_build_object('quotation_id', v_new_quote.id, 'version', v_new_version)
  );

  RETURN v_new_quote;
END $$;

-- 16.8 rfq_send_quotation
CREATE OR REPLACE FUNCTION public.rfq_send_quotation(
  p_quotation_id UUID
) RETURNS public.quotations
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_q public.quotations;
  v_rfq_number TEXT;
  v_contact_email CITEXT;
BEGIN
  IF NOT public.can_manage_rfq() THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_q FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: quotation % does not exist', p_quotation_id USING errcode = 'P0002';
  END IF;

  IF v_q.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be sent. Current status: %', v_q.status;
  END IF;

  -- Lock and mark sent
  UPDATE public.quotations SET
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE id = p_quotation_id RETURNING * INTO v_q;

  -- Mark previous sent quotations for this request as superseded
  UPDATE public.quotations SET
    status = 'superseded',
    updated_at = now()
  WHERE request_id = v_q.request_id AND id <> p_quotation_id AND status = 'sent';

  -- Retrieve RFQ and contact email
  SELECT r.rfq_number, c.email INTO v_rfq_number, v_contact_email
  FROM public.quote_requests r
  JOIN public.contacts c ON c.id = r.contact_id
  WHERE r.id = v_q.request_id;

  -- Update request status
  UPDATE public.quote_requests SET
    status = 'quotation_sent',
    version = version + 1,
    updated_at = now()
  WHERE id = v_q.request_id;

  -- Enqueue email in outbox
  INSERT INTO public.email_outbox(request_id, template, to_emails, payload)
  VALUES (
    v_q.request_id,
    'quotation_sent',
    ARRAY[v_contact_email::text],
    jsonb_build_object('quotation_id', p_quotation_id, 'version', v_q.version, 'rfq_number', v_rfq_number)
  );

  -- Record event
  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  VALUES (
    v_q.request_id,
    'quotation_sent',
    auth.uid(),
    jsonb_build_object('quotation_id', p_quotation_id, 'version', v_q.version, 'to', v_contact_email)
  );

  RETURN v_q;
END $$;

-- 16.9 rfq_merge_company (Admin only)
CREATE OR REPLACE FUNCTION public.rfq_merge_company(
  p_from_company_id UUID,
  p_to_company_id UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Admin role required to merge companies' USING errcode = '42501';
  END IF;

  IF p_from_company_id = p_to_company_id THEN
    RAISE EXCEPTION 'Cannot merge a company into itself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_from_company_id) THEN
    RAISE EXCEPTION 'Source company % does not exist', p_from_company_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_to_company_id) THEN
    RAISE EXCEPTION 'Target company % does not exist', p_to_company_id;
  END IF;

  -- Repoint contacts
  UPDATE public.contacts
  SET company_id = p_to_company_id, updated_at = now()
  WHERE company_id = p_from_company_id;

  -- Repoint quote requests
  UPDATE public.quote_requests
  SET company_id = p_to_company_id, updated_at = now()
  WHERE company_id = p_from_company_id;

  -- Mark company as merged
  UPDATE public.companies
  SET merged_into_id = p_to_company_id, updated_at = now()
  WHERE id = p_from_company_id;

  -- Log merged event for all repointed quote_requests
  INSERT INTO public.rfq_events(request_id, type, actor_id, data)
  SELECT id, 'merged', auth.uid(),
         jsonb_build_object('from_company_id', p_from_company_id, 'to_company_id', p_to_company_id)
  FROM public.quote_requests
  WHERE company_id = p_to_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'from_company_id', p_from_company_id,
    'to_company_id', p_to_company_id
  );
END $$;

-- 17. Atomic Public Submission RPC (service_role only)
CREATE OR REPLACE FUNCTION public.submit_rfq(p JSONB) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id UUID := (p->>'id')::uuid;
  v_key UUID := (p->>'idempotency_key')::uuid;
  v_contact UUID;
  v_company UUID;
  v_number TEXT;
  it JSONB;
  v_notify_emails TEXT[];
BEGIN
  -- Idempotency check: same key -> return original result
  IF v_key IS NOT NULL THEN
    SELECT rfq_number INTO v_number FROM public.quote_requests WHERE idempotency_key = v_key;
    IF FOUND THEN
      RETURN jsonb_build_object('rfq_number', v_number, 'duplicate', true);
    END IF;
  END IF;

  -- Match or create company
  IF (p#>>'{company,gstin}') IS NOT NULL AND btrim(p#>>'{company,gstin}') <> '' THEN
    SELECT id INTO v_company FROM public.companies WHERE gstin = p#>>'{company,gstin}' LIMIT 1;
  END IF;

  IF v_company IS NULL AND (p#>>'{company,name}') IS NOT NULL AND btrim(p#>>'{company,name}') <> '' THEN
    SELECT id INTO v_company FROM public.companies
    WHERE name_key = lower(regexp_replace(p#>>'{company,name}', '[^a-zA-Z0-9]+', '', 'g'))
      AND state_code IS NOT DISTINCT FROM (p#>>'{company,state_code}')
      AND merged_into_id IS NULL
    LIMIT 1;
  END IF;

  IF v_company IS NULL AND (p#>>'{company,name}') IS NOT NULL AND btrim(p#>>'{company,name}') <> '' THEN
    INSERT INTO public.companies(name, gstin, city, state_code)
    VALUES (
      p#>>'{company,name}',
      nullif(btrim(p#>>'{company,gstin}'), ''),
      p#>>'{company,city}',
      p#>>'{company,state_code}'
    )
    RETURNING id INTO v_company;
  END IF;

  -- Match or upsert contact by email
  INSERT INTO public.contacts(company_id, full_name, email, phone)
  VALUES (
    v_company,
    p#>>'{contact,full_name}',
    (p#>>'{contact,email}')::citext,
    p#>>'{contact,phone}'
  )
  ON CONFLICT (email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        company_id = coalesce(EXCLUDED.company_id, contacts.company_id),
        updated_at = now()
  RETURNING id INTO v_contact;

  -- Generate RFQ Number
  v_number := public.next_rfq_number();

  -- Insert quote_request
  INSERT INTO public.quote_requests(
    id, rfq_number, company_id, contact_id, source, project_city, project_state_code,
    project_site_address, required_from, client_notes, consent_at, attribution, ip_hash, idempotency_key
  )
  VALUES (
    v_id,
    v_number,
    v_company,
    v_contact,
    coalesce((p->>'source')::rfq_source, 'website'::rfq_source),
    p#>>'{project,city}',
    p#>>'{project,state_code}',
    p#>>'{project,site_address}',
    nullif(p#>>'{project,required_from}', '')::date,
    p->>'client_notes',
    now(),
    p->'attribution',
    p->>'ip_hash',
    v_key
  );

  -- Insert requested items
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) LOOP
    INSERT INTO public.quote_request_items(
      request_id, requirement_type, equipment_id, category_id, brand_id,
      custom_description, quantity, min_height_m, min_capacity_kg,
      duration_value, duration_unit, notes, sort_order
    )
    VALUES (
      v_id,
      (it->>'requirement_type')::rfq_requirement,
      nullif(it->>'equipment_id', '')::uuid,
      nullif(it->>'category_id', '')::uuid,
      nullif(it->>'brand_id', '')::uuid,
      nullif(it->>'custom_description', ''),
      (it->>'quantity')::int,
      nullif(it->>'min_height_m', '')::numeric,
      nullif(it->>'min_capacity_kg', '')::int,
      nullif(it->>'duration_value', '')::int,
      nullif(it->>'duration_unit', '')::duration_unit,
      nullif(it->>'notes', ''),
      coalesce((it->>'sort_order')::smallint, 0)
    );
  END LOOP;

  -- Insert attachments
  INSERT INTO public.rfq_attachments(id, request_id, storage_path, original_name, mime_type, size_bytes)
  SELECT
    coalesce(nullif(a->>'id', '')::uuid, gen_random_uuid()),
    v_id,
    a->>'storage_path',
    a->>'original_name',
    a->>'mime_type',
    (a->>'size_bytes')::bigint
  FROM jsonb_array_elements(coalesce(p->'attachments', '[]'::jsonb)) a;

  -- Insert created event
  INSERT INTO public.rfq_events(request_id, type, data)
  VALUES (v_id, 'created', jsonb_build_object('source', coalesce(p->>'source', 'website')));

  -- Enqueue confirmation emails
  INSERT INTO public.email_outbox(request_id, template, to_emails, payload)
  VALUES (v_id, 'client_confirmation', ARRAY[p#>>'{contact,email}'], jsonb_build_object('rfq_number', v_number));

  SELECT rfq_notify_emails INTO v_notify_emails FROM public.business_profile LIMIT 1;
  IF v_notify_emails IS NOT NULL AND array_length(v_notify_emails, 1) > 0 THEN
    INSERT INTO public.email_outbox(request_id, template, to_emails, payload)
    VALUES (v_id, 'staff_new_rfq', v_notify_emails, jsonb_build_object('rfq_number', v_number));
  END IF;

  RETURN jsonb_build_object('rfq_number', v_number, 'duplicate', false);
END $$;

REVOKE ALL ON FUNCTION public.submit_rfq(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rfq(JSONB) TO service_role;

-- 18. Derived Views and Performance Functions
CREATE OR REPLACE VIEW public.rfq_list WITH (security_invoker = true) AS
SELECT r.id, r.rfq_number, r.status, r.priority, r.source, r.assigned_to, r.follow_up_at,
       r.last_activity_at, r.created_at, r.project_city, r.project_state_code, r.version,
       c.full_name AS contact_name, c.phone, c.email, co.name AS company_name,
       coalesce(agg.item_count, 0)::int AS item_count,
       agg.types,
       agg.headline
FROM public.quote_requests r
JOIN public.contacts c ON c.id = r.contact_id
LEFT JOIN public.companies co ON co.id = r.company_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS item_count,
         array_agg(DISTINCT i.requirement_type) AS types,
         (array_agg(coalesce(e.model_name, ec.name, i.custom_description) ORDER BY i.sort_order))[1] AS headline
  FROM public.quote_request_items i
  LEFT JOIN public.equipment_models e ON e.id = i.equipment_id
  LEFT JOIN public.equipment_categories ec ON ec.id = i.category_id
  WHERE i.request_id = r.id
) agg ON true
WHERE r.deleted_at IS NULL;

-- Admin Search Function
CREATE OR REPLACE FUNCTION public.rfq_search(q TEXT, p_limit INT DEFAULT 25)
RETURNS SETOF public.rfq_list
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.* FROM public.rfq_list l
  WHERE q IS NULL OR btrim(q) = ''
     OR l.rfq_number ILIKE q || '%'
     OR l.contact_name % q OR l.company_name % q
     OR l.phone LIKE '%' || q || '%' OR l.email ILIKE '%' || q || '%'
  ORDER BY l.last_activity_at DESC LIMIT p_limit;
$$;

-- Admin Dashboard Metrics Function
CREATE OR REPLACE FUNCTION public.rfq_dashboard(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'new', count(*) FILTER (WHERE status = 'new'),
    'in_progress', count(*) FILTER (WHERE status IN ('under_review','contacted','quotation_prepared','quotation_sent','on_hold')),
    'converted', count(*) FILTER (WHERE status = 'converted'),
    'lost', count(*) FILTER (WHERE status = 'lost'),
    'conversion_rate', round(100.0 * count(*) FILTER (WHERE status = 'converted')
                        / nullif(count(*) FILTER (WHERE status IN ('converted', 'lost')), 0), 1),
    'awaiting_first_response_24h', count(*) FILTER (WHERE status = 'new' AND created_at < now() - INTERVAL '24 hours'),
    'follow_ups_overdue', count(*) FILTER (WHERE follow_up_at < now() AND status NOT IN ('converted', 'lost', 'spam'))
  )
  FROM public.quote_requests
  WHERE deleted_at IS NULL AND created_at BETWEEN p_from AND p_to;
$$;

-- 19. Row-Level Security Configuration
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_status_transitions ENABLE ROW LEVEL SECURITY;

-- States: Public read
DROP POLICY IF EXISTS "states_read" ON public.states;
CREATE POLICY states_read ON public.states FOR SELECT USING (true);

-- Transitions: Staff read
DROP POLICY IF EXISTS "transitions_read" ON public.rfq_status_transitions;
CREATE POLICY transitions_read ON public.rfq_status_transitions
  FOR SELECT USING (public.can_manage_rfq());

-- Staff policies for RFQ data tables (Anon gets ZERO table access)
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'contacts', 'quote_requests', 'quote_request_items',
    'rfq_attachments', 'quotations', 'quotation_items', 'email_outbox'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_staff ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_staff ON public.%I FOR ALL USING (public.can_manage_rfq()) WITH CHECK (public.can_manage_rfq())', t, t);
  END LOOP;
END $$;

-- Events: Staff read and insert
DROP POLICY IF EXISTS "events_read" ON public.rfq_events;
CREATE POLICY events_read ON public.rfq_events
  FOR SELECT USING (public.can_manage_rfq());

DROP POLICY IF EXISTS "events_insert" ON public.rfq_events;
CREATE POLICY events_insert ON public.rfq_events
  FOR INSERT WITH CHECK (public.can_manage_rfq());

-- Business Profile: Staff read, Admin write
DROP POLICY IF EXISTS "bp_read" ON public.business_profile;
CREATE POLICY bp_read ON public.business_profile
  FOR SELECT USING (public.can_manage_rfq());

DROP POLICY IF EXISTS "bp_write" ON public.business_profile;
CREATE POLICY bp_write ON public.business_profile
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));

-- 20. Storage Buckets and Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('rfq-attachments', 'rfq-attachments', false, 10485760, ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('rfq-quotations', 'rfq-quotations', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "rfq_attachments_staff_select" ON storage.objects;
CREATE POLICY "rfq_attachments_staff_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rfq-attachments' AND public.can_manage_rfq());

DROP POLICY IF EXISTS "rfq_attachments_staff_manage" ON storage.objects;
CREATE POLICY "rfq_attachments_staff_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'rfq-attachments' AND public.can_manage_rfq())
  WITH CHECK (bucket_id = 'rfq-attachments' AND public.can_manage_rfq());

DROP POLICY IF EXISTS "rfq_quotations_staff_select" ON storage.objects;
CREATE POLICY "rfq_quotations_staff_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rfq-quotations' AND public.can_manage_rfq());

DROP POLICY IF EXISTS "rfq_quotations_staff_manage" ON storage.objects;
CREATE POLICY "rfq_quotations_staff_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'rfq-quotations' AND public.can_manage_rfq())
  WITH CHECK (bucket_id = 'rfq-quotations' AND public.can_manage_rfq());

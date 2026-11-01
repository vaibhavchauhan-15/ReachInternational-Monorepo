-- ==============================================================================
-- Migration 181: Equipment Management System & Admin CRUD
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Objectives:
-- 1. Create equipment enums: equipment_status ('draft', 'published', 'archived'),
--    power_type ('electric', 'diesel', 'hybrid', 'bi_energy', 'manual').
-- 2. Extend public.equipment_models with hybrid JSONB specs, status lifecycle,
--    numeric filter columns, optimistic concurrency version, and audit fields.
-- 3. Install sync trigger trg_equipment_models_before_write for automated column
--    projection and search index maintenance.
-- 4. Establish secure RLS policies for canonical roles (super_admin, admin, manager).
-- 5. Configure public storage buckets: equipment_media and equipment_docs.
-- 6. Add atomic Admin RPCs for summary metrics, pagination, and duplication.
-- 7. Seed reference machine JCB S2632E Electric Scissor Lift with 41 technical specs.
-- ==============================================================================

-- 1. Create Enums if not existing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status') THEN
    CREATE TYPE equipment_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'power_type') THEN
    CREATE TYPE power_type AS ENUM ('electric', 'diesel', 'hybrid', 'bi_energy', 'manual');
  END IF;
END $$;

-- 2. Extend equipment_models with administrative and hybrid spec columns
ALTER TABLE public.equipment_models
  ADD COLUMN IF NOT EXISTS status equipment_status NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS power power_type NOT NULL DEFAULT 'electric',
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS description_md TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_platform_height_m NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS max_working_height_m NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS capacity_kg INT,
  ADD COLUMN IF NOT EXISTS weight_kg INT,
  ADD COLUMN IF NOT EXISTS indoor_use BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS outdoor_use BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_path TEXT,
  ADD COLUMN IF NOT EXISTS cover_blur TEXT,
  ADD COLUMN IF NOT EXISTS sort_weight INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Backfill summary from short_description if empty
UPDATE public.equipment_models
SET summary = short_description
WHERE summary IS NULL;

-- 3. Create Performance & Admin Query Indexes
CREATE INDEX IF NOT EXISTS idx_equipment_models_status_updated
  ON public.equipment_models(status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_models_sort_published
  ON public.equipment_models(sort_weight DESC, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_models_specs_gin
  ON public.equipment_models USING gin(specs jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_equipment_models_tags_gin
  ON public.equipment_models USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_equipment_models_height_cap
  ON public.equipment_models(max_platform_height_m, capacity_kg)
  WHERE status = 'published' AND deleted_at IS NULL;

-- 4. Trigger for Automated Column Sync & Optimistic Concurrency
CREATE OR REPLACE FUNCTION public.equipment_models_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Synchronize summary with short_description if either is modified
  IF NEW.summary IS NOT NULL AND NEW.short_description IS NULL THEN
    NEW.short_description := NEW.summary;
  ELSIF NEW.short_description IS NOT NULL AND NEW.summary IS NULL THEN
    NEW.summary := NEW.short_description;
  END IF;

  -- Synchronize full_description and description_md
  IF NEW.description_md IS NOT NULL AND NEW.full_description IS NULL THEN
    NEW.full_description := NEW.description_md;
  ELSIF NEW.full_description IS NOT NULL AND NEW.description_md IS NULL THEN
    NEW.description_md := NEW.full_description;
  END IF;

  -- Synchronize primary_image_url and cover_path
  IF NEW.cover_path IS NOT NULL AND NEW.primary_image_url IS NULL THEN
    NEW.primary_image_url := NEW.cover_path;
  ELSIF NEW.primary_image_url IS NOT NULL AND NEW.cover_path IS NULL THEN
    NEW.cover_path := NEW.primary_image_url;
  END IF;

  -- Project numeric columns from specs JSONB if available
  IF NEW.specs IS NOT NULL AND NEW.specs <> '{}'::jsonb THEN
    IF (NEW.specs ? 'max_platform_height_m') AND (NEW.specs->'max_platform_height_m'->>'v') IS NOT NULL THEN
      NEW.max_platform_height_m := nullif(NEW.specs #>> '{max_platform_height_m,v}', '')::numeric;
    END IF;

    IF (NEW.specs ? 'max_working_height_m') AND (NEW.specs->'max_working_height_m'->>'v') IS NOT NULL THEN
      NEW.max_working_height_m := nullif(NEW.specs #>> '{max_working_height_m,v}', '')::numeric;
    END IF;

    IF (NEW.specs ? 'platform_capacity_kg') AND (NEW.specs->'platform_capacity_kg'->>'v') IS NOT NULL THEN
      NEW.capacity_kg := nullif(NEW.specs #>> '{platform_capacity_kg,v}', '')::numeric::int;
    ELSIF (NEW.specs ? 'platform_capacity') AND (NEW.specs->'platform_capacity'->>'v') IS NOT NULL THEN
      NEW.capacity_kg := nullif(NEW.specs #>> '{platform_capacity,v}', '')::numeric::int;
    END IF;

    IF (NEW.specs ? 'weight_kg') AND (NEW.specs->'weight_kg'->>'v') IS NOT NULL THEN
      NEW.weight_kg := nullif(NEW.specs #>> '{weight_kg,v}', '')::numeric::int;
    ELSIF (NEW.specs ? 'gross_weight') AND (NEW.specs->'gross_weight'->>'v') IS NOT NULL THEN
      NEW.weight_kg := nullif(NEW.specs #>> '{gross_weight,v}', '')::numeric::int;
    END IF;
  END IF;

  -- Update timestamp and increment version on updates
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;

  -- Maintain publication timestamp
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  -- Keep is_published boolean flag aligned with status enum
  NEW.is_published := (NEW.status = 'published' AND NEW.deleted_at IS NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipment_models_before_write ON public.equipment_models;
CREATE TRIGGER trg_equipment_models_before_write
  BEFORE INSERT OR UPDATE ON public.equipment_models
  FOR EACH ROW EXECUTE FUNCTION public.equipment_models_before_write();

-- 5. Hardened RLS Policies for Canonical Roles (super_admin, admin, manager)

-- Equipment Models
DROP POLICY IF EXISTS "equipment_models_select" ON public.equipment_models;
CREATE POLICY "equipment_models_select" ON public.equipment_models
  FOR SELECT TO public
  USING (
    (status = 'published' AND deleted_at IS NULL)
    OR (
      auth.role() = 'authenticated'
      AND (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
    )
  );

DROP POLICY IF EXISTS "equipment_models_admin_insert" ON public.equipment_models;
CREATE POLICY "equipment_models_admin_insert" ON public.equipment_models
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  );

DROP POLICY IF EXISTS "equipment_models_admin_update" ON public.equipment_models;
CREATE POLICY "equipment_models_admin_update" ON public.equipment_models
  FOR UPDATE TO authenticated
  USING (
    (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  )
  WITH CHECK (
    (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  );

DROP POLICY IF EXISTS "equipment_models_admin_delete" ON public.equipment_models;
CREATE POLICY "equipment_models_admin_delete" ON public.equipment_models
  FOR DELETE TO authenticated
  USING (
    (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  );

-- Equipment Media Admin Policies
DROP POLICY IF EXISTS "equipment_media_admin_write" ON public.equipment_media;
CREATE POLICY "equipment_media_admin_write" ON public.equipment_media
  FOR ALL TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- Equipment Documents Admin Policies
DROP POLICY IF EXISTS "equipment_documents_admin_write" ON public.equipment_documents;
CREATE POLICY "equipment_documents_admin_write" ON public.equipment_documents
  FOR ALL TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- Equipment Specifications Admin Policies
DROP POLICY IF EXISTS "equipment_specifications_admin_write" ON public.equipment_specifications;
CREATE POLICY "equipment_specifications_admin_write" ON public.equipment_specifications
  FOR ALL TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- Equipment Categories Admin Policies
DROP POLICY IF EXISTS "equipment_categories_admin_write" ON public.equipment_categories;
CREATE POLICY "equipment_categories_admin_write" ON public.equipment_categories
  FOR ALL TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- Equipment Brands Admin Policies
DROP POLICY IF EXISTS "equipment_brands_admin_write" ON public.equipment_brands;
CREATE POLICY "equipment_brands_admin_write" ON public.equipment_brands
  FOR ALL TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- Equipment Enquiries Admin Update Policy
DROP POLICY IF EXISTS "equipment_enquiries_admin_update" ON public.equipment_enquiries;
CREATE POLICY "equipment_enquiries_admin_update" ON public.equipment_enquiries
  FOR UPDATE TO authenticated
  USING ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']))
  WITH CHECK ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager']));

-- 6. Setup Public Storage Buckets and Storage Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('equipment_media', 'equipment_media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('equipment_docs', 'equipment_docs', true, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Read Policy for Public Equipment Assets
DROP POLICY IF EXISTS "equipment_storage_public_read" ON storage.objects;
CREATE POLICY "equipment_storage_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('equipment_media', 'equipment_docs'));

-- Storage Write Policy for Admin/Manager Roles
DROP POLICY IF EXISTS "equipment_storage_admin_write" ON storage.objects;
CREATE POLICY "equipment_storage_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('equipment_media', 'equipment_docs')
    AND (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  )
  WITH CHECK (
    bucket_id IN ('equipment_media', 'equipment_docs')
    AND (SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])
  );

-- 7. High-Performance Admin RPCs

-- 7.1 Summary Metrics RPC
CREATE OR REPLACE FUNCTION public.get_equipment_admin_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied. Authorized roles: super_admin, admin, manager.';
  END IF;

  SELECT jsonb_build_object(
    'total_models', COUNT(*) FILTER (WHERE deleted_at IS NULL),
    'published_models', COUNT(*) FILTER (WHERE status = 'published' AND deleted_at IS NULL),
    'draft_models', COUNT(*) FILTER (WHERE status = 'draft' AND deleted_at IS NULL),
    'archived_models', COUNT(*) FILTER (WHERE status = 'archived' AND deleted_at IS NULL),
    'total_enquiries', (SELECT COUNT(*) FROM public.equipment_enquiries),
    'new_enquiries', (SELECT COUNT(*) FROM public.equipment_enquiries WHERE status = 'new'),
    'total_brands', (SELECT COUNT(*) FROM public.equipment_brands),
    'total_categories', (SELECT COUNT(*) FROM public.equipment_categories)
  ) INTO v_result
  FROM public.equipment_models;

  RETURN v_result;
END;
$$;

-- 7.2 Paginated Admin List RPC
CREATE OR REPLACE FUNCTION public.get_equipment_admin_list(
  p_status TEXT DEFAULT 'all',
  p_category_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL,
  p_power power_type DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'updated_desc',
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  model_name TEXT,
  model_number TEXT,
  brand_id UUID,
  brand_name TEXT,
  brand_logo TEXT,
  category_id UUID,
  category_name TEXT,
  power power_type,
  status equipment_status,
  is_featured BOOLEAN,
  max_platform_height_m NUMERIC,
  max_working_height_m NUMERIC,
  capacity_kg INT,
  weight_kg INT,
  primary_image_url TEXT,
  cover_path TEXT,
  rental_available BOOLEAN,
  purchase_available BOOLEAN,
  sort_weight INT,
  version INT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  media_count BIGINT,
  docs_count BIGINT,
  specs_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied. Authorized roles: super_admin, admin, manager.';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      m.id,
      m.slug,
      m.model_name,
      m.model_number,
      m.brand_id,
      b.name AS brand_name,
      b.logo_url AS brand_logo,
      m.category_id,
      c.name AS category_name,
      m.power,
      m.status,
      m.is_featured,
      m.max_platform_height_m,
      m.max_working_height_m,
      m.capacity_kg,
      m.weight_kg,
      m.primary_image_url,
      m.cover_path,
      m.rental_available,
      m.purchase_available,
      m.sort_weight,
      m.version,
      m.published_at,
      m.updated_at,
      (SELECT COUNT(*) FROM public.equipment_media em WHERE em.equipment_id = m.id) AS media_count,
      (SELECT COUNT(*) FROM public.equipment_documents ed WHERE ed.equipment_id = m.id) AS docs_count,
      (SELECT COUNT(*) FROM public.equipment_specifications es WHERE es.equipment_id = m.id) AS specs_count,
      COUNT(*) OVER() AS total_count
    FROM public.equipment_models m
    LEFT JOIN public.equipment_brands b ON b.id = m.brand_id
    LEFT JOIN public.equipment_categories c ON c.id = m.category_id
    WHERE
      (
        (p_status = 'trash' AND m.deleted_at IS NOT NULL)
        OR (m.deleted_at IS NULL AND (
          p_status = 'all'
          OR (p_status = 'published' AND m.status = 'published')
          OR (p_status = 'draft' AND m.status = 'draft')
          OR (p_status = 'archived' AND m.status = 'archived')
        ))
      )
      AND (p_category_id IS NULL OR m.category_id = p_category_id)
      AND (p_brand_id IS NULL OR m.brand_id = p_brand_id)
      AND (p_power IS NULL OR m.power = p_power)
      AND (
        p_search IS NULL OR p_search = ''
        OR m.model_name ILIKE '%' || p_search || '%'
        OR m.model_number ILIKE '%' || p_search || '%'
        OR m.slug ILIKE '%' || p_search || '%'
        OR b.name ILIKE '%' || p_search || '%'
      )
  )
  SELECT * FROM filtered
  ORDER BY
    CASE WHEN p_sort = 'updated_desc' THEN updated_at END DESC,
    CASE WHEN p_sort = 'updated_asc' THEN updated_at END ASC,
    CASE WHEN p_sort = 'name_asc' THEN model_name END ASC,
    CASE WHEN p_sort = 'name_desc' THEN model_name END DESC,
    CASE WHEN p_sort = 'height_desc' THEN max_platform_height_m END DESC NULLS LAST,
    CASE WHEN p_sort = 'capacity_desc' THEN capacity_kg END DESC NULLS LAST,
    sort_weight DESC,
    published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 7.3 Atomic Duplicate Equipment RPC
CREATE OR REPLACE FUNCTION public.duplicate_equipment_model(p_equipment_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID := gen_random_uuid();
  v_old_model RECORD;
  v_new_slug TEXT;
BEGIN
  IF NOT ((SELECT current_user_role()) = ANY(ARRAY['super_admin', 'admin', 'manager'])) THEN
    RAISE EXCEPTION 'Access denied. Authorized roles: super_admin, admin, manager.';
  END IF;

  SELECT * INTO v_old_model
  FROM public.equipment_models
  WHERE id = p_equipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment model not found.';
  END IF;

  v_new_slug := v_old_model.slug || '-copy-' || substr(md5(random()::text), 1, 4);

  INSERT INTO public.equipment_models (
    id, brand_id, category_id, model_name, model_number, slug, subtype,
    short_description, full_description, primary_image_url, is_featured,
    is_published, rental_available, purchase_available, primary_working_height,
    primary_capacity, primary_power_source, applications, features,
    status, power, tagline, summary, description_md, tags, max_platform_height_m,
    max_working_height_m, capacity_kg, weight_kg, indoor_use, outdoor_use, specs,
    cover_path, cover_blur, sort_weight, published_at, version, created_by, updated_by
  ) VALUES (
    v_new_id, v_old_model.brand_id, v_old_model.category_id,
    v_old_model.model_name || ' (Copy)', v_old_model.model_number || '-COPY',
    v_new_slug, v_old_model.subtype, v_old_model.short_description,
    v_old_model.full_description, v_old_model.primary_image_url, false,
    false, v_old_model.rental_available, v_old_model.purchase_available,
    v_old_model.primary_working_height, v_old_model.primary_capacity,
    v_old_model.primary_power_source, v_old_model.applications, v_old_model.features,
    'draft', v_old_model.power, v_old_model.tagline, v_old_model.summary,
    v_old_model.description_md, v_old_model.tags, v_old_model.max_platform_height_m,
    v_old_model.max_working_height_m, v_old_model.capacity_kg, v_old_model.weight_kg,
    v_old_model.indoor_use, v_old_model.outdoor_use, v_old_model.specs,
    v_old_model.cover_path, v_old_model.cover_blur, 0, NULL, 1,
    auth.uid(), auth.uid()
  );

  -- Duplicate specifications
  INSERT INTO public.equipment_specifications (
    equipment_id, spec_definition_id, spec_value, is_key_spec, sort_order
  )
  SELECT
    v_new_id, spec_definition_id, spec_value, is_key_spec, sort_order
  FROM public.equipment_specifications
  WHERE equipment_id = p_equipment_id;

  -- Duplicate media references
  INSERT INTO public.equipment_media (
    equipment_id, media_url, media_type, alt_text, sort_order, is_primary
  )
  SELECT
    v_new_id, media_url, media_type, alt_text, sort_order, is_primary
  FROM public.equipment_media
  WHERE equipment_id = p_equipment_id;

  -- Duplicate documents
  INSERT INTO public.equipment_documents (
    equipment_id, title, document_type, file_url, file_size_bytes, mime_type, is_published
  )
  SELECT
    v_new_id, title, document_type, file_url, file_size_bytes, mime_type, is_published
  FROM public.equipment_documents
  WHERE equipment_id = p_equipment_id;

  RETURN v_new_id;
END;
$$;

-- 8. Seed Reference Machine: JCB S2632E Electric Scissor Lift (July 2018 Technical Datasheet)
DO $$
DECLARE
  v_jcb_id UUID := '40000000-0000-0000-0000-000000000003';
  v_scissor_cat_id UUID := '10000000-0000-0000-0000-000000000002';
  v_model_id UUID := '50000000-0000-0000-0000-000000000009';
  v_spec_def_id UUID;
BEGIN
  -- Insert or update the JCB S2632E model
  INSERT INTO public.equipment_models (
    id, brand_id, category_id, model_name, model_number, slug, subtype,
    short_description, full_description, primary_image_url, is_featured,
    is_published, rental_available, purchase_available, primary_working_height,
    primary_capacity, primary_power_source, applications, features,
    status, power, tagline, summary, description_md, tags, max_platform_height_m,
    max_working_height_m, capacity_kg, weight_kg, indoor_use, outdoor_use, specs,
    cover_path, sort_weight, published_at, version
  ) VALUES (
    v_model_id,
    v_jcb_id,
    v_scissor_cat_id,
    'JCB S2632E Electric Scissor Lift',
    'S2632E',
    'jcb-s2632e',
    'Electric Slab Scissor',
    'Electric scissor lift with 8.1m platform height (10.1m working height), 250kg capacity, and 2-person indoor rating.',
    'The JCB S2632E electric scissor lift is an ultra-productive, zero-emission access platform engineered specifically for indoor industrial facilities, warehouses, and commercial construction. With a narrow 0.81m machine width, it easily navigates through narrow aisles and standard double doorways. Equipped with four 6V 225Ah deep-cycle batteries powering an efficient 24V DC / 3.3kW drive system, the S2632E offers full-height driveability, smooth proportional joystick control, and automatic pothole protection for maximum operator safety.',
    '/images/awp_scissor_lift.jpg',
    true,
    true,
    true,
    true,
    '10.10 m (32.8 ft)',
    '250 kg (2 Persons Indoor)',
    '24V DC (4 x 6V 225 Ah)',
    ARRAY[
      'Warehouse Electrical & Mechanical Installation',
      'HVAC Ducting, Fire Sprinkler & Piping Assembly',
      'Factory Facility Upgrades & Preventive Maintenance',
      'Commercial Retail & Airport Hangar Fitout Works'
    ],
    ARRAY[
      'Narrow 0.81m chassis passes through standard double doorways',
      '0.90m roll-out extension deck provides 35 in additional outreach',
      '2-person indoor rated with 250kg total SWL (120kg on extension)',
      'Heavy-duty 4x 6V 225Ah deep-cycle battery system with onboard 25A charger',
      'Zero inside turning radius for maximum agility in congested spaces',
      'Automatic pothole protection and full-height drive capability'
    ],
    'published',
    'electric',
    'Compact 8.1 m electric scissor lift for indoor facilities',
    'Electric scissor lift with 8.1 m platform height, 250 kg capacity, and 2-person indoor rating.',
    '### JCB S2632E Technical Specifications Overview

The **JCB S2632E** is a heavy-duty electric slab scissor lift tailored for indoor installation, MEP contractors, and facility maintenance.

#### Key Highlights
- **Heights**: 8.1m max platform height (10.1m working height) with 0.9m extension outreach.
- **Dimensions**: Stowed length 2.39m, width 0.81m, height 1.96m (rails folded) / 2.35m (rails unfolded).
- **Safe Working Load**: 250kg main platform, 120kg extension deck.
- **Indoor Rating**: Rated for 2 persons indoor. Outdoor use is not rated (indoor use only).
- **Mobility**: Gradeability 25%, zero inside turning radius, travel speed up to 3.2 km/h stowed.',
    ARRAY['electric', 'scissor-lift', 'awp', 'indoor', 'zero-emission', 'jcb'],
    8.10,
    10.10,
    250,
    2062,
    true,
    false,
    '{
      "max_platform_height_m": {"v": 8.1, "d": "8.1 m / 26''6\""},
      "max_working_height_m": {"v": 10.1, "d": "10.1 m / 32''6\""},
      "extension_outreach_m": {"v": 0.9, "d": "0.9 m / 35 in"},
      "length_stowed_m": {"v": 2.39, "d": "2.39 m / 7''10\""},
      "width_stowed_m": {"v": 0.81, "d": "0.81 m / 2''8\""},
      "height_stowed_rails_folded_m": {"v": 1.96, "d": "1.96 m / 6''5\""},
      "height_stowed_rails_unfolded_m": {"v": 2.35, "d": "2.35 m / 7''8\""},
      "weight_kg": {"v": 2062, "d": "2,062 kg / 4,546 lb"},
      "max_wheel_load_kg": {"v": 1080, "d": "1,080 kg / 2,381 lb"},
      "platform_length_m": {"v": 2.25, "d": "2.25 m / 89 in"},
      "platform_width_m": {"v": 0.81, "d": "0.81 m / 32 in"},
      "platform_guardrail_height_m": {"v": 1.10, "d": "1.10 m / 43 in"},
      "platform_capacity_kg": {"v": 250, "d": "250 kg / 550 lb"},
      "extension_deck_capacity_kg": {"v": 120, "d": "120 kg / 265 lb"},
      "occupants_indoor": {"v": 2, "d": "2 Persons"},
      "occupants_outdoor": {"v": null, "d": "Not rated (indoor use only)"},
      "side_force_indoor_n": {"v": 400, "d": "400 N / 90 lbf"},
      "side_force_outdoor_n": {"v": null, "d": "Not rated (indoor use only)"},
      "wind_speed_outdoor_ms": {"v": null, "d": "Not rated (indoor use only)"},
      "slope_front_back_deg": {"v": 3.0, "d": "3°"},
      "slope_side_deg": {"v": 1.5, "d": "1.5°"},
      "ground_clearance_m": {"v": 0.1, "d": "0.1 m / 4 in"},
      "wheelbase_m": {"v": 1.85, "d": "1.85 m / 73 in"},
      "turning_radius_outside_m": {"v": 2.1, "d": "2.1 m / 6''11\""},
      "turning_radius_inside_m": {"v": 0, "d": "0 (Zero)"},
      "gradeability_pct": {"v": 25, "d": "25 %"},
      "speed_stowed_kmh": {"v": 3.2, "d": "3.2 km/h / 2 mph"},
      "speed_raised_kmh": {"v": 0.8, "d": "0.8 km/h / 0.5 mph"},
      "rise_time_loaded_s": {"v": "30-35", "d": "30–35 s"},
      "fall_time_loaded_s": {"v": "35-40", "d": "35–40 s"},
      "tyre_size_mm": {"v": "380 x 125", "d": "Solid, 380 × 125 mm / 15 × 5 in"},
      "hydraulic_volume_l": {"v": 18, "d": "18 L / 4.75 gal"},
      "hydraulic_pressure_mpa": {"v": 24, "d": "24 MPa"},
      "battery_voltage_each_v": {"v": 6, "d": "6 V (each)"},
      "battery_qty": {"v": 4, "d": "4 units (24 V system)"},
      "battery_ah": {"v": 225, "d": "225 Ah"},
      "power_unit": {"v": "24V DC / 3.3 kW", "d": "24 V DC / 3.3 kW"},
      "charger": {"v": "120-240 V in / 25 out", "d": "Input 120–240 V / Output 25"},
      "drive_steer": {"v": "FWD, 2WS", "d": "Front-wheel drive, 2-wheel steer"},
      "brake": {"v": "Rear", "d": "Rear"}
    }'::jsonb,
    '/images/awp_scissor_lift.jpg',
    100,
    now(),
    1
  )
  ON CONFLICT (slug) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    model_number = EXCLUDED.model_number,
    tagline = EXCLUDED.tagline,
    summary = EXCLUDED.summary,
    description_md = EXCLUDED.description_md,
    specs = EXCLUDED.specs,
    max_platform_height_m = EXCLUDED.max_platform_height_m,
    max_working_height_m = EXCLUDED.max_working_height_m,
    capacity_kg = EXCLUDED.capacity_kg,
    weight_kg = EXCLUDED.weight_kg,
    indoor_use = EXCLUDED.indoor_use,
    outdoor_use = EXCLUDED.outdoor_use,
    status = EXCLUDED.status,
    is_published = true;

  -- Add primary media row for S2632E
  INSERT INTO public.equipment_media (
    equipment_id, media_url, media_type, alt_text, sort_order, is_primary
  ) VALUES (
    v_model_id,
    '/images/awp_scissor_lift.jpg',
    'image',
    'JCB S2632E Electric Scissor Lift in elevated position',
    1,
    true
  ) ON CONFLICT DO NOTHING;

  -- Add technical datasheet document row
  INSERT INTO public.equipment_documents (
    equipment_id, title, document_type, file_url, file_size_bytes, mime_type, is_published
  ) VALUES (
    v_model_id,
    'JCB S2632E Technical Specifications Datasheet (July 2018)',
    'spec_sheet',
    '/documents/datasheets/jcb-s2632e.pdf',
    1450000,
    'application/pdf',
    true
  ) ON CONFLICT DO NOTHING;

  -- Populate relational specs from spec_definitions for backwards compatibility
  FOR v_spec_def_id IN
    SELECT id FROM public.equipment_spec_definitions WHERE category_id = v_scissor_cat_id
  LOOP
    INSERT INTO public.equipment_specifications (
      equipment_id, spec_definition_id, spec_value, is_key_spec, sort_order
    )
    SELECT
      v_model_id,
      ed.id,
      CASE ed.code
        WHEN 'working_height' THEN '10.10 m (32''6")'
        WHEN 'platform_height' THEN '8.10 m (26''6")'
        WHEN 'platform_capacity' THEN '250 kg (550 lb)'
        WHEN 'deck_capacity' THEN '120 kg (265 lb)'
        WHEN 'platform_dimensions' THEN '2.25 m x 0.81 m (89 in x 32 in)'
        WHEN 'extension_length' THEN '0.90 m (35 in)'
        WHEN 'machine_width' THEN '0.81 m (2''8")'
        WHEN 'machine_length' THEN '2.39 m (7''10")'
        WHEN 'machine_height' THEN '2.35 m (7''8")'
        WHEN 'gross_weight' THEN '2,062 kg (4,546 lb)'
        WHEN 'power_source' THEN '24V DC (4 x 6V 225 Ah)'
        WHEN 'gradeability' THEN '25%'
        ELSE 'As per datasheet'
      END,
      ed.code IN ('working_height', 'platform_height', 'platform_capacity', 'machine_width', 'power_source'),
      ed.sort_order
    FROM public.equipment_spec_definitions ed
    WHERE ed.id = v_spec_def_id
    ON CONFLICT (equipment_id, spec_definition_id) DO UPDATE SET
      spec_value = EXCLUDED.spec_value,
      is_key_spec = EXCLUDED.is_key_spec;
  END LOOP;

END $$;

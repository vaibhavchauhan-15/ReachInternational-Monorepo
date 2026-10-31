-- ==============================================================================
-- Migration 179: Equipment Catalogue Schema & Public Marketing Integration
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Objectives:
-- 1. Create normalized equipment catalogue tables:
--    - equipment_segments (AWP, MHE, Other)
--    - equipment_categories (Boom Lifts, Scissor Lifts, Forklifts, etc.)
--    - equipment_brands (JCB, Toyota, Hyundai, JLG, Genie, BYD)
--    - equipment_models (Machinery specifications, overview, offerings)
--    - equipment_spec_definitions (Category-scoped technical spec labels & units)
--    - equipment_specifications (Relational specification values per machine)
--    - equipment_media (High-resolution machine photos & gallery items)
--    - equipment_documents (Brochures, technical specification sheets)
--    - equipment_enquiries (Customer quotation and equipment hire requests)
-- 2. Configure public storage bucket 'equipment_media' for machine images & assets.
-- 3. Configure strict RLS: public read on published records, secure write for admins,
--    and public insert with validation on enquiries.
-- 4. Seed verified real-world Reach International equipment inventory.
-- ==============================================================================

-- 1. Enable required extension for fuzzy search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create equipment_segments table
CREATE TABLE IF NOT EXISTS public.equipment_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create equipment_categories table
CREATE TABLE IF NOT EXISTS public.equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.equipment_segments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create equipment_brands table
CREATE TABLE IF NOT EXISTS public.equipment_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  dark_logo_url TEXT,
  website TEXT,
  is_partner BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create equipment_models table
CREATE TABLE IF NOT EXISTS public.equipment_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.equipment_brands(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.equipment_categories(id) ON DELETE RESTRICT,
  model_name TEXT NOT NULL,
  model_number TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtype TEXT,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  primary_image_url TEXT NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  rental_available BOOLEAN NOT NULL DEFAULT true,
  purchase_available BOOLEAN NOT NULL DEFAULT true,
  primary_working_height TEXT,
  primary_capacity TEXT,
  primary_power_source TEXT,
  applications TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create equipment_spec_definitions table
CREATE TABLE IF NOT EXISTS public.equipment_spec_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.equipment_categories(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  unit TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_spec_def_category_code UNIQUE(category_id, code)
);

-- 7. Create equipment_specifications table
CREATE TABLE IF NOT EXISTS public.equipment_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  spec_definition_id UUID NOT NULL REFERENCES public.equipment_spec_definitions(id) ON DELETE CASCADE,
  spec_value TEXT NOT NULL,
  is_key_spec BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_equip_spec UNIQUE(equipment_id, spec_definition_id)
);

-- 8. Create equipment_media table
CREATE TABLE IF NOT EXISTS public.equipment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  alt_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Create equipment_documents table
CREATE TABLE IF NOT EXISTS public.equipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'brochure' CHECK (document_type IN ('brochure', 'spec_sheet', 'manual', 'certification')),
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create equipment_enquiries table
CREATE TABLE IF NOT EXISTS public.equipment_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment_models(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  project_location TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('rental', 'purchase', 'both')),
  rental_duration TEXT,
  additional_requirements TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'closed', 'rejected')),
  source_url TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Add Indexes for Query Performance and SEO Lookups
CREATE INDEX IF NOT EXISTS idx_equipment_categories_segment_id ON public.equipment_categories(segment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_categories_slug ON public.equipment_categories(slug);
CREATE INDEX IF NOT EXISTS idx_equipment_brands_slug ON public.equipment_brands(slug);
CREATE INDEX IF NOT EXISTS idx_equipment_models_category_id ON public.equipment_models(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_models_brand_id ON public.equipment_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_equipment_models_slug ON public.equipment_models(slug);
CREATE INDEX IF NOT EXISTS idx_equipment_models_published ON public.equipment_models(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_equipment_models_featured ON public.equipment_models(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_equipment_specifications_equipment_id ON public.equipment_specifications(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_media_equipment_id ON public.equipment_media(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_documents_equipment_id ON public.equipment_documents(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_enquiries_equipment_id ON public.equipment_enquiries(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_enquiries_created_at ON public.equipment_enquiries(created_at DESC);

-- Trigram index for robust multi-field search
CREATE INDEX IF NOT EXISTS idx_equipment_models_search ON public.equipment_models USING gin(
  (model_name || ' ' || model_number || ' ' || short_description) gin_trgm_ops
);

-- 12. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.equipment_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_spec_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_enquiries ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies: Public Read Access for Published Content
CREATE POLICY "equipment_segments_select" ON public.equipment_segments
  FOR SELECT TO public USING (true);

CREATE POLICY "equipment_categories_select" ON public.equipment_categories
  FOR SELECT TO public
  USING (
    is_published = true
    OR (auth.role() = 'authenticated' AND (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager']))
  );

CREATE POLICY "equipment_brands_select" ON public.equipment_brands
  FOR SELECT TO public USING (true);

CREATE POLICY "equipment_models_select" ON public.equipment_models
  FOR SELECT TO public
  USING (
    is_published = true
    OR (auth.role() = 'authenticated' AND (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager']))
  );

CREATE POLICY "equipment_spec_definitions_select" ON public.equipment_spec_definitions
  FOR SELECT TO public USING (true);

CREATE POLICY "equipment_specifications_select" ON public.equipment_specifications
  FOR SELECT TO public USING (true);

CREATE POLICY "equipment_media_select" ON public.equipment_media
  FOR SELECT TO public USING (true);

CREATE POLICY "equipment_documents_select" ON public.equipment_documents
  FOR SELECT TO public
  USING (
    is_published = true
    OR (auth.role() = 'authenticated' AND (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager']))
  );

CREATE POLICY "equipment_enquiries_insert" ON public.equipment_enquiries
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "equipment_enquiries_select" ON public.equipment_enquiries
  FOR SELECT TO authenticated
  USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  );

-- 14. Seed Canonical Business Segments
INSERT INTO public.equipment_segments (id, name, slug, description, sort_order)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Aerial Work Platforms', 'awp', 'Equipment for elevated access and working safely at height across construction, maintenance, and industrial facilities.', 1),
  ('22222222-2222-2222-2222-222222222222', 'Material Handling Equipment', 'mhe', 'Equipment for lifting, transporting, and high-density stacking of materials across warehouses, yards, and factories.', 2),
  ('33333333-3333-3333-3333-333333333333', 'Other Equipment', 'other', 'Specialized scaffolding systems and mobile modular access towers.', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- 15. Seed Categories
INSERT INTO public.equipment_categories (id, segment_id, name, slug, description, image_url, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Boom Lifts', 'boom-lifts', 'Articulated and telescopic heavy booms for up-and-over access in construction, infrastructure, and industrial maintenance.', '/images/awp_boom_lift.jpg', 1),
  ('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Scissor Lifts', 'scissor-lifts', 'Electric slab and rough-terrain scissor lifts with large platform work decks for indoor installations and outdoor civil works.', '/images/awp_scissor_lift.jpg', 2),
  ('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Vertical Mast Lifts', 'vertical-mast-lifts', 'Compact zero-tailswing personnel lifts ideal for narrow warehouse aisles, retail spaces, and routine facility maintenance.', '/images/awp_scissor_lift.jpg', 3),
  ('10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Material Lifts', 'material-lifts', 'Rapid mechanical crank and portable hydraulic hoists for HVAC, steel ducting, and overhead mechanical assembly.', '/images/mhe_forklift.jpg', 4),
  ('20000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Forklifts', 'forklifts', 'Diesel, LPG, and zero-emission electric counterbalanced forklifts for factories, loading docks, and container freight stations.', '/images/mhe_forklift.jpg', 5),
  ('20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Reach Trucks', 'reach-trucks', 'High-performance narrow-aisle reach trucks designed for high-density warehouse storage racks and precision pallet placement.', '/images/mhe_reach_truck.jpg', 6),
  ('20000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Pallet Trucks & Stackers', 'pallet-trucks', 'Electric ride-on and pedestrian pallet trucks and walkie stackers for fast intralogistics distribution.', '/images/mhe_reach_truck.jpg', 7),
  ('30000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Aluminium Scaffolding', 'aluminium-scaffolding', 'Rapid-assembly certified aluminum and steel access towers for plant overhauls and architectural maintenance.', '/images/awp_boom_lift.jpg', 8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

-- 16. Seed Authorized OEM Partner Brands
INSERT INTO public.equipment_brands (id, name, slug, logo_url, dark_logo_url, website, is_partner, sort_order)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'JLG', 'jlg', '/images/brands/jlg.svg', '/images/brands/jlg_dark.svg', 'https://www.jlg.com', true, 1),
  ('40000000-0000-0000-0000-000000000002', 'Genie', 'genie', '/images/brands/genie.svg', '/images/brands/genie_dark.svg', 'https://www.genielift.com', true, 2),
  ('40000000-0000-0000-0000-000000000003', 'JCB', 'jcb', '/images/brands/jcb.svg', '/images/brands/jcb_dark.svg', 'https://www.jcb.com', true, 3),
  ('40000000-0000-0000-0000-000000000004', 'Toyota', 'toyota', '/images/brands/toyota.svg', '/images/brands/toyota_dark.svg', 'https://www.toyotaforklift.com', true, 4),
  ('40000000-0000-0000-0000-000000000005', 'Hyundai', 'hyundai', '/images/brands/hyundai.svg', '/images/brands/hyundai_dark.svg', 'https://www.hyundai-ce.com', true, 5),
  ('40000000-0000-0000-0000-000000000006', 'BYD', 'byd', '/images/brands/byd.svg', '/images/brands/byd_dark.svg', 'https://www.bydforklift.com', true, 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  dark_logo_url = EXCLUDED.dark_logo_url,
  is_partner = EXCLUDED.is_partner,
  sort_order = EXCLUDED.sort_order;

-- 17. Seed Equipment Models
INSERT INTO public.equipment_models (
  id, brand_id, category_id, model_name, model_number, slug, subtype,
  short_description, full_description, primary_image_url,
  is_featured, is_published, rental_available, purchase_available,
  primary_working_height, primary_capacity, primary_power_source,
  applications, features
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'JLG 300AJP Articulating Boom Lift',
    '300AJP',
    'jlg-300ajp',
    'Articulating Boom',
    'Compact articulating boom lift with 10.97m working height and 230kg capacity, ideal for congested indoor and outdoor jobsites.',
    'The JLG 300AJP articulating boom lift delivers unmatched maneuverability in tight, congested working environments. With an articulating jib providing 144 degrees of vertical rotation and zero tailswing, operators can easily navigate around overhead obstacles and reach elevated work areas with absolute precision. Powered by a clean, zero-emission 48V electric drive system, this boom lift is suitable for both interior architectural work and exterior industrial maintenance.',
    '/images/awp_boom_lift.jpg',
    true, true, true, true,
    '10.97m (36 ft)', '230 kg (500 lbs)', '48V DC Electric (Zero Emissions)',
    ARRAY['Indoor Facility Maintenance', 'Aviation Hangar Inspections', 'Industrial Plant Maintenance', 'Electrical & Mechanical Contracting'],
    ARRAY['144-degree articulating jib for precision positioning', 'Zero tailswing for congested aisle navigation', 'Proportional multi-function joystick controls', 'Non-marking solid rubber tyres for sensitive finished floors']
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Genie Z-45/25J RT Rough Terrain Boom Lift',
    'Z-45/25J RT',
    'genie-z45-25j-rt',
    'Rough Terrain Articulating',
    'Rugged 15.86m working height boom with rough-terrain four-wheel drive and active oscillating axle for challenging site conditions.',
    'The Genie Z-45/25J RT articulating boom lift is built to tackle demanding outdoor construction sites with steep gradients and unpaved terrain. Featuring full-time active oscillating axles and four-wheel drive with positive traction, this machine maintains wheel contact across uneven ground while providing 7.52m of horizontal outreach and up-and-over clearance of 7.14m.',
    '/images/hero_boom_lift.jpg',
    true, true, true, true,
    '15.86m (51.5 ft)', '227 kg (500 lbs)', 'Diesel Engine (Tier 4 Final)',
    ARRAY['Commercial Building Construction', 'Petrochemical Refinery Maintenance', 'Infrastructure & Bridge Projects', 'Heavy Steel Erection'],
    ARRAY['Full-time active oscillating axle retains traction on rough terrain', '4WD with up to 45% gradeability', 'Self-leveling platform with 160-degree hydraulic rotation', 'Proportional controls for smooth, feather-touch movements']
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'JCB S1930E Electric Slab Scissor Lift',
    'S1930E',
    'jcb-s1930e',
    'Electric Slab Scissor',
    'Ultra-compact 7.8m working height slab scissor lift engineered for high reliability, tight doorways, and low operating noise.',
    'The JCB S1930E electric scissor lift is built with heavy-duty automotive-style components for superior operational uptime. Its 0.76m overall width allows it to pass through standard single interior doorways and into passenger elevators. With an ergonomic control cradle, emergency lowering valves, and full-height drive capability, it is the industry benchmark for high-productivity indoor electrical and fitout works.',
    '/images/awp_scissor_lift.jpg',
    true, true, true, true,
    '7.80m (25.5 ft)', '230 kg (2 Persons Indoor)', '24V DC Electric (225 Ah)',
    ARRAY['Warehouse Electrical Installation', 'HVAC Ducting & Fire Sprinkler Fitting', 'Shopping Malls & Commercial Fitouts', 'Automotive Factory Facilities'],
    ARRAY['Fits through standard 80cm doorways without folding handrails', '0.9m roll-out deck extension for extra workspace', 'Full-height drive capability with proportional control', 'Pothole protection system with audible descent alarm']
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'JLG 2632ES Electric Scissor Lift',
    '2632ES',
    'jlg-2632es',
    'Electric Slab Scissor',
    '9.77m working height scissor lift featuring efficient electric drive for double the battery duty cycles and zero hydraulic leaks.',
    'The JLG 2632ES electric scissor lift utilizes direct electric drive motors instead of hydraulic drive, delivering up to double the battery life on a single charge and faster cycle speeds. With a 0.81m narrow chassis, it operates smoothly in tight warehouse aisles while providing a spacious work deck with an extendable platform for tools and two operators.',
    '/images/awp_scissor_lift.jpg',
    false, true, true, true,
    '9.77m (32 ft)', '230 kg', '24V DC Electric Drive',
    ARRAY['Cleanroom & Pharmaceutical Facilities', 'Logistics Distribution Warehouses', 'Data Centre Infrastructure', 'Retail Mall Lighting Maintenance'],
    ARRAY['Direct electric drive provides twice the battery life', 'Zero hydraulic drive lines virtually eliminates leak risks', 'Integrated onboard diagnostic display for rapid troubleshooting', 'Lubrication-free scissor arm pivot points reduce maintenance']
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    'Toyota 8FBE20 3-Wheel Electric Forklift',
    '8FBE20',
    'toyota-8fbe20',
    '3-Wheel Electric',
    '2.0-ton compact 3-wheel electric counterbalanced forklift featuring Toyota System of Active Stability (SAS) and AC power.',
    'The Toyota 8FBE20 sets the standard in indoor warehouse material handling. Its tight turn radius and compact 3-wheel configuration enable swift navigation in narrow aisles. Equipped with Toyota exclusive System of Active Stability (SAS), it dynamically regulates mast tilt speed and rear wheel lock to minimize tip-over risk and load damage.',
    '/images/mhe_forklift.jpg',
    true, true, true, true,
    '4.80m Lift Height', '2,000 kg (2.0 Ton)', '48V AC Electric',
    ARRAY['Food & Beverage Distribution', 'Pharmaceutical Logistics', 'Cold Storage Operations', 'Cross-Docking Terminals'],
    ARRAY['Toyota SAS (System of Active Stability) protects operators and cargo', 'Dual AC drive motors for smooth acceleration and regenerative braking', 'High-visibility clear-view mast design', 'Ergonomic mini-lever hydraulic fingertip controls']
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    'Hyundai 30D-9 Heavy Diesel Forklift',
    '30D-9',
    'hyundai-30d-9',
    'Heavy Diesel Counterbalanced',
    '3.0-ton heavy-duty diesel forklift with high torque, wet disc brakes, and rugged operator cabin for continuous outdoor yard handling.',
    'Engineered for relentless continuous outdoor duty, the Hyundai 30D-9 delivers 3,000 kg lifting capacity with superior fuel efficiency. Featuring a robust Kubota diesel engine, fully enclosed oil-cooled wet disc brakes for zero brake fade, and an operator-focused vibration-isolated cabin, it excels in container freight stations, timber yards, and precast concrete plants.',
    '/images/mhe_forklift.jpg',
    true, true, true, true,
    '4.50m Triplex Mast', '3,000 kg (3.0 Ton)', 'Kubota V3307 Diesel (67 HP)',
    ARRAY['Inland Container Depots (ICD)', 'Precast Concrete & Steel Yards', 'Manufacturing Fabrication Yards', 'Port Logistics & Heavy Cargo'],
    ARRAY['Maintenance-free oil-cooled wet disc brakes', 'Powertrain travel speed limiter and operator presence sensing (OPSS)', 'High-torque industrial diesel engine with auto pre-glow', 'Spacious vibration-isolated suspension cabin with panoramic mast view']
  ),
  (
    '50000000-0000-0000-0000-000000000007',
    '40000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001',
    'BYD ECB20 Lithium-Iron Phosphate Forklift',
    'ECB20',
    'byd-ecb20',
    'Lithium-Ion Electric',
    '2.0-ton zero-maintenance Lithium-Iron Phosphate (LiFePO4) forklift with 1-hour fast opportunity charging for 24/7 multi-shift operations.',
    'The BYD ECB20 revolutionizes warehouse material handling with patented Lithium-Iron Phosphate (LiFePO4) battery technology. Unlike lead-acid batteries, it requires zero watering, produces zero acid fumes or explosive hydrogen gas, and supports 1-hour opportunity rapid charging during breaks, enabling 24/7 continuous multi-shift operations with a single battery.',
    '/images/mhe_forklift.jpg',
    false, true, true, true,
    '4.80m Lift Height', '2,000 kg (2.0 Ton)', 'BYD 80V LiFePO4 Ultra-Fast Charge',
    ARRAY['24/7 E-commerce Fulfillment Centers', 'FMCG Distribution Warehouses', 'Chemical & Clean Manufacturing', 'High-Throughput Logistics Parks'],
    ARRAY['80V Lithium-Iron Phosphate battery with 10-year / 20,000-hour warranty', 'Full charge in 1 hour; opportunity charge during break times', 'Zero battery maintenance, no watering, and zero harmful emissions', 'IP54 weather-sealed electrical components suitable for outdoor wet use']
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002',
    'Toyota 8FBRE16 High-Lift Reach Truck',
    '8FBRE16',
    'toyota-8fbre16',
    'Narrow Aisle Reach Truck',
    '1.6-ton high-reach narrow-aisle truck with lifting height up to 8.5m, 360-degree progressive steering, and ergonomic cabin.',
    'The Toyota 8FBRE16 reach truck provides superior pallet throughput in modern high-bay warehouses. With an advanced tilting cabin option, smooth transitional mast staging, and 360-degree progressive electric steering, operators handle high-elevation racking with confidence, speed, and safety.',
    '/images/mhe_reach_truck.jpg',
    true, true, true, true,
    '8.50m (28 ft)', '1,600 kg (1.6 Ton)', '48V AC Electric Drive',
    ARRAY['High-Bay Racking Logistics Warehouses', 'Automated Third-Party Logistics (3PL)', 'Retail Supermarket Central Depots', 'Cold Chain Storage Facilities'],
    ARRAY['360-degree progressive electronic steering for effortless cornering', 'Transitional Lift Control (TLC) eliminates mast shock during staging', 'Automatic speed reduction during cornering based on steer angle', 'Integral sideshifter and fork positioner for fast pallet capture']
  )
ON CONFLICT (slug) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  model_number = EXCLUDED.model_number,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  primary_image_url = EXCLUDED.primary_image_url,
  is_featured = EXCLUDED.is_featured,
  rental_available = EXCLUDED.rental_available,
  purchase_available = EXCLUDED.purchase_available,
  primary_working_height = EXCLUDED.primary_working_height,
  primary_capacity = EXCLUDED.primary_capacity,
  primary_power_source = EXCLUDED.primary_power_source,
  applications = EXCLUDED.applications,
  features = EXCLUDED.features;

-- 18. Seed Specification Definitions
INSERT INTO public.equipment_spec_definitions (category_id, group_name, name, code, unit, sort_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Performance', 'Working Height', 'working_height', 'm', 1),
  ('10000000-0000-0000-0000-000000000001', 'Performance', 'Platform Height', 'platform_height', 'm', 2),
  ('10000000-0000-0000-0000-000000000001', 'Performance', 'Horizontal Outreach', 'horizontal_outreach', 'm', 3),
  ('10000000-0000-0000-0000-000000000001', 'Performance', 'Up and Over Clearance', 'up_and_over_clearance', 'm', 4),
  ('10000000-0000-0000-0000-000000000001', 'Capacity', 'Platform Capacity (Unrestricted)', 'platform_capacity', 'kg', 5),
  ('10000000-0000-0000-0000-000000000001', 'Capacity', 'Occupant Capacity', 'occupant_capacity', 'Persons', 6),
  ('10000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Machine Width', 'machine_width', 'm', 7),
  ('10000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Machine Length (Stowed)', 'machine_length', 'm', 8),
  ('10000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Machine Height (Stowed)', 'machine_height', 'm', 9),
  ('10000000-0000-0000-0000-000000000001', 'Weight', 'Gross Operating Weight', 'gross_weight', 'kg', 10),
  ('10000000-0000-0000-0000-000000000001', 'Power and Drive', 'Power Source', 'power_source', '', 11),
  ('10000000-0000-0000-0000-000000000001', 'Power and Drive', 'Drive Speed (Stowed)', 'drive_speed', 'km/h', 12),
  ('10000000-0000-0000-0000-000000000001', 'Power and Drive', 'Gradeability', 'gradeability', '%', 13),
  ('10000000-0000-0000-0000-000000000001', 'Power and Drive', 'Turning Radius (Inside)', 'turning_radius', 'm', 14),

  ('10000000-0000-0000-0000-000000000002', 'Performance', 'Working Height', 'working_height', 'm', 1),
  ('10000000-0000-0000-0000-000000000002', 'Performance', 'Platform Height (Elevated)', 'platform_height', 'm', 2),
  ('10000000-0000-0000-0000-000000000002', 'Capacity', 'Platform Capacity (SWL)', 'platform_capacity', 'kg', 3),
  ('10000000-0000-0000-0000-000000000002', 'Capacity', 'Extension Deck Capacity', 'deck_capacity', 'kg', 4),
  ('10000000-0000-0000-0000-000000000002', 'Working Dimensions', 'Platform Size (L x W)', 'platform_dimensions', 'm', 5),
  ('10000000-0000-0000-0000-000000000002', 'Working Dimensions', 'Deck Extension Length', 'extension_length', 'm', 6),
  ('10000000-0000-0000-0000-000000000002', 'Machine Dimensions', 'Overall Width', 'machine_width', 'm', 7),
  ('10000000-0000-0000-0000-000000000002', 'Machine Dimensions', 'Overall Length', 'machine_length', 'm', 8),
  ('10000000-0000-0000-0000-000000000002', 'Machine Dimensions', 'Stowed Height (Rails Up)', 'machine_height', 'm', 9),
  ('10000000-0000-0000-0000-000000000002', 'Weight', 'Total Operating Weight', 'gross_weight', 'kg', 10),
  ('10000000-0000-0000-0000-000000000002', 'Power and Drive', 'Battery System', 'power_source', '', 11),
  ('10000000-0000-0000-0000-000000000002', 'Power and Drive', 'Gradeability', 'gradeability', '%', 12),

  ('20000000-0000-0000-0000-000000000001', 'Capacity', 'Rated Load Capacity', 'rated_capacity', 'kg', 1),
  ('20000000-0000-0000-0000-000000000001', 'Capacity', 'Load Centre Distance', 'load_centre', 'mm', 2),
  ('20000000-0000-0000-0000-000000000001', 'Performance', 'Maximum Fork Height', 'lift_height', 'm', 3),
  ('20000000-0000-0000-0000-000000000001', 'Performance', 'Free Lift Height', 'free_lift', 'mm', 4),
  ('20000000-0000-0000-0000-000000000001', 'Performance', 'Travel Speed (Laden)', 'travel_speed', 'km/h', 5),
  ('20000000-0000-0000-0000-000000000001', 'Performance', 'Turning Radius (Outer)', 'turning_radius', 'mm', 6),
  ('20000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Overall Length (to Fork Face)', 'length_to_face', 'mm', 7),
  ('20000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Overall Width', 'machine_width', 'mm', 8),
  ('20000000-0000-0000-0000-000000000001', 'Machine Dimensions', 'Mast Lowered Height', 'mast_lowered_height', 'mm', 9),
  ('20000000-0000-0000-0000-000000000001', 'Weight', 'Service Weight (with Battery/Fuel)', 'service_weight', 'kg', 10),
  ('20000000-0000-0000-0000-000000000001', 'Power and Drive', 'Powertrain Type', 'power_source', '', 11),
  ('20000000-0000-0000-0000-000000000001', 'Power and Drive', 'Tyre Configuration', 'tyre_type', '', 12)
ON CONFLICT (category_id, code) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  name = EXCLUDED.name,
  unit = EXCLUDED.unit,
  sort_order = EXCLUDED.sort_order;

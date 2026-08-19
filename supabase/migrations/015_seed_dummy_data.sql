-- ============================================
-- Reach International — Migration 015
-- Comprehensive Idempotent Seed Script with Realistic Test Data
-- ============================================

-- 1. BRANCHES MASTER
INSERT INTO public.branches (code, name, city, state, address, phone, email, status) VALUES
  ('DEL-HQ', 'Delhi HQ Main Branch', 'Delhi', 'Delhi', 'Plot 45 GIDC, Okhla Industrial Area Phase III', '+91 98765 43210', 'delhi@reachinternational.com', 'active'),
  ('GGN-01', 'Gurgaon Branch', 'Gurgaon', 'Haryana', 'Sector 18, Electronic City, Gurgaon', '+91 98765 43211', 'gurgaon@reachinternational.com', 'active'),
  ('MUM-01', 'Mumbai West Branch', 'Mumbai', 'Maharashtra', 'Andheri East Industrial Estate, Mumbai', '+91 98765 43212', 'mumbai@reachinternational.com', 'active'),
  ('BLR-01', 'Bengaluru Tech Hub Branch', 'Bengaluru', 'Karnataka', 'Peenya Industrial Area Phase II, Bengaluru', '+91 98765 43213', 'bangalore@reachinternational.com', 'active')
ON CONFLICT (code) DO NOTHING;

-- 2. MANUFACTURERS
INSERT INTO public.manufacturers (name, country) VALUES
  ('JCB', 'United Kingdom'),
  ('Genie', 'United States'),
  ('ACE', 'India'),
  ('Hyundai', 'South Korea'),
  ('Toyota', 'Japan'),
  ('Godrej', 'India')
ON CONFLICT (name) DO NOTHING;

-- 3. MACHINE CATEGORIES
INSERT INTO public.machine_categories (name, description) VALUES
  ('Forklift', 'Material handling equipment for lifting and moving heavy loads'),
  ('Scissor Lift', 'Aerial work platform with crossing scissor mechanism'),
  ('Boom Lift', 'Articulated or telescopic aerial work platform'),
  ('Reach Truck', 'Narrow aisle warehouse electric forklift'),
  ('Pallet Truck', 'Manual or electric pallet jack equipment'),
  ('Generators', 'Industrial diesel power generators')
ON CONFLICT (name) DO NOTHING;

-- 4. VENDORS
INSERT INTO public.vendors (code, vendor_name, contact_person, email, phone, gstin, city, state, category, rating, status) VALUES
  ('VND-001', 'Apex Hydraulics & Spares Ltd', 'Ramesh Verma', 'sales@apexhydraulics.com', '+91 98111 22233', '07AAACA1234A1Z1', 'Delhi', 'Delhi', 'Hydraulics', 4.8, 'active'),
  ('VND-002', 'Metro Diesel Parts & Filters Co', 'Karan Malhotra', 'orders@metrodiesel.com', '+91 98222 33344', '06BBBDB5678B1Z2', 'Gurgaon', 'Haryana', 'Filters & Engine', 4.6, 'active'),
  ('VND-003', 'National Bearings & Seals India', 'Sunil Mehta', 'info@nationalseals.in', '+91 98333 44455', '07CCCEC9012C1Z3', 'Delhi', 'Delhi', 'Seals & Bearings', 4.9, 'active'),
  ('VND-004', 'Genie OEM Spares India Pvt Ltd', 'Pooja Sundaram', 'spares@genieindia.com', '+91 98444 55566', '29EEEEF7890E1Z5', 'Bengaluru', 'Karnataka', 'OEM Aerial Parts', 5.0, 'active')
ON CONFLICT (code) DO NOTHING;

-- 5. INVENTORY PRODUCTS (PART MASTER)
INSERT INTO public.inventory_products (
  part_number, name, category, manufacturer, unit, unit_cost, min_stock_level, reorder_level, reorder_quantity, max_stock_level, oem_part_number, rack_number, shelf_number, bin_number, warehouse_zone, part_type, criticality, status
) VALUES
  ('HYD-FLT-001', 'Hydraulic Oil Filter', 'Filters', 'JCB', 'Pcs', 1250, 10, 10, 20, 100, 'JCB-32/925346', 'R-01', 'S-01', 'B-01', 'ZONE-A', 'spare', 'high', 'active'),
  ('ENG-FLT-002', 'Engine Oil Filter', 'Filters', 'JCB', 'Pcs', 850, 15, 15, 30, 150, 'JCB-02/100073', 'R-01', 'S-02', 'B-02', 'ZONE-A', 'consumable', 'normal', 'active'),
  ('AIR-FLT-003', 'Air Cleaner Element', 'Filters', 'Caterpillar', 'Pcs', 2100, 5, 5, 15, 50, 'ACE-AF-902', 'R-02', 'S-01', 'B-01', 'ZONE-A', 'spare', 'normal', 'active'),
  ('HYD-SEAL-01', 'Hydraulic Cylinder Seal Kit', 'Seals', 'Hyundai', 'Set', 3400, 8, 8, 15, 40, 'HYU-31Y1-15200', 'R-02', 'S-03', 'B-04', 'ZONE-B', 'assembly', 'critical', 'active'),
  ('ORING-KIT-01', 'High Pressure O-Ring Set', 'Seals', 'JCB', 'Box', 950, 20, 20, 50, 200, 'JCB-993/99500', 'R-03', 'S-01', 'B-01', 'ZONE-B', 'consumable', 'normal', 'active')
ON CONFLICT (part_number) DO NOTHING;

-- 6. SYSTEM SETTINGS
INSERT INTO public.system_settings (id, daily_run_time, default_service_interval_days, email_from_name)
VALUES ('00000000-0000-0000-0000-000000000001', '08:00', 90, 'Reach International')
ON CONFLICT (id) DO NOTHING;

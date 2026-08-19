-- Migration 016: Add and populate Manufacturer column in inventory_products
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS manufacturer TEXT;

-- Backfill manufacturer data for default parts if null
UPDATE public.inventory_products
SET manufacturer = CASE
  WHEN part_number LIKE 'HYD-FLT%' THEN 'JCB'
  WHEN part_number LIKE 'ENG-FLT%' THEN 'JCB'
  WHEN part_number LIKE 'AIR-FLT%' THEN 'Caterpillar'
  WHEN part_number LIKE 'HYD-SEAL%' THEN 'Hyundai'
  WHEN part_number LIKE 'ORING%' THEN 'JCB'
  WHEN category = 'Filters' THEN 'JCB'
  WHEN category = 'Seals' THEN 'Hyundai'
  WHEN category = 'Hydraulic' THEN 'Caterpillar'
  WHEN category = 'Electrical' THEN 'Volvo'
  ELSE 'Komatsu'
END
WHERE manufacturer IS NULL;

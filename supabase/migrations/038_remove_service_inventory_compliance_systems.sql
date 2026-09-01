-- ==============================================================================
-- Migration 038: Remove Service, Inventory, and Compliance/Expiry Systems
-- Monorepo Database Clean-up: Drop service_count from public.machines and
-- remove any remaining legacy service/inventory/compliance tables.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Drop service_count column from public.machines if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'machines'
      AND column_name = 'service_count'
  ) THEN
    ALTER TABLE public.machines DROP COLUMN service_count CASCADE;
  END IF;

  -- 2. Drop any remaining service/compliance/inventory columns from public.machines if present
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'service_interval_days') THEN
    ALTER TABLE public.machines DROP COLUMN service_interval_days CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'last_service_date') THEN
    ALTER TABLE public.machines DROP COLUMN last_service_date CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'next_service_due_date') THEN
    ALTER TABLE public.machines DROP COLUMN next_service_due_date CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'insurance_policy_no') THEN
    ALTER TABLE public.machines DROP COLUMN insurance_policy_no CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'insurance_expiry_date') THEN
    ALTER TABLE public.machines DROP COLUMN insurance_expiry_date CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'third_party_certificate') THEN
    ALTER TABLE public.machines DROP COLUMN third_party_certificate CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'third_party_expiry_date') THEN
    ALTER TABLE public.machines DROP COLUMN third_party_expiry_date CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'rto_tax') THEN
    ALTER TABLE public.machines DROP COLUMN rto_tax CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'rto_tax_expiry_date') THEN
    ALTER TABLE public.machines DROP COLUMN rto_tax_expiry_date CASCADE;
  END IF;

  -- 3. Idempotently drop any legacy tables if they exist
  DROP TABLE IF EXISTS public.service_records CASCADE;
  DROP TABLE IF EXISTS public.machine_complaints CASCADE;
  DROP TABLE IF EXISTS public.complaints CASCADE;
  DROP TABLE IF EXISTS public.engineer_service_summaries CASCADE;
  DROP TABLE IF EXISTS public.inventory_stock_ledger CASCADE;
  DROP TABLE IF EXISTS public.inventory_part_issues CASCADE;
  DROP TABLE IF EXISTS public.inventory_part_issue_items CASCADE;
  DROP TABLE IF EXISTS public.inventory_part_returns CASCADE;
  DROP TABLE IF EXISTS public.inventory_part_return_items CASCADE;
  DROP TABLE IF EXISTS public.inventory_stock CASCADE;
  DROP TABLE IF EXISTS public.inventory_storage_locations CASCADE;
  DROP TABLE IF EXISTS public.inventory_goods_receipts CASCADE;
  DROP TABLE IF EXISTS public.inventory_goods_receipt_items CASCADE;
  DROP TABLE IF EXISTS public.inventory_purchase_requests CASCADE;
  DROP TABLE IF EXISTS public.inventory_purchase_request_items CASCADE;
  DROP TABLE IF EXISTS public.purchase_orders CASCADE;
  DROP TABLE IF EXISTS public.inventory_purchase_order_items CASCADE;
  DROP TABLE IF EXISTS public.inventory_products CASCADE;
  DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
  DROP TABLE IF EXISTS public.stock_transfers CASCADE;
  DROP TABLE IF EXISTS public.challans CASCADE;
  DROP TABLE IF EXISTS public.inventory_delivery_challan_items CASCADE;
END $$;

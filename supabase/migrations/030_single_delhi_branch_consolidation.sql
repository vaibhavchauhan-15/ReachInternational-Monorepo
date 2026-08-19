-- Migration: 030_single_delhi_branch_consolidation.sql
-- Description: Consolidate all company operations into a single branch (Delhi Branch), reassigning all users, employees, machines, stock, and operational records.

DO $$
DECLARE
  v_delhi_branch_id UUID;
BEGIN
  -- 1. Ensure Delhi Branch (DEL-HQ) exists
  INSERT INTO public.branches (code, name, city, state, address, phone, email, status)
  VALUES ('DEL-HQ', 'Delhi Branch', 'Delhi', 'Delhi', 'Plot 45 GIDC, Okhla Industrial Area Phase III', '+91 98765 43210', 'delhi@reachinternational.com', 'active')
  ON CONFLICT (code) DO UPDATE 
    SET name = 'Delhi Branch', city = 'Delhi', state = 'Delhi', status = 'active';

  SELECT id INTO v_delhi_branch_id FROM public.branches WHERE code = 'DEL-HQ' LIMIT 1;

  -- 2. Reassign all users to Delhi Branch
  UPDATE public.users
  SET branch_id = v_delhi_branch_id;

  -- 3. Reassign user_branches mapping
  DELETE FROM public.user_branches WHERE branch_id != v_delhi_branch_id;
  
  INSERT INTO public.user_branches (user_id, branch_id)
  SELECT id, v_delhi_branch_id FROM public.users
  ON CONFLICT (user_id, branch_id) DO NOTHING;

  -- 4. Reassign all employees to Delhi Branch
  UPDATE public.employees
  SET branch_id = v_delhi_branch_id,
      employee_code = REPLACE(REPLACE(REPLACE(employee_code, 'EMP-GGN-', 'EMP-DEL-0'), 'EMP-MUM-', 'EMP-DEL-0'), 'EMP-BLR-', 'EMP-DEL-0');

  -- 5. Reassign all machines to Delhi Branch
  UPDATE public.machines
  SET branch_id = v_delhi_branch_id;

  -- 6. Reassign storage locations to Delhi Branch
  UPDATE public.inventory_storage_locations
  SET branch_id = v_delhi_branch_id;

  -- 7. Consolidate inventory_stock to Delhi Branch
  UPDATE public.inventory_stock
  SET branch_id = v_delhi_branch_id;

  -- Deduplicate inventory_stock if multiple entries exist for same product_id + branch_id
  WITH stock_totals AS (
    SELECT product_id, SUM(quantity) as total_qty, (ARRAY_AGG(id))[1] as keep_id
    FROM public.inventory_stock
    WHERE branch_id = v_delhi_branch_id
    GROUP BY product_id
  )
  UPDATE public.inventory_stock s
  SET quantity = t.total_qty
  FROM stock_totals t
  WHERE s.id = t.keep_id;

  DELETE FROM public.inventory_stock s
  WHERE s.branch_id = v_delhi_branch_id
    AND s.id NOT IN (
      SELECT (ARRAY_AGG(id))[1] FROM public.inventory_stock WHERE branch_id = v_delhi_branch_id GROUP BY product_id
    );

  -- 8. Reassign purchase requests, POs, goods receipts, and part issues
  UPDATE public.inventory_purchase_requests SET branch_id = v_delhi_branch_id WHERE branch_id IS NOT NULL;
  UPDATE public.purchase_orders SET branch_id = v_delhi_branch_id WHERE branch_id IS NOT NULL;
  UPDATE public.inventory_goods_receipts SET branch_id = v_delhi_branch_id WHERE branch_id IS NOT NULL;
  UPDATE public.inventory_part_issues SET branch_id = v_delhi_branch_id WHERE branch_id IS NOT NULL;

  -- 9. Reassign challans
  UPDATE public.challans SET from_branch_id = v_delhi_branch_id WHERE from_branch_id IS NOT NULL;

  -- 10. Clear inter-branch stock transfers
  DELETE FROM public.stock_transfers;

  -- 11. Delete all non-Delhi branches
  DELETE FROM public.branches WHERE id != v_delhi_branch_id;

  RAISE NOTICE 'Successfully consolidated all operations into single Delhi Branch (%)', v_delhi_branch_id;
END $$;

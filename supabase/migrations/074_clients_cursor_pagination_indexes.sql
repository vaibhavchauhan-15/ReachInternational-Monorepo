-- ==============================================================================
-- Migration 074: Client Directory Keyset & Cursor Pagination Optimization
-- 1. Composite B-tree index on (company_name ASC, id ASC) for standard sorting cursor seeks
-- 2. Partial composite index on (company_name ASC, id ASC) for active clients cursor seeks
-- 3. Composite B-tree index on (status, company_name ASC, id ASC) for status-filtered cursor seeks
-- 4. Composite B-tree index on (created_at DESC, id DESC) for newest-first cursor seeks
-- 5. Composite B-tree index on (code ASC, id ASC) for client code cursor seeks
-- ==============================================================================

-- 1. Standard cursor index (company_name ASC, id ASC)
CREATE INDEX IF NOT EXISTS idx_clients_cursor_company_name 
  ON public.clients (company_name ASC, id ASC);

-- 2. Active clients cursor index
CREATE INDEX IF NOT EXISTS idx_clients_cursor_active 
  ON public.clients (company_name ASC, id ASC) 
  WHERE status = 'active' AND deleted_at IS NULL;

-- 3. Status-filtered cursor index
CREATE INDEX IF NOT EXISTS idx_clients_cursor_status 
  ON public.clients (status, company_name ASC, id ASC);

-- 4. Newest-first cursor index
CREATE INDEX IF NOT EXISTS idx_clients_cursor_created_desc 
  ON public.clients (created_at DESC, id DESC);

-- 5. Code cursor index
CREATE INDEX IF NOT EXISTS idx_clients_cursor_code 
  ON public.clients (code ASC, id ASC);

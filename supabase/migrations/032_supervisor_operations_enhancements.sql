-- Migration: 032_supervisor_operations_enhancements.sql
-- Description: Create site movement tracking and operator payout/salary tables for Supervisor Operations.

CREATE TABLE IF NOT EXISTS public.machine_site_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  site_address TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('loading_dispatch', 'unloading_arrival', 'relocation')),
  transport_vehicle_no TEXT,
  operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  movement_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_transit', 'completed', 'cancelled')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  period_month TEXT NOT NULL,
  total_running_hours NUMERIC(10,2) DEFAULT 0,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowance NUMERIC(12,2) DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  net_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'processing', 'paid')),
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.machine_site_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_movements_authenticated_read" ON public.machine_site_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "site_movements_authenticated_write" ON public.machine_site_movements
  FOR ALL TO authenticated USING (true);

CREATE POLICY "operator_payouts_authenticated_read" ON public.operator_payouts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "operator_payouts_authenticated_write" ON public.operator_payouts
  FOR ALL TO authenticated USING (true);

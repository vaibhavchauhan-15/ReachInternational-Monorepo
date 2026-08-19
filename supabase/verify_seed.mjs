import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...vals] = trimmed.split('=');
            if (key && vals.length > 0) {
              process.env[key.trim()] = vals.join('=').trim();
            }
          }
        });
      }
    } catch (err) {}
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verify() {
  console.log('🔍 VERIFYING SEEDED DATABASE TABLES...\n');

  const tables = [
    'users',
    'branches',
    'roles',
    'permissions',
    'role_permissions',
    'user_branches',
    'employees',
    'manufacturers',
    'machine_categories',
    'machine_models',
    'machines',
    'machine_assignments',
    'machine_hour_logs',
    'machine_complaints',
    'service_records',
    'notifications',
    'vendors',
    'inventory_products',
    'inventory_storage_locations',
    'inventory_stock',
    'inventory_purchase_requests',
    'inventory_purchase_request_items',
    'purchase_orders',
    'inventory_purchase_order_items',
    'inventory_goods_receipts',
    'inventory_goods_receipt_items',
    'inventory_part_issues',
    'inventory_part_issue_items',
    'challans',
    'inventory_delivery_challan_items',
    'import_batches',
    'audit_logs',
    'system_settings',
    'rental_customers',
    'rental_requests',
    'rental_agreements',
    'rental_delivery_challans',
    'rental_return_inspections',
    'rental_damage_reports',
    'rental_extension_requests',
    'rental_billing_requests',
    'rental_accessories_log',
    'finance_invoices',
    'finance_invoice_items',
    'finance_payments',
    'finance_credit_debit_notes',
    'finance_expense_categories',
    'finance_expenses',
    'finance_3way_matching_reviews',
    'finance_vendor_payments',
    'finance_receivable_followups',
    'finance_settings',
  ];

  for (const tbl of tables) {
    const { count, error } = await admin.from(tbl).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${tbl.padEnd(35)} Error: ${error.message}`);
    } else {
      console.log(`✅ ${tbl.padEnd(35)} Row Count: ${count}`);
    }
  }
}

verify();

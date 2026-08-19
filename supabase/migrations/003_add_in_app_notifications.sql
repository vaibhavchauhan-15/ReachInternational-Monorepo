-- Update notifications table to support In-App notifications and expand alert types

-- Drop existing constraints
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_alert_type_check;

-- Add new constraints
ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check 
  CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app'));

ALTER TABLE public.notifications ADD CONSTRAINT notifications_alert_type_check 
  CHECK (alert_type IN (
    'today', 
    'tomorrow', 
    'overdue', 
    'new_machine', 
    'machine_updated', 
    'machine_deleted', 
    'excel_import', 
    'system_error', 
    'reminder_failed', 
    'daily_summary', 
    'weekly_report', 
    'monthly_report'
  ));

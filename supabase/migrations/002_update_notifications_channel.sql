-- Update notifications table to support both WhatsApp and SMS channels
-- This migration updates the channel CHECK constraint

-- Drop the existing CHECK constraint on channel column
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;

-- Add new CHECK constraint that allows both whatsapp and sms
ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check 
  CHECK (channel IN ('whatsapp', 'sms'));
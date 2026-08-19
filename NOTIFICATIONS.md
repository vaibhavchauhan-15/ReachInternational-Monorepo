# Notification System Setup Guide

## Overview
ServiceCentric uses a multi-channel notification system:
- **Email**: SendGrid (consolidated daily summaries, auth emails)
- **WhatsApp**: Twilio (immediate action alerts for engineers and admins)
- **In-App**: Dashboard notifications

## Prerequisites
- Twilio account with WhatsApp and SMS capabilities
- SendGrid account for email delivery
- Upstash QStash account for scheduled cron jobs

## Environment Variables

### Twilio (WhatsApp & SMS)
```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+91xxxxxxxxxx
TWILIO_SMS_NUMBER=+91xxxxxxxxxx
```

### SendGrid (Email)
```env
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_from_email@example.com
SENDGRID_FROM_NAME=ServiceCentric
```

## Database Migration

Run the migration to update the notifications table:
```bash
# Apply migration via Supabase CLI
supabase migration up

# Or run SQL directly in Supabase SQL Editor
supabase/migrations/002_update_notifications_channel.sql
```

## Notification Matrix

| Event                  | In-App | Email | WhatsApp |
| ---------------------- | :----: | :---: | :------: |
| Login OTP              |    ❌   |   ✅   |     ❌    |
| Email Verification     |    ❌   |   ✅   |     ❌    |
| Forgot Password        |    ❌   |   ✅   |     ❌    |
| New Machine Added      |    ✅   |   ❌   |     ❌    |
| Machine Updated        |    ✅   |   ❌   |     ❌    |
| Machine Deleted        |    ✅   |   ❌   |     ❌    |
| Excel Import Completed |    ✅   |   ✅   |     ❌    |
| Daily Summary          |    ✅   |   ✅   |     ✅    |
| Today's Due Service    |    ✅   |   ❌   |     ✅    |
| Tomorrow Due Service   |    ✅   |   ❌   |     ✅    |
| Overdue Machines       |    ✅   |   ❌   |     ✅    |
| Manual Reminder        |    ❌   |   ❌   |     ✅    |
| Reminder Failed        |    ✅   |   ✅   |     ❌    |
| Weekly Report          |    ✅   |   ✅   |     ❌    |
| Monthly Report         |    ✅   |   ✅   |     ❌    |
| System Error           |    ✅   |   ✅   |     ❌    |

## Set Up QStash Cron Job

### 1. Install Upstash QStash CLI
```bash
pnpm add -g @upstash/qstash-cli
```

### 2. Configure QStash
```bash
# Login to QStash
qstash login

# Set your QStash token
export QSTASH_TOKEN=your_qstash_token_here
```

### 3. Schedule Daily Reminders
Schedule the cron job to run daily at 8:00 AM:
```bash
qstash schedule \
  --url "https://your-domain.com/api/cron/send-reminders" \
  --cron "0 8 * * *" \
  --method POST
```

### Alternative: Using Upstash Console
1. Go to [Upstash Console](https://console.upstash.com/qstash)
2. Navigate to **Schedules**
3. Create new schedule:
   - **URL**: `https://your-domain.com/api/cron/send-reminders`
   - **Cron**: `0 8 * * *` (daily at 8:00 AM)
   - **Method**: POST

## Email Templates

### Daily Summary Email
**Subject**: ServiceCentric - Daily Service Summary (03 Aug 2026)

**Content**:
- Today's due count
- Tomorrow's due count
- Overdue count
- Breakdown by engineer
- Machine details table
- Link to dashboard

### WhatsApp Messages

#### Service Due Today
```
🔔 *Service Due Today*

Machine *ABC123* (Machine Name) is scheduled for service today.

Customer: John Doe
Mobile: +919876543210
Due Date: 2026-03-04
Assigned Engineer: Jane Smith

Please ensure timely service completion.
```

#### Service Due Tomorrow
```
📅 *Service Due Tomorrow*

Machine *ABC123* (Machine Name) is scheduled for service tomorrow.

Customer: John Doe
Mobile: +919876543210
Due Date: 2026-03-05
Assigned Engineer: Jane Smith

Please ensure timely service completion.
```

#### Service Overdue
```
⚠️ *Service Overdue (3 days)*

Machine *ABC123* (Machine Name) service is overdue. Please attend immediately.

Customer: John Doe
Mobile: +919876543210
Due Date: 2026-03-01
Assigned Engineer: Jane Smith

Please ensure timely service completion.
```

#### Daily Summary (WhatsApp)
```
📊 *Daily Service Summary* - 2026-03-04

Today: 5 services
Tomorrow: 3 services
Overdue: 2 machines

Details:
• ABC123 - Today
• XYZ789 - Tomorrow
• DEF456 - Overdue (3d)

Please check the dashboard for more details.
```

## Testing

### 1. Test Locally
Start your development server:
```bash
pnpm dev
```

Trigger the cron endpoint manually:
```bash
curl -X POST http://localhost:3000/api/cron/send-reminders
```

### 2. Test in Production
```bash
curl -X POST https://your-domain.com/api/cron/send-reminders
```

## Manual Reminder
Admins can send reminders manually via the admin dashboard:
1. Go to **Notifications** page
2. Find the notification you want to resend
3. Click **Resend** button

## Monitoring

### Check Notification Logs
```sql
-- View recent notifications
SELECT 
  n.id,
  n.alert_type,
  n.status,
  n.channel,
  n.sent_at,
  m.machine_code,
  u.full_name as recipient
FROM notifications n
JOIN machines m ON n.machine_id = m.id
LEFT JOIN users u ON n.recipient_id = u.id
ORDER BY n.created_at DESC
LIMIT 50;
```

### Check Failed Notifications
```sql
SELECT 
  n.id,
  n.error_message,
  n.retry_count,
  m.machine_code,
  m.customer_mobile
FROM notifications n
JOIN machines m ON n.machine_id = m.id
WHERE n.status = 'failed'
ORDER BY n.created_at DESC;
```

### Check Email Delivery (SendGrid)
- Log in to [SendGrid Dashboard](https://app.sendgrid.com/)
- Navigate to **Email Activity** to see sent emails
- Check **Stats** for delivery rates

### Check WhatsApp Delivery (Twilio)
- Log in to [Twilio Console](https://console.twilio.com/)
- Navigate to **Messaging** > **Try it Out** > **Send a WhatsApp message**
- Check **Monitor** > **Logs** for delivery status

## Troubleshooting

### Common Issues

1. **WhatsApp messages not sending**
   - Ensure your Twilio WhatsApp number is properly configured
   - Check that you've joined the Twilio WhatsApp sandbox (for testing)
   - Verify the recipient's WhatsApp number is valid

2. **Email not sending**
   - Verify SENDGRID_API_KEY is correct
   - Check that sender email is verified in SendGrid
   - Review SendGrid suppression lists

3. **Authentication errors**
   - Verify all credentials are set correctly
   - Check that credentials are set in production environment

4. **Cron not triggering**
   - Verify QStash is properly configured
   - Check that your endpoint is publicly accessible
   - Review QStash logs in the console

## Security Notes
- Never commit `.env` file to version control
- Rotate Twilio and SendGrid credentials regularly
- Use QStash signature verification in production
- Monitor notification logs for suspicious activity

## Cost Considerations
- **WhatsApp**: ~$0.005-0.07 per message (varies by country)
- **SMS**: ~$0.0079-0.50 per message (varies by country)
- **SendGrid**: Free tier (100 emails/day), then ~$0.10 per 1,000 emails
- **QStash**: Free tier available, then ~$0.20 per million requests

Monitor your usage in the Twilio, SendGrid, and QStash dashboards.
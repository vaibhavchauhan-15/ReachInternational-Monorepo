# Incident: External Notification & Messaging Degradation (SendGrid, Twilio, QStash)

## Purpose
This runbook guides on-call engineers through diagnosing, mitigating, and recovering from third-party notification outages, credential revocations, delivery failures, or cron scheduler desynchronization affecting SendGrid, Twilio, and Upstash QStash.

## Impact
- **Systems Affected**: SendGrid (`@sendgrid/mail`), Twilio SMS & WhatsApp APIs, Upstash QStash (`@upstash/qstash`), `public.notifications` database table.
- **User Impact**: Dispatchers, field engineers, and customers do not receive automated shift completion emails, machine breakdown notifications, or SMS/WhatsApp alerts.
- **Operational Impact**: **Zero downtime for core fleet operations.** Machine logging, breakdown creation, and shift tracking continue without interruption because notification dispatches are decoupled and asynchronous.

## Symptoms
- **SendGrid Rejections in Vercel Server Logs**:
  ```text
  [EMAIL] Non-2xx from SendGrid (401 / 403 / 429) for recipient@example.com
  or:
  [EMAIL] sendEmailWithTracking error: SENDGRID_FROM_EMAIL is not configured
  ```
- **Twilio API Errors in Server Logs or Twilio Debugger**:
  ```text
  Twilio Error 21211: Invalid 'To' Phone Number
  Twilio Error 63016: WhatsApp message failed — outside 24-hr customer service window / template unapproved
  Twilio Error 20003: Authentication Error / Account Suspended (Zero Balance)
  ```
- **Failed Notification Queue Accumulation**:
  ```sql
  SELECT count(*) FROM public.notifications WHERE status = 'failed' AND created_at > now() - interval '24 hours';
  ```
- **QStash Scheduled Cron Failures**:
  Daily summary cron (`0 8 * * *`) fails to execute or responds with HTTP 401:
  ```text
  HTTP 401: Invalid CRON_SECRET or missing QStash cryptographic signature
  ```

## Severity
**P2 (Medium)** — Core operational workflows remain functional; communication channels are degraded.

## Immediate Actions
1. **Confirm Core Operations Are Unblocked (< 2 min)** `[SAFE AUTOMATION]`:
   Verify the public application and database remain responsive:
   ```bash
   curl -s "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Expected: HTTP 200 with `status: "ok"` and `db: "healthy"`.*
2. **Check Upstream Service Status Pages (< 3 min)** `[SAFE AUTOMATION]`:
   - [SendGrid Status](https://status.sendgrid.com/)
   - [Twilio Status](https://status.twilio.com/)
   - [Upstash Status](https://status.upstash.com/)
3. **Notify Customer Support & Dispatch Operations (< 5 min)**:
   Inform the dispatch desk that automated notifications are delayed and alerts are being queued in the database.

## Diagnosis
1. **Query Database for Failure Distribution** `[SAFE AUTOMATION]`:
   Execute in Supabase SQL Editor to pinpoint which provider or alert type is failing:
   ```sql
   SELECT 
     channel,
     alert_type,
     status,
     error_message,
     COUNT(*) as failure_count,
     MAX(created_at) as latest_failure
   FROM public.notifications
   WHERE status = 'failed'
     AND created_at > now() - interval '48 hours'
   GROUP BY channel, alert_type, status, error_message
   ORDER BY failure_count DESC;
   ```
2. **Verify SendGrid API Key Validity** `[SAFE AUTOMATION]`:
   ```bash
   curl -i -X GET "https://api.sendgrid.com/v3/scopes" \
     -H "Authorization: Bearer <SENDGRID_API_KEY>"
   ```
   - HTTP 401: API key was deleted, rotated, or revoked.
   - HTTP 403: Account suspended due to billing or compliance freeze.
   - HTTP 200: SendGrid API is functional; verify `SENDGRID_FROM_EMAIL` is a verified sender domain.
3. **Check Twilio Balance & Account Status** `[SAFE AUTOMATION]`:
   ```bash
   curl -i -X GET "https://api.twilio.com/2010-04-01/Accounts/<TWILIO_ACCOUNT_SID>/Balance.json" \
     -u "<TWILIO_ACCOUNT_SID>:<TWILIO_AUTH_TOKEN>"
   ```
   - Verify balance is positive and currency balance is active.
4. **Test QStash Cron Route Authentication** `[SAFE AUTOMATION]`:
   ```bash
   curl -i -X POST "https://www.reachinternational.co.in/api/cron/send-reminders" \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
   - HTTP 200 OK: Route is working; issue is with QStash schedule configuration.
   - HTTP 401 Unauthorized: `CRON_SECRET` in Vercel environment variables does not match the token passed by QStash.

## Recovery
1. **Rotate or Update SendGrid API Key in Vercel** `[REQUIRES HUMAN APPROVAL]`:
   - Generate a new API Key with **Full Access (Mail Send)** in the [SendGrid Console](https://app.sendgrid.com/).
   - In Vercel Project Settings -> **Environment Variables**, update `SENDGRID_API_KEY` and verify `SENDGRID_FROM_EMAIL`.
   - Trigger a redeployment to push the updated environment variables to serverless runtimes.
2. **Restore Twilio Service** `[REQUIRES HUMAN APPROVAL]`:
   - Add funds to Twilio balance or update credit card on file.
   - For WhatsApp template issues, submit updated template in Twilio WhatsApp Sender portal.
3. **Reschedule or Re-arm QStash Cron** `[REQUIRES HUMAN APPROVAL]`:
   If the schedule was deleted or stalled in QStash, reconfigure it via the [Upstash Console](https://console.upstash.com/qstash) -> **Schedules**:
   - **Destination URL**: `https://www.reachinternational.co.in/api/cron/send-reminders`
   - **Cron Expression**: `0 8 * * *` (Daily 08:00 UTC)
   - **HTTP Header**: `Authorization: Bearer <CRON_SECRET>`
   - **Method**: `POST`
   
   Or configure directly via the verified Upstash REST API:
   ```bash
   curl -X POST "https://qstash.upstash.io/v2/schedules/https://www.reachinternational.co.in/api/cron/send-reminders" \
     -H "Authorization: Bearer <QSTASH_TOKEN>" \
     -H "Upstash-Cron: 0 8 * * *" \
     -H "Upstash-Forward-Authorization: Bearer <CRON_SECRET>"
   ```
4. **Replay Queued / Failed Notifications** `[REQUIRES HUMAN APPROVAL]`:
   Once third-party API access is verified healthy, replay failed notifications:
   ```sql
   UPDATE public.notifications
   SET 
     status = 'pending',
     retry_count = 0,
     error_message = NULL
   WHERE status = 'failed'
     AND created_at > now() - interval '24 hours';
   ```

## Validation
1. **Verify SendGrid Delivery**:
   Trigger a test password reset from `https://www.reachinternational.co.in/forgot-password`.
   Check SendGrid Activity Feed for delivery confirmation (`status: 202 Accepted`).
2. **Verify Database Notification Status**:
   ```sql
   SELECT status, count(*) 
   FROM public.notifications 
   WHERE created_at > now() - interval '1 hour' 
   GROUP BY status;
   ```
   *Pass Condition: `status = 'sent'` count increments; zero new rows in `status = 'failed'`.*
3. **Verify QStash Execution Logs**:
   In Upstash Console -> **Logs**, confirm the last scheduled invocation returned HTTP 200.

## Rollback
- **Outbound Notifications**: No verified rollback mechanism found. Outbound emails, SMS messages, and WhatsApp messages sent to external recipients cannot be retracted.
- **Failed Retry Reversion**: If replaying failed notifications overwhelms rate limits, pause replay by executing:
  ```sql
  UPDATE public.notifications
  SET status = 'failed'
  WHERE status = 'pending'
    AND error_message IS NULL;
  ```

## Escalation
- Escalate to Lead Backend Engineer if SendGrid or Twilio accounts are suspended due to compliance flags.
- Escalate to Finance if billing payment methods failed and need corporate card reauthorization.

## Do Not
- **DO NOT** block core business operations (machine shifts, breakdowns, customer updates) when notification delivery fails.
- **DO NOT** delete or truncate `public.notifications` records to clear error backlogs; this destroys the compliance audit trail.
- **DO NOT** commit raw API keys (`SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, `CRON_SECRET`) to Git.
- **DO NOT** attempt a mass replay of older than 48-hour notifications without consulting dispatch operations, as stale notifications confuse recipients.

## Root Cause Follow-Up
- Configure automated balance refill thresholds in Twilio Console.
- Set up SendGrid alert notifications for credit consumption (>80% quota).
- Record remediation details in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('NOTIFICATION_OUTAGE_RESOLVED', 'system', 'MEDIUM', '{"provider": "sendgrid_twilio", "replayed": true}', now());
  ```
- File incident entry in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).

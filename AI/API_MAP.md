# API & Server Actions Map — ServiceCentric

## Server Actions (`app/actions/*`)

### Auth Actions (`app/actions/auth.ts`)
- `login(formData)`: Validates credentials via Supabase SSR, redirects to `/dashboard`.
- `signup(formData)`: Registers new user profile, sets default role.
- `logout()`: Clears auth cookies, redirects to `/login`.
- `resetPassword(email)`: Triggers Supabase password reset email.

### Machine Actions (`app/actions/machines.ts`)
- `createMachine(data)`: Validates inputs via Zod, creates machine record, writes audit log.
- `updateMachine(id, data)`: Modifies machine details/status.
- `deleteMachine(id)`: Removes machine record (Admin/Manager only).

### Service Actions (`app/actions/services.ts`)
- `createServiceLog(data)`: Logs scheduled/completed service for machine.
- `updateServiceStatus(id, status)`: Transitions service state (`scheduled` -> `completed`).

### Notification Actions (`app/actions/notifications.ts`, `send-reminders.ts`, `manual-reminder.ts`)
- `sendManualReminder(machineId)`: Immediately dispatches email/SMS notification to client.
- `triggerScheduledReminders()`: Batch checks upcoming machine service dates and queues reminders.

### User Actions (`app/actions/users.ts`)
- `updateUserRole(userId, role)`: Elevated action for role assignments.
- `updateUserProfile(userId, data)`: Updates profile information.

## API & Cron Endpoints (`app/api/*`)

### `GET /api/cron/send-reminders`
- **File**: `app/api/cron/send-reminders/route.ts`
- **Security**: Validates `CRON_SECRET` header or QStash token.
- **Function**: Executes daily scheduled machine service reminders.

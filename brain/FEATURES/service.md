# Feature Module — Machine Services & Maintenance Logs

## Overview
Tracks scheduled, in-progress, completed, and cancelled service logs for machines, including technician notes, service types, and replaced parts.

## File Map
- **Page**: `app/(app)/services/page.tsx`
- **Components**: `components/services/ServicesClient.tsx`
- **Actions**: `app/actions/services.ts`
- **Queries**: `lib/queries/services.ts`

## Key Functions & Workflows
- `getServiceLogs()`: Retrieves maintenance logs for assigned machines.
- `createServiceLog()`: Records a new maintenance event.
- `updateServiceStatus()`: Updates log status and updates machine's next service date upon completion.

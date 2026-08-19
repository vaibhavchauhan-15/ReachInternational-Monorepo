# Security Rules — ServiceCentric

1. **Role-Based Access Control (RBAC)**: Verify user session role (`admin`, `service_manager`, `engineer`, `client`) before rendering restricted pages or executing elevated Server Actions.
2. **Supabase Row Level Security (RLS)**: Enforce RLS policies on all tables (`machines`, `service_logs`, `notifications`, `profiles`). Never bypass RLS in standard queries.
3. **Audit Logging**: Every mutation (create/edit/delete machine, update service, change role) must log to `audit_logs` using `lib/audit.ts`.
4. **Input Sanitization**: Validate all client payloads using `zod` schemas before executing database mutations.
5. **Secret Protection**: Keep `SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, and `QSTASH_TOKEN` strictly server-side.

# Architectural Decision Records (ADRs) — ServiceCentric

## ADR-001: Next.js 16 App Router over Pages Router
- **Status**: Accepted
- **Context**: Need standard React Server Components, streaming UI loading, nested layouts, and server actions.
- **Decision**: Adopt Next.js 16 App Router with route groups (`app/(app)`).

## ADR-002: Supabase SSR & PostgreSQL RLS
- **Status**: Accepted
- **Context**: Require real-time auth cookie handling across middleware, server components, and client components while guaranteeing database-level security isolation.
- **Decision**: Utilize `@supabase/ssr` with RLS policies enabled on all PostgreSQL tables.

## ADR-003: High-Performance Analytics via Database RPCs
- **Status**: Accepted
- **Context**: Dashboard required aggregating stats across 5+ tables (machines, services, notifications, logs). Running sequential client-side queries was inefficient.
- **Decision**: Created `004_dashboard_rpc.sql` function to execute single-pass SQL metrics calculation.

## ADR-004: Multi-Channel Dispatch Strategy (SendGrid + Twilio + QStash)
- **Status**: Accepted
- **Context**: Needed automated reminders via Email, SMS, WhatsApp, and scheduled cron execution without managing a persistent worker server.
- **Decision**: Use SendGrid API for Email, Twilio API for SMS/WhatsApp, and Upstash QStash for cron trigger calls to `/api/cron/send-reminders`.

## ADR-005: AI Persistent Project Memory System
- **Status**: Accepted
- **Context**: AI agents spent 30-60% of context scanning the codebase on every new chat session.
- **Decision**: Implemented `AI/` knowledge base folder with `PROJECT_MEMORY.md`, `FILE_INDEX.md`, `STATE.md`, etc., and updated `AGENTS.md` to force context-selective reading.

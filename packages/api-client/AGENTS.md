# API Client Package Rules — `packages/api-client`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/api-client` provides shared API client utilities and Supabase client configuration helpers.

## Rules

- Client configuration must support both Web (SSR) and Mobile (client-side) patterns.
- **NEVER** include the service role key in client-accessible exports.
- **NEVER** import from `apps/*`.
- Export through canonical barrel `index.ts`.

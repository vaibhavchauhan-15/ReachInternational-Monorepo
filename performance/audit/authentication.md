# Authentication Architecture Audit (Phase 1)

> **SCOPE**: Session management, cookie parsing, Supabase SSR Auth, and profile synchronization across Web and Mobile.

---

## 1. Authentication Execution Flow

```text
Incoming HTTP Request
  ├── 1. Edge Proxy (proxy.ts)
  │      └── Validates auth session cookie (< 4ms). Redirects unauthenticated users to /login.
  ├── 2. Root App Layout ((app)/layout.tsx)
  │      └── Calls verifySession() in lib/dal.ts to assert valid session.
  ├── 3. Data Access Layer (lib/dal.ts)
  │      └── getCachedUserRow(userId): Retrieves public.users profile (Role, Status, Location)
  │          wrapped in React cache() under key dal-user-row-v6.
  └── 4. Page / Server Actions
         └── Checks user.role and status (active, pending, inactive).
```

---

## 2. Authentication Call Sites Audit

| File | Function / Hook | Purpose | Deduplicated? | Latency Impact | Priority |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `apps/web/proxy.ts` | `createClient(request)` | Edge session cookie validation | Yes (Edge) | 2.6 ms – 4.3 ms | 🟢 P3 |
| `apps/web/lib/dal.ts` | `verifySession()` | Server-side session verification | **Yes** (`cache()`) | 0.08 ms (In-memory) | 🟢 P3 |
| `apps/web/lib/dal.ts` | `getCachedUserRow()` | User profile & status lookup | **Yes** (`cache()`) | 0.14 ms – 0.48 ms | 🟢 P3 |
| `apps/web/app/actions/auth.ts` | `login()`, `signup()`, `logout()` | Authentication mutations | N/A (Mutations) | 150 ms – 300 ms | 🟢 P3 |
| `apps/mobile/lib/auth/useAuth.tsx` | `useAuth()` hook | Mobile session & profile state | Yes (React Context + SecureStore) | Instant local read | 🟢 P3 |

---

## 3. Major Authentication Findings

1. **Zero Redundant Session Queries in Single Request**: `verifySession()` and `getCachedUserRow()` are wrapped in React `cache()`. Even if multiple Server Components call `getCurrentUser()`, Supabase is queried only once per HTTP request.
2. **Fail-Safe Redirect Loop Protection**: `proxy.ts` and `(app)/layout.tsx` pass explicit error search parameters (`/login?error=profile_not_found`, `/login?error=account_inactive`) to prevent infinite redirect loops.
3. **Hardened Credentials**: No hardcoded API keys or anon tokens exist in client source files. All auth clients validate environment variables at initialization.

# ReachInternational — Current Dependencies & Environment Audit

> **Phase 0 Deliverable**  
> **Last Updated:** 2026-08-19  
> **Status:** Verified & Baseline Established  

---

## 1. Package Manager & Workspace Baseline

- **Current Package Manager**: `pnpm` with `pnpm-lock.yaml` (`npm` is strictly prohibited and removed).
- **Workspace Architecture**: `pnpm` workspace with Turborepo monorepo orchestration (`apps/web`, `apps/mobile`, `packages/types`, `packages/validation`, `packages/permissions`, `packages/design-tokens`, `packages/api-client`, `packages/config`, `packages/utils`).

---

## 2. Core Runtime & Language Specs

| Component / Runtime | Version / Specification | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | Runtime environment |
| **Next.js** | `16.2.12` | Web Framework (App Router, RSC, Server Actions) |
| **React** | `19.2.4` | Component Library & UI state |
| **React DOM** | `19.2.4` | DOM Renderer |
| **TypeScript** | `^5.0.0` | Strict Mode Type Safety |

---

## 3. Production Dependencies Inventory

```json
{
  "@base-ui/react": "^1.6.0",
  "@radix-ui/react-dialog": "^1.1.23",
  "@radix-ui/react-tooltip": "^1.2.16",
  "@sendgrid/mail": "^8.1.6",
  "@supabase/ssr": "^0.12.4",
  "@supabase/supabase-js": "^2.111.0",
  "@upstash/qstash": "^2.11.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "framer-motion": "^12.43.0",
  "lucide-react": "^1.28.0",
  "next": "16.2.12",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "recharts": "^3.10.1",
  "shadcn": "^4.16.1",
  "tailwind-merge": "^3.6.0",
  "tw-animate-css": "^1.4.0",
  "twilio": "^6.0.2",
  "xlsx": "^0.18.5",
  "zod": "^4.4.3"
}
```

### Dependency Categorization by Domain

#### 3.1 UI, Styling & Animation
- **`@base-ui/react`**: Modern unstyled UI components for popovers, selects, and dropdowns.
- **`@radix-ui/react-dialog` & `@radix-ui/react-tooltip`**: Accessible modal dialogs and tooltips.
- **`class-variance-authority` & `clsx` & `tailwind-merge`**: Utility class composition for variant-based UI primitives (`components/ui/*`).
- **`framer-motion`**: Micro-animations for modal transitions, tab switching, and card entry effects.
- **`lucide-react`**: Universal icon library for enterprise navigation and operational metrics.
- **`recharts`**: Data visualization graphs for financial trends, machine uptime, and KPI analytics.
- **`tw-animate-css`**: Utility animation presets for Tailwind CSS v4.

#### 3.2 Backend, Data Access & Auth
- **`@supabase/ssr`**: Server-side rendering cookie handling and auth session synchronization.
- **`@supabase/supabase-js`**: Canonical Postgres DB client, Auth client, Storage client, and Realtime subscriptions.
- **`zod`**: Schema validation for form payloads, Server Action input parameters, and API request contracts.

#### 3.3 Integrations & Third-Party Services
- **`@sendgrid/mail`**: Automated email dispatch for breakdown notifications, daily summaries, and system alerts.
- **`twilio`**: SMS and WhatsApp notification delivery to field managers and operators.
- **`@upstash/qstash`**: Serverless message queue and scheduled cron job trigger engine (`/api/cron/send-reminders`).
- **`xlsx`**: Client-side and server-side CSV/Excel spreadsheet generation for machine directories and financial reports.

---

## 4. Development Dependencies Inventory

```json
{
  "@tailwindcss/postcss": "^4",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "agentation": "^3.0.2",
  "eslint": "^9",
  "eslint-config-next": "16.2.12",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

---

## 5. Environment Variables Audit & Secret Protection Rules

### 5.1 Public Client Configuration (Safe for Web Client & Mobile App)
These keys are safe to expose to browser environments and mobile client application bundles:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<key>
```

### 5.2 Server-Only Secrets (STRICTLY RESTRICTED)
> [!CAUTION]
> **Secret Protection Mandate**: These keys MUST NEVER be placed in the mobile application package, client-side code, or exposed via browser network bundles. They may only be accessed inside Server Actions, API routes, or server-side DAL functions.

```env
SUPABASE_SECRET_KEY=eyJhbGci...          # Service-Role Key (Bypasses RLS - Server Only)
TWILIO_ACCOUNT_SID=AC...                 # Twilio Auth SID
TWILIO_AUTH_TOKEN=d9...                  # Twilio Secret Auth Token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1...   # Sender Number
TWILIO_SMS_NUMBER=+1...                  # Sender Number
TWILIO_CONTENT_SID=HX...                 # Template SID
SENDGRID_API_KEY=SG...                   # SendGrid Master API Key
SENDGRID_FROM_EMAIL=...                  # Verified Sender Email
SENDGRID_FROM_NAME=ReachInternational        # Sender Display Name
```

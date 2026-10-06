# Design Tokens Package Rules — `packages/design-tokens`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)

---

## Purpose

`@reachinternational/design-tokens` provides the **Vercel Geist Design System** tokens shared between Web (Tailwind CSS) and Mobile (React Native StyleSheet).

## Canonical Tokens

| Token | Value | Usage |
|---|---|---|
| Ink (text) | `#171717` | Primary text color |
| Canvas (background) | `#fafafa` | Page background |
| Elevated (card) | `#ffffff` | Card/modal background |
| Border | `#ebebeb` | 1px hairline borders |
| Primary Blue | `#0284c7` / `#0ea5e9` | Reach Sky Blue primary actions & links |
| Fonts | Geist Sans / Geist Mono | Typography |

## Rules

- All color, spacing, typography, and shadow values used across apps MUST reference tokens from this package.
- **NEVER** hardcode design values in app code — import from this package.
- **NEVER** import from `apps/*`.
- When the design system evolves, update tokens here and propagate to both Web and Mobile.

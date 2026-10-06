# ReachInternational Design System Documentation — `docs/DESIGN_SYSTEM.md`

> Reference specification for Vercel Geist design tokens, colors, typography scales, spacing, border radii, and 100% Web & Native consistency.

For the binding authoritative policy, see [DESIGN.md](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/DESIGN.md) and [AI/RULES/DESIGN-SYSTEM.md](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/AI/RULES/DESIGN-SYSTEM.md).

---

## 1. Core Visual Tokens

### Colors
- **Foundation**:
  - Ink: `#171717` (light) / `#fafafa` (dark)
  - Canvas: `#fafafa` (light) / `#0a0a0a` (dark)
  - Canvas Elevated: `#ffffff` (light) / `#171717` (dark)
  - Hairline: `#ebebeb` (light) / `#262626` (dark)
  - Hairline Soft: `#f2f2f2` (light) / `#1a1a1a` (dark)
- **Brand & Interactive**:
  - Primary / Reach Sky Blue: `#0284c7` (light) / `#0ea5e9` (dark)
  - Link / Vercel Blue: `#0070f3` (light) / `#3b82f6` (dark)
  - Link Deep: `#0761d1` (light) / `#2563eb` (dark)
  - Link Soft: `#d3e5ff` (light) / `#1e3a8a` (dark)
- **Semantic Status**:
  - Success: `#10b981` (soft `#ecfdf5`) / `#34d399` (dark)
  - Warning: `#f5a623` (soft `#ffefcf`) / `#fbbf24` (dark)
  - Error: `#ee0000` (soft `#fef2f2`) / `#f87171` (dark)
  - Info: `#3b82f6` (soft `#eff6ff`) / `#60a5fa` (dark)
  - Pending: `#f59e0b` (soft `#fffbeb`) / `#fbbf24` (dark)
  - Overdue: `#e11d48` (soft `#fff1f2`) / `#fb7185` (dark)

### Typography
- **Fonts**: Geist Sans (UI & body) and Geist Mono (technical, codes, eyebrows).
- **Scale**: Display XL (48px, -2.4px tracking), Heading LG (32px, -1.28px), Heading MD (20px, -0.4px), Label SM (14px, -0.28px), Mono Eyebrow (12px uppercase), Body LG (16px), Body MD (14px), Body SM (12px), Code (14px).
- **Mobile Variants**: `display` (28px), `title` (20px), `heading` (16px), `subheading` (14px), `body` (14px), `label` (13px), `caption` (12px), `mono` (13px). All rendered via `<Text variant="...">`.

### Spacing & Radius
- **Base Grid**: 4px base scale (4px, 8px, 12px, 16px, 24px, 32px, 40px, 64px, 96px, 128px).
- **Bimodal Radius**: 6px (`rounded-sm`) for app chrome, inputs, buttons; 12px/16px for cards/dialogs; 64px for SegmentedToggle tabs; 100px for marketing CTAs; 9999px for badges and avatars.

---

## 2. 100% Web & Native Consistency Mandate
Web and Native Mobile are two interfaces for **one single product**:
- Identical colors, status tokens, typography weights, and icons.
- Desktop web displays high-density tables; mobile views reflow into touch cards (≥44px touch targets).

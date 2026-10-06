# ReachInternational Design System Specification — `DESIGN.md`

> **PRIMARY AND AUTHORITATIVE SOURCE OF TRUTH FOR THE VISUAL DESIGN OF REACHINTERNATIONAL**  
> *This specification defines the complete visual language, design tokens, color palette, typography hierarchy, component styling, dark/light theme systems, and responsive layout standards for both Web (`apps/web`) and Native Mobile (`apps/mobile`) applications. Every developer and AI coding agent MUST follow this specification without deviation.*

---

## 1. Design Philosophy — The Vercel Geist System

ReachInternational's visual identity is built upon the **Vercel Geist System** — an exercise in deliberate subtraction, technical precision, high data density, and an engineered developer-and-enterprise aesthetic.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             VERCEL GEIST PHILOSOPHY                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ • Ink & Canvas Duet: Stark contrast between ink (#171717) and canvas (#fafafa).  │
│ • Near-Zero Chromatic Chrome: Color is strictly reserved for semantic signals,   │
│   status indicators, and the brand sky blue accent (#0284c7 / #0ea5e9).          │
│ • Bimodal Radius Language: 6px tight square corners for app & operational chrome │
│   vs. 100px full pills for marketing CTAs and 64px for category tabs.            │
│ • Display Typography: Geist Sans with tight negative letter-tracking (-2.4px).   │
│ • Technical Eyebrows: Geist Mono uppercase labels (12px, weight 500) for metadata│
│ • Crisp Hairline Surfaces: 1px border (#ebebeb) on elevated white cards (#ffffff)│
│ • 100% Cross-Platform Parity: Web and Native App look like ONE unified product.   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Color System

All colors are centrally declared in `@reachinternational/design-tokens` and mapped to CSS variables in `apps/web/app/globals.css`. Hardcoding raw or arbitrary hex codes is strictly prohibited.

### 2.1 Foundation Colors (Ink & Canvas)

| Token Name | CSS Variable | Light Theme | Dark Theme | Role / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `ink` | `--color-ink` | `#171717` | `#fafafa` | Primary headings, high-emphasis text, brand logo, active icon fills |
| `canvas` | `--color-canvas` | `#fafafa` | `#0a0a0a` | Default page background / canvas surface |
| `canvasElevated` | `--color-canvas-elevated` | `#ffffff` | `#171717` | Cards, modal sheets, dropdowns, input containers |
| `hairline` | `--color-hairline` | `#ebebeb` | `#262626` | 1px hairline border on cards, inputs, tables, dividers |
| `hairlineSoft` | `--color-hairline-soft` | `#f2f2f2` | `#1a1a1a` | Alternating rows, subtle inset wells, subtle divider fills |

### 2.2 Text Hierarchy Ladder

| Token Name | CSS Variable | Light Theme | Dark Theme | Role / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `ink` | `--color-ink` | `#171717` | `#fafafa` | Primary headings (H1, H2, H3), bold titles |
| `body` | `--color-body` | `#4d4d4d` | `#a3a3a3` | Standard paragraph text, form field values, nav links |
| `mute` | `--color-mute` | `#8f8f8f` | `#737373` | Subtitles, timestamps, table column headers, metadata |
| `faint` | `--color-faint` | `#a1a1a1` | `#525252` | Placeholders, disabled text, inactive borders |

### 2.3 Brand & Interactive Accents

| Token Name | CSS Variable | Light Theme | Dark Theme | Role / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `primary` | `--color-primary` | `#0284c7` | `#0ea5e9` | Reach Sky Blue — Primary buttons, active states, key CTAs |
| `onPrimary` | `--color-on-primary` | `#ffffff` | `#ffffff` | Text / icons on top of primary button fills |
| `link` | `--color-link` | `#0070f3` | `#3b82f6` | Vercel Blue — Text links, focus rings, active indicator pills |
| `linkDeep` | `--color-link-deep` | `#0761d1` | `#2563eb` | Hover / pressed state for links and interactive blue buttons |
| `linkSoft` | `--color-link-soft` | `#d3e5ff` | `#1e3a8a` | Light blue background tint for active tabs and selection pills |

### 2.4 Semantic Operational Status Colors

Semantic status colors communicate operational health across machinery, shifts, logs, attendance, and users:

| Status Role | Token | Light Fill | Light Deep | Light Soft Wash | Dark Fill | Dark Soft Wash | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Operational / Success** | `success` | `#10b981` | `#059669` | `#ecfdf5` | `#34d399` | `#064e3b` | Active equipment, approved logs, present, submitted |
| **Warning / Caution** | `warning` | `#f5a623` | `#ab570a` | `#ffefcf` | `#fbbf24` | `#78350f` | Due for service, pending review, partial shift |
| **Error / Breakdown** | `error` | `#ee0000` | `#c50000` | `#fef2f2` | `#f87171` | `#450a0a` | Machine breakdown, validation error, rejected, deleted |
| **Informational** | `info` | `#3b82f6` | `#2563eb` | `#eff6ff` | `#60a5fa` | `#1e3a8a` | Notice banners, client worksite badges, general telemetry |
| **Pending / Queue** | `pending` | `#f59e0b` | `#d97706` | `#fffbeb` | `#fbbf24` | `#78350f` | Shift log submission pending, awaiting assignment |
| **Overdue / Alert** | `overdue` | `#e11d48` | `#be123c` | `#fff1f2` | `#fb7185` | `#4c0519` | Service overdue, expired documents, shift conflict |

---

## 3. Typography System

The platform strictly uses **Geist Sans** (display, headings, body UI) and **Geist Mono** (code, machine codes, serial numbers, timestamps, technical eyebrows).

### 3.1 Font Family Declarations
- **Sans-serif (Primary)**: `Geist Sans`, `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- **Monospace (Technical)**: `Geist Mono`, `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.

### 3.2 Typography Scale & Tracking Hierarchy

| Preset Token | Font Family | Size | Weight | Line Height | Letter Spacing | Designated Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `display-xl` | Geist Sans | 48px | 600 (Semibold) | 48px | -2.4px | Marketing hero headlines, executive metrics |
| `heading-lg` | Geist Sans | 32px | 600 (Semibold) | 40px | -1.28px | Page titles, major section headers |
| `heading-md` | Geist Sans | 20px | 600 (Semibold) | 28px | -0.4px | Card titles, modal headers, subsection titles |
| `label-sm` | Geist Sans | 14px | 500 (Medium) | 20px | -0.28px | Button labels, form field labels, tab titles |
| `mono-eyebrow` | Geist Mono | 12px | 500 (Medium) | 16px | 0.5px (UPPERCASE) | Section category labels, technical badges, status tags |
| `body-lg` | Geist Sans | 16px | 400 (Regular) | 24px | 0px | Lead paragraph prose, modal descriptions |
| `body-md` | Geist Sans | 14px | 400 (Regular) | 20px | 0px | Standard body copy, table cell text, form values |
| `body-sm` | Geist Sans | 12px | 400 (Regular) | 16px | 0px | Captions, footnotes, secondary timestamps |
| `code` / `mono` | Geist Mono | 14px / 13px | 400 / 500 | 20px / 18px | 0px | Machine numbers (`#MCH-001`), HMR values, serial numbers |

### 3.3 Mobile Native Type Variants (`packages/design-tokens`)

To ensure flawless native rendering without raw style violations:

| Variant | Size | Line Height | Font Name | Native Icon Size |
| :--- | :--- | :--- | :--- | :--- |
| `display` | 28px | 34px | `Geist-Bold` | 28px |
| `title` | 20px | 26px | `Geist-SemiBold` | 22px |
| `heading` | 16px | 22px | `Geist-SemiBold` | 18px |
| `subheading` | 14px | 20px | `Geist-SemiBold` | 16px |
| `body` | 14px | 20px | `Geist-Regular` | 16px |
| `label` | 13px | 18px | `Geist-Medium` | 14px |
| `caption` | 12px | 16px | `Geist-Regular` | 12px |
| `mono` | 13px | 18px | `GeistMono-Medium` | 14px |

---

## 4. Spacing System (4px Base Unit)

All margins, paddings, and layout gaps adhere strictly to the **4px base grid**:

```text
Token       Value    Tailwind Class    Common Usage
────────────────────────────────────────────────────────────────────────────────────────
xxs         4px      p-1  / gap-1      Micro-spacing between badge dots & labels
xs          8px      p-2  / gap-2      Form field internal vertical padding, icon gaps
sm          12px     p-3  / gap-3      Card inner compact spacing, button horizontal pad
md          16px     p-4  / gap-4      Standard card padding, mobile screen page margin
lg          24px     p-6  / gap-6      Desktop section gap, large card padding
xl          32px     p-8  / gap-8      Section dividers, modal internal padding
2xl         40px     p-10 / gap-10     Major content chunk separation
3xl         64px     p-16 / gap-16     Hero section vertical padding
4xl         96px     p-24 / gap-24     Band separation
section     128px    p-32              Full marketing page breaks
```

**Rule**: Arbitrary non-standard pixel values (`11px`, `17px`, `23px`, `38px`) are strictly forbidden.

---

## 5. Border Radius System — Bimodal Language

ReachInternational employs a **bimodal border radius system** to visually distinguish application chrome from marketing CTAs:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          BIMODAL RADIUS ARCHITECTURE                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│  APP CONTROLS: Tight 6px Square (rounded-sm)                                     │
│  Used for: Nav buttons, text inputs, selects, table badges, dropdown items       │
│                                                                                  │
│  CARDS & MODALS: 12px / 16px Soft (rounded-md / rounded-lg)                      │
│  Used for: Operational cards, KPI widgets, dialog modals, bottom sheets          │
│                                                                                  │
│  CATEGORY FILTER TABS: 64px Capsule (rounded-full / rounded-[64px])              │
│  Used for: SegmentedToggle ("Log Entry" vs "Log History")                        │
│                                                                                  │
│  MARKETING CTAs: 100px Pill (rounded-full)                                       │
│  Used for: Public hero marketing buttons ("Get Started", "Book a Demo")          │
│                                                                                  │
│  CIRCULAR ACTIONS: 9999px (rounded-full)                                         │
│  Used for: User avatars, 36px icon action buttons, live status dots              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Elevation & Depth System

Visual depth is achieved through **crisp 1px hairline borders** rather than heavy drop shadows:

- **Level 0 (Flat — Default)**: 1px hairline (`border border-[var(--color-hairline)]`), zero shadow. Used for default cards, table cells, form inputs.
- **Level 1 (Whisper)**: 1px hairline + micro shadow (`shadow-[0px_1px_2px_rgba(0,0,0,0.04)]`). Used for raised cards on hover or interactive touch cards.
- **Level 2 (Floating)**: Layered low-alpha shadow (`shadow-[0px_4px_12px_-2px_rgba(0,0,0,0.06)]`) + 1px hairline. Used for dropdown menus, modal dialogs, command palettes, bottom sheets.

**Strictly Forbidden**: Heavy dark drop shadows (`rgba(0,0,0,0.4)`), colorful glows, or 3D gradient bevels.

---

## 7. Canonical Component Specifications

### 7.1 Buttons
1. **Primary Button (`button-primary`)**:
   - Background: Reach Sky Blue `#0284c7` (`var(--color-primary)`), Text: `#ffffff` (`var(--color-on-primary)`).
   - Radius: `6px` (`rounded-sm`), Height: 36px / 40px, Font: Geist Sans 500 (Medium).
   - Hover / Active: `#0369a1` (Web) / `scale: 0.98` + `Haptics.selectionAsync()` (Native).
2. **Secondary / Ghost Button (`button-ghost`)**:
   - Background: `#ffffff` (`var(--color-canvas-elevated)`), Text: `#171717` (`var(--color-ink)`).
   - Border: 1px hairline `#ebebeb` (`var(--color-hairline)`), Radius: `6px` (`rounded-sm`).
3. **Segmented Toggle (`SegmentedToggle`)**:
   - Outer container: `#f4f4f5` (light) / `rgba(255,255,255,0.06)` (dark), 1px hairline.
   - Sliding Pill: `#ffffff` (light) / `#27272a` (dark), 1px hairline, whisper shadow.
   - Active text: `#0284c7` / `#0070f3`, Inactive text: `#52525b` / `#a1a1aa`.
   - Motion: Reanimated spring `{ damping: 28, stiffness: 350, mass: 0.75 }`.
4. **Circular Icon Action Button**:
   - 36px × 36px circular button (`rounded-full`), 1px hairline border, Lucide icon centered, min 44px touch area.

### 7.2 Inputs & Form Fields
- Background: `#ffffff` (light) / `#171717` (dark).
- Border: 1px solid `#ebebeb` (light) / `#262626` (dark), Radius: `6px` (`rounded-sm`).
- Height: 40px, Padding: `px-3 py-2`.
- Focus State: Border transitions to `#0284c7` / `#0070f3` with subtle focus glow.
- Web reset on native inputs: `outlineStyle: 'none'`.

### 7.3 Data Tables (`EnterpriseTable.tsx` & Mobile Touch Cards)
- Desktop Table (`hidden sm:block`):
  - Header: Geist Mono 12px uppercase, text `#8f8f8f`, background `#fafafa`, height 40px.
  - Rows: Geist Sans 14px, border-bottom 1px hairline, height 48px/56px, hover background `#fafafa`.
- Mobile Reflow (`block sm:hidden`):
  - Reflows into stacked touch cards with min 44px tap targets, status badge on top right, monospace identifier, and inline attribution metadata.

---

## 8. Responsive 3-Tier Viewport Protocol

Every view and component must adapt seamlessly across three distinct viewport tiers:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            3-TIER VIEWPORT SYSTEM                                │
├─────────────────────────┬─────────────────────────┬──────────────────────────────┤
│    MOBILE (≤ 640px)     │   TABLET (641-1023px)   │      DESKTOP (≥ 1024px)      │
├─────────────────────────┼─────────────────────────┼──────────────────────────────┤
│ • Touch Card Reflow     │ • 2-Column Grid Layout  │ • High-Density Data Tables   │
│   (block sm:hidden)     │   (grid-cols-2)         │   (hidden sm:block)          │
│ • Floating Bottom Nav   │ • Fluid Modal Panels    │ • Collapsible Fixed Sidebar  │
│   (56px bar + safe-area)│   (sm:max-w-xl)         │   (256px / 64px width)       │
│ • Horizontal Scroll Bar │ • Condensed Toolbars    │ • Multi-Column KPI Grid      │
│   (overflow-x-auto)     │                         │   (grid-cols-3/4)            │
│ • Bottom Sheet Modals   │                         │ • Hover Tooltips             │
│ • Touch Target ≥ 44px   │                         │                              │
└─────────────────────────┴─────────────────────────┴──────────────────────────────┘
```

---

## 9. 100% Web & Native App Consistency Contract

Web and Native Mobile are two interfaces for **one single product**:

1. **Color Parity**: Exact same hex color values and theme tokens. If a status badge is emerald on Web (`#10b981` / `#ecfdf5`), it MUST be emerald on Native.
2. **Typography Parity**: Exact same Geist Sans / Geist Mono typography, relative weights, line heights, and negative display trackings.
3. **Icon Parity**: Exact same Lucide icon glyphs (`lucide-react` on Web, `lucide-react-native` on Mobile).
4. **Layout & Terminology Parity**: Exact same page titles, button labels, validation messages, modal flows, and role-based permissions.
5. **Architectural Specialization**:
   - Web leverages React Server Components (RSC), Next.js App Router, Server Actions, and SSR Auth.
   - Native leverages React Native primitives, Expo Router, TanStack Query, SecureStore, and offline-first queue syncing.

---

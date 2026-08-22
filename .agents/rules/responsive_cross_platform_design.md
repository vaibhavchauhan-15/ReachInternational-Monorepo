# AI Agent Rule: Cross-Platform Responsive Design & Strict DESIGN.md Adherence

## Objective
Every page, component, module, and UI/UX element developed across the ReachInternational web (`apps/web`) and mobile (`apps/mobile`) applications MUST be strictly optimized for **Mobile (≤640px)**, **Tablet (641px–1023px)**, and **Desktop (≥1024px)** viewports.

All implementations MUST maintain 100% visual identity, theme, color scheme, typography, component identity, and operational logic consistency across all screen sizes by strictly adhering to the Vercel Geist design specification in `DESIGN.md` and the shared design token system (`@reachinternational/design-tokens`).

---

## 1. Single Source of Truth — DESIGN.md & Shared Tokens

Before creating or modifying any UI component or page layout, the AI agent MUST strictly follow the design system tokens defined in `DESIGN.md`:

### Color Palette (Geist Theme)
- **Ink / Primary Text**: `#171717` (`var(--color-ink)`, `colors.ink`) — Headings, primary CTA fills, borders, high-emphasis text.
- **Canvas / Page Background**: `#fafafa` (`var(--color-canvas)`, `colors.canvas`) — Default clean page background.
- **Canvas Elevated / Cards**: `#ffffff` (`var(--color-canvas-elevated)`, `colors.canvas-elevated`) — Modals, popovers, input fills, card surfaces.
- **Hairline Border**: `#ebebeb` (`var(--color-hairline)`, `colors.hairline`) — 1px crisp structural borders on all cards, inputs, dividers, and tables.
- **Body Text**: `#4d4d4d` (`var(--color-body)`, `colors.body`) — Standard paragraph and secondary text.
- **Mute Text**: `#8f8f8f` (`var(--color-mute)`, `colors.mute`) — Subtitle labels, captions, metadata.
- **Primary Brand Link**: `#0070f3` (`var(--color-link)`, `colors.link`) — Primary active links, brand accents, focus rings.
- **Semantics**: Error (`#ee0000`), Warning (`#f5a623`), Success (`#0070f3`).

### Typography Hierarchy (Geist Sans & Geist Mono)
- **Display XL**: 48px / weight 600 / tracking -2.4px (Hero headlines).
- **Heading LG**: 32px / weight 600 / tracking -1.28px (Major page section headers).
- **Heading MD**: 20px / weight 600 / tracking -0.4px (Card headers, modal titles).
- **Label SM**: 14px / weight 500 / tracking -0.28px (Form field labels, primary buttons).
- **Mono Eyebrow**: 12px / weight 500 / uppercase (Geist Mono section eyebrows).
- **Body LG / MD / SM**: 16px / 14px / 12px (Prose, table cells, helper text).
- **Code**: 14px / Geist Mono (Code blocks, machine codes `#MCH-001`, serial numbers).

### Radius Scale
- `none` (0px): Full-bleed bands, dividers.
- `sm` (6px): App buttons, text inputs, selects, dropdowns, table badges.
- `md` (12px): Feature cards, form containers, dialog cards.
- `lg` (16px): Large modal panels, drawer containers.
- `pill-category` (64px): Segmented switcher pills, category tab filters.
- `pill` (100px): Marketing call-to-action buttons.
- `full` (9999px): Circular icon action buttons, user avatars.

---

## 2. Three-Tier Viewport Responsiveness Protocol

AI agents MUST build every page, component, and module with explicit breakpoint support for all three screen categories:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIEWPORT RESPONSIVENESS                          │
├────────────────────────┬────────────────────────┬───────────────────────┤
│    MOBILE (≤ 640px)    │   TABLET (641-1023px)   │   DESKTOP (≥ 1024px)  │
├────────────────────────┼────────────────────────┼───────────────────────┤
│ • Touch Card View      │ • 2-Column Grid Reflow │ • High-Density Table  │
│ • Scroll Filter Bar    │ • Adaptive Modals      │ • Fixed Sidebar Nav   │
│ • Bottom Sheet Dialogs │ • Condensed Toolbars   │ • Hover Tooltips      │
│ • Min 44px Touch Target│ • Collapsible Drawers  │ • Multi-Col Dashboards│
└────────────────────────┴────────────────────────┴───────────────────────┘
```

### Tier A — Mobile Viewport (≤ 640px)
1. **Data Table Reflow to Touch Cards**:
   - High-density data tables MUST automatically reflow into a touch-friendly Card View on mobile screens using Tailwind responsive utilities:
     ```tsx
     {/* Desktop Data Table */}
     <div className="hidden sm:block">
       <EnterpriseTable ... />
     </div>
     {/* Mobile Touch Card View */}
     <div className="block sm:hidden space-y-3">
       {items.map((item) => (
         <div key={item.id} className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-md space-y-2">
           {/* Touch-friendly card content */}
         </div>
       ))}
     </div>
     ```
2. **Horizontally Scrollable Toolbars & Filters**:
   - Filter pill strips, date period selectors, and action toolbars MUST enable smooth touch horizontal scrolling to prevent layout clipping or text wrapping:
     ```tsx
     <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar flex-nowrap pb-1">
       {/* Filter Pills */}
     </div>
     ```
3. **Viewport-Aware Modals & Dialogs**:
   - Modal containers on mobile MUST include screen height clamping and scrolling to avoid overflow clipping:
     ```tsx
     className="w-full max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg p-4 sm:p-6"
     ```
4. **Touch Target Clearance**:
   - Interactive buttons, dropdown triggers, and checkbox controls MUST maintain a minimum 44px touch target or `py-2.5 px-4` hit area.

### Tier B — Tablet Viewport (641px – 1023px)
1. **2-Column Grid Reflow**:
   - Form field rows, metric cards, and feature blocks MUST reflow smoothly from 1-column to 2-column configurations:
     ```tsx
     className="grid grid-cols-1 sm:grid-cols-2 gap-4"
     ```
2. **Adaptive Drawer & Modal Sizing**:
   - Modals and detail drawers MUST use fluid sizing:
     ```tsx
     className="w-full sm:max-w-xl md:max-w-2xl"
     ```
3. **Responsive Header Action Strips**:
   - Primary actions stay visible; secondary action buttons collapse into icon-only buttons with tooltips or popover dropdowns.

### Tier C — Desktop Viewport (≥ 1024px / 1200px)
1. **Multi-Column Dashboard Layouts**:
   - Full 3-column or 4-column high-density layout (`grid-cols-3` / `grid-cols-4`, `w-full space-y-6`).
2. **High-Density Enterprise Tables**:
   - Renders full `<EnterpriseTable>` with Geist Mono headers, column sorting, column density toggles, search input, and multi-filter dropdowns.
3. **Hover Micro-Interactions & Rich Tooltips**:
   - All desktop icon-only action buttons (Edit, Delete, View, Verify) MUST be wrapped with `<TooltipWrapper>` popovers:
     ```tsx
     <TooltipWrapper content="Edit Machine Log">
       <button className="h-7 w-7 flex items-center justify-center rounded-sm border border-[var(--color-hairline)]">
         <Edit className="w-3.5 h-3.5" />
       </button>
     </TooltipWrapper>
     ```

---

## 3. Strict Layout & Overflow Rules

1. **Single Scroll Container Standard**:
   - Every page view and modal dialog MUST have exactly **ONE** primary scroll container (`flex-1 overflow-y-auto min-h-0`).
   - **PROHIBITED**: Nested inner scroll containers that create double scrollbars inside form bodies or comment threads.
2. **Zero Horizontal Body Overflow**:
   - The root body and layout containers MUST enforce `overflow-x-hidden w-full` to prevent unintentional horizontal page shifting on mobile devices.
3. **Pinned Headers & Footers**:
   - Modal action buttons (e.g. `Save`, `Cancel`) MUST remain pinned in the modal footer or header bar so form submission controls are always reachable regardless of scroll position.

---

## 4. Cross-Platform Visual & UX Consistency

Web (`apps/web`) and Mobile (`apps/mobile`) interfaces MUST feel like **one unified product**:

- **Identical Colors**: Shared semantic tokens from `@reachinternational/design-tokens`.
- **Identical Terminology**: Feature names, button text (`Submit Daily Log`), status tags (`Stored & Approved`), and error messages MUST match word-for-word.
- **Identical Icon Set**: Lucide Icons on Web, equivalent Lucide/Vector SVG icons on Mobile.
- **Identical Logic**: Business workflows, permission rules, and field validations MUST behave identically across all platforms.

---

## 5. Mandatory Verification Checklist for AI Agents

Before marking any UI task as completed, the AI agent MUST perform the following 5-point verification:

- [ ] **1. Design Token Compliance**: Inspected `DESIGN.md` to ensure colors (`#171717`, `#fafafa`, `#ebebeb`), Geist fonts, radius scale (`6px`/`12px`/`full`), and spacing scale are strictly respected.
- [ ] **2. Mobile Verification (≤640px)**: Verified high-density tables reflow into touch cards (`block sm:hidden`), filter bars scroll horizontally, modals clamp to viewport height, touch targets are ≥44px.
- [ ] **3. Tablet Verification (641px–1023px)**: Verified grid reflows to 2 columns, modals scale fluidly (`sm:max-w-xl`), action bars adapt cleanly without text clipping.
- [ ] **4. Desktop Verification (≥1024px)**: Verified full multi-column grid, high-density `<EnterpriseTable>`, sidebar navigation, icon tooltips (`<TooltipWrapper>`).
- [ ] **5. Zero Compilation Errors**: Executed `pnpm typecheck` or `pnpm --filter @reachinternational/web typecheck` with **0 TypeScript compilation errors**.

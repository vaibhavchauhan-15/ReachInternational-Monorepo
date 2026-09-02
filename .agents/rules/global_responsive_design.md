# Global Responsive Design Rule — MANDATORY

> **Scope**: This rule applies to EVERY change made to the project, no matter how small.
> **Priority**: HIGHEST — No AI agent may skip or partially apply this rule.
> **Enforced On**: All newly created or modified components, UI elements, pages, layouts, forms, modals, tables, cards, buttons, inputs, navigation, dialogs, dashboards, and features.

---

## Target Viewports

Every change MUST be fully responsive and optimized for:

| Tier            | Width Range   | Key Behaviors                                              |
| --------------- | ------------- | ---------------------------------------------------------- |
| **Mobile**      | 320–480px     | Single column, touch cards, bottom sheets, ≥44px targets   |
| **Tablet**      | 768–1024px    | 2-col grids, adaptive modals, condensed toolbars           |
| **Desktop**     | 1280px+       | Multi-col dashboards, high-density tables, hover tooltips  |
| **Large Desktop** | 1440px+     | Full-width utilization, max-width containers, dense grids  |

---

## 1. Every Change Must Be Responsive

- Never implement a UI change for only one screen size.
- Even tiny changes such as spacing, text, buttons, icons, inputs, or labels MUST be checked across mobile, tablet, desktop, and large desktop.
- A change that works on desktop but breaks on mobile is **NOT complete**.

## 2. Mobile-First Behavior

- Ensure the UI works properly on small screens (320px) **before** optimizing larger layouts.
- Prevent horizontal overflow, clipped content, overlapping elements, and broken layouts at all viewport widths.
- Use `min-w-0` on flex children to prevent overflow; avoid fixed pixel widths.

## 3. Adaptive Layouts

- Use responsive flex/grid layouts, Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`), wrapping, stacking, and sizing appropriately.
- Components MUST adapt naturally instead of relying on fixed widths/heights.
- Prefer `w-full`, `max-w-*`, `min-w-0`, and percentage-based sizing over hardcoded pixel values.
- Grids MUST reflow: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

## 4. Typography & Content

- Text MUST remain readable at every breakpoint.
- Prevent text clipping, unnecessary truncation, overflow, and overlapping.
- Long names, values, labels, and error messages MUST be handled gracefully with `truncate`, `break-words`, or `line-clamp-*` as appropriate.
- Responsive font sizing: use Tailwind responsive prefixes (`text-sm md:text-base lg:text-lg`) when content demands it.

## 5. Interactive Elements

- Buttons, inputs, dropdowns, tabs, menus, dialogs, and other controls MUST remain usable on touch devices.
- Maintain minimum **44px** touch-target sizes and adequate spacing on mobile.
- Never depend on `:hover` for essential functionality — hover is enhancement only.
- Use `focus-visible:` rings for keyboard accessibility.

## 6. Tables & Dense Content

- Tables MUST reflow to touch-friendly card views on mobile (`block sm:hidden` / `hidden sm:block` pattern).
- Cards, filters, toolbars, and dashboards MUST have a deliberate mobile/tablet layout.
- Do NOT allow desktop-width components to overflow the mobile screen.
- Horizontally scrollable containers (`overflow-x-auto`) are acceptable for truly tabular data, but card views are preferred on mobile.

## 7. Existing UI Must Not Regress

- Before and after every change, preserve existing responsive behavior.
- Do NOT fix one breakpoint by breaking another.
- If modifying a component, verify it still works at all four viewport tiers.

## 8. Reuse the Design System

- Use existing responsive components from `components/ui/*`, design tokens from `DESIGN.md` and `@reachinternational/design-tokens`, utilities from `lib/*`, and Tailwind breakpoints.
- Avoid creating duplicate responsive implementations.
- Follow the Vercel Geist design system tokens (colors, typography, radius, spacing) defined in `AI/RULES/DESIGN-SYSTEM.md`.

## 9. Verify Every Change — Mandatory Checklist

Before considering ANY task complete, the AI agent MUST verify the affected UI at these minimum viewport widths:

- [ ] **Mobile**: ~320–480px — Single column, touch cards, no horizontal overflow, ≥44px touch targets
- [ ] **Tablet**: ~768–1024px — 2-col grids, adaptive modals, no clipping
- [ ] **Desktop**: ~1280px+ — Multi-col layout, full tables, hover interactions
- [ ] **Large Desktop**: ~1440px+ — Proper max-width containment, no wasted space, dense grid utilization
- [ ] **No regressions** at any previously-working viewport

## 10. No Exceptions for Tiny Changes

This rule applies **even when changing only**:

- One button
- One text label
- One input
- One icon
- One margin/padding value
- One card
- One table column
- One modal
- One page section
- One API/action state that changes the UI
- One error message
- One tooltip
- One badge/status indicator

---

## Final Acceptance Gate

Before completing ANY implementation, every AI agent MUST ask:

> **"Does this change work correctly and look intentional on mobile, tablet, desktop, and large desktop?"**

If the answer is **NO**, the implementation is **NOT complete**.

**Responsive behavior is a mandatory acceptance criterion for every frontend change. No exceptions.**

---

## Relationship to Other Rules

This rule works in conjunction with and reinforces:
- `AI/RULES/DESIGN-SYSTEM.md` — Design token compliance
- `AI/RULES/UI-UX.md` — User experience standards
- `.agents/rules/responsive_cross_platform_design.md` — Three-tier viewport protocol with code patterns
- `.agents/rules/web_mobile_ui_consistency.md` — Web-to-mobile synchronization

In case of conflict, the **stricter** requirement always wins.

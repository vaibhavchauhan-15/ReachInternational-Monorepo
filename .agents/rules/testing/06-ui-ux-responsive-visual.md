# UI/UX, Responsive Design & Data Table Testing Standards

> **TESTING SPECIFICATIONS FOR RESPONSIVE VIEWPORTS, DESIGN TOKENS, DATA TABLES, AND VISUAL PARITY**  
> *ReachInternational interfaces must feel premium, meticulously aligned, and completely fluid across phone, tablet, and desktop viewports.*

---

## 1. Purpose

The purpose of ReachInternational's UI/UX, Responsive & Visual Testing standards is to eliminate **layout jumps, horizontal page overflow, clipped text, broken alignment, unreadable low-contrast badges, and sluggish data tables** across every supported screen resolution.

---

## 2. Applicable Applications & Packages

- `apps/web`: Responsive web layouts, Geist CSS design tokens, high-density data tables, and modals
- `apps/mobile`: Native touch cards, bottom sheets, filter strips, and Reanimated spring physics
- `packages/design-tokens`: Centralized color tokens, typography scales, spacing units, and radius tokens

---

## 3. Mandatory Viewports & Responsive Breakdown

Every page, modal, and responsive component MUST be audited across these 8 standard viewports:

```text
TIER 1: MOBILE VIEWPORTS (Touch Cards & Bottom Sheets)
  ├── 320 × 568   (Compact Phone / iPhone SE)   → Stress-tests text wrapping & minimal touch width
  ├── 360 × 800   (Standard Modern Android)     → Dominant field operator mobile resolution
  └── 390 × 844   (Standard iPhone 12/13/14)    → Dominant iOS mobile resolution

TIER 2: TABLET VIEWPORTS (2-Column Adaptive Grids)
  ├── 768 × 1024  (iPad Portrait / Tablet)      → Tests sidebar drawer collapse & 2-column card flow
  └── 1024 × 768  (iPad Landscape / Small Desk) → Tests navigation transition & split table views

TIER 3: DESKTOP VIEWPORTS (High-Density Tables & Panels)
  ├── 1280 × 800  (Standard Laptop Screen)      → Standard management and dispatch desktop resolution
  ├── 1440 × 900  (MacBook / Widescreen Laptop) → Baseline reference desktop canvas
  └── 1920 × 1080 (Full HD Monitor)             → High-density enterprise fleet monitoring canvas
```

---

## 4. Design System Invariants (`DESIGN.md`)

1. **Vercel Geist Hairline Borders**: Exactly `1px solid` border using `#ebebeb` in Light Mode and `#262626` in Dark Mode. Heavy or colorful 2px borders are forbidden.
2. **Brand Accent Consistency**: Reach Sky Blue (`#0284c7` Light / `#0ea5e9` Dark). Never invent arbitrary blues, cyans, or purples.
3. **Bimodal Corner Radius**:
   - `rounded-md` (`6px`): Standard for cards, inputs, tables, dropdowns, and app chrome.
   - `rounded-full` (`64px` / `100px`): Reserved exclusively for status pills, badge chips, and hero CTAs.
4. **Light & Dark Theme Parity**: Every screen and component must look equally polished and high-contrast in both Light mode (`#fafafa` canvas, `#ffffff` card, `#171717` ink) and Dark mode (`#0a0a0a` canvas, `#171717` card, `#fafafa` ink).
5. **Touch Ergonomics**: All interactive buttons, chips, and table row selectors must have a minimum touch target height of `44px` on mobile/touch viewports.

---

## 5. Comprehensive Data Table Testing Protocol

Data tables in `apps/web` (`/machines`, `/operations`, `/service`, `/finance`, `/hr`) require dedicated multi-viewport testing:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             DATA TABLE AUDIT MATRIX                              │
├──────────────────────┬─────────────────────────┬─────────────────────────────────┤
│ FEATURE              │ DESKTOP / TABLET        │ MOBILE (≤ 640px)                │
├──────────────────────┼─────────────────────────┼─────────────────────────────────┤
│ 1. Layout Mode       │ Multi-column table grid │ Card list (Never wide table)    │
│ 2. Sticky Header     │ Stays pinned on scroll  │ Sticky search & filter bar      │
│ 3. Multi-Sort        │ Column header clicks    │ Sort bottom sheet modal         │
│ 4. Filter Chips      │ Inline filter toolbar   │ Horizontal scrollable strip     │
│ 5. Search Input      │ Instant client/debounce │ Full-width search with clear (X)│
│ 6. Pagination        │ Page numbers + size sel │ "Load More" or Prev/Next buttons│
│ 7. Bulk Actions      │ Checkbox multi-select   │ Long-press / Selection mode     │
│ 8. Export Flow       │ CSV/XLSX download (xlsx)│ Direct file share or download   │
│ 9. Empty State       │ Centered EmptyState     │ Centered touch EmptyState       │
│ 10. Horizontal Scroll│ Isolated in container   │ Zero page-level horizontal blow │
└──────────────────────┴─────────────────────────┴─────────────────────────────────┘
```

---

## 6. Required Testing Approach

```text
[ RESIZE BROWSER TO TARGET VIEWPORT ]
  ├── Cycle through 320px → 360px → 768px → 1024px → 1440px
  └── Check for horizontal page scrollbars (window.scrollX must remain 0)

[ VISUAL & ELEMENT AUDIT ]
  ├── Inspect text truncation (ensure text wraps cleanly or uses ellipsis with tooltip)
  ├── Inspect badge rendering (ensure solid high-contrast backgrounds; no unreadable washes)
  └── Test Dark Mode toggle (ensure zero un-themed white flashes or unreadable dark-on-dark text)

[ DATA TABLE STRESS TEST ]
  ├── Load 100+ records to verify virtualization or pagination stability
  ├── Test sorting ascending and descending on numeric and date columns
  └── Trigger search filtering with matching and non-matching queries
```

---

## 7. Recommended Tools

- **Browser DevTools Device Mode**: Responsive emulation across iPhone SE, iPhone 14, iPad, and 1080p.
- **Node-based Style & Typography Audits**: `node scripts/check-typography.mjs` and `node scripts/test-touch-haptics.mjs`.

---

## 8. Actual Project Commands

```bash
# 1. Audit mobile typography properties for strict design-token adherence
node scripts/check-typography.mjs

# 2. Verify touch target ergonomics and haptic rate limiting
node scripts/test-touch-haptics.mjs

# 3. Verify Web/Mobile visual and token parity
node scripts/test-parity-rules-and-skills.mjs

# 4. Mobile UI and badge component regression test
node apps/mobile/test/test-badge-component.mjs
```

---

## 9. Success Criteria

1. **Zero Overflow**: `document.documentElement.scrollWidth === window.innerWidth` across all viewports.
2. **Token Compliance**: 100% of rendered colors, borders, and typography originate from `@reachinternational/design-tokens`.
3. **Data Table Ergonomics**: Sorting, pagination, search, and filtering operate without flickering or layout jumps.
4. **Touch Safety**: All interactive touch targets measure $\ge 44 \times 44\text{ px}$.

---

## 10. Failure Handling

- If horizontal scrolling occurs on mobile: find the offending element using DevTools console:
  `document.querySelectorAll('*').forEach(el => el.scrollWidth > window.innerWidth && console.log(el))`
  Apply `min-w-0`, `max-w-full`, or `overflow-x-auto` to the specific container.
- If text is clipped: replace rigid fixed heights (`h-10`) with `min-h-[40px]` or flexible layout containers.

---

## 11. Evidence & Reporting

The test report must provide:
- Viewports verified.
- Confirmation of zero horizontal overflow.
- Confirmation of Light and Dark theme compliance.
- Status of data table filtering, sorting, and pagination.

# Accessibility (a11y) & Inclusive Design Testing Standards

> **ACCESSIBILITY STANDARDS COMPLIANT WITH WCAG 2.2 LEVEL AA**  
> *ReachInternational software is used by operators, technicians, and managers across diverse lighting conditions and device environments. Accessibility is a fundamental usability requirement.*

---

## 1. Purpose

The purpose of ReachInternational's Accessibility Testing standards is to guarantee that **all web interfaces and native mobile screens are fully operable via keyboard, screen readers, and assistive technologies**, satisfying WCAG 2.2 Level AA requirements.

---

## 2. Applicable Applications & Packages

- `apps/web`: Next.js Web Application (Marketing and Operational Admin routes)
- `apps/mobile`: Expo / React Native Mobile Application
- `packages/design-tokens`: Color contrast, typography readability, and focus tokens

---

## 3. WCAG 2.2 Level AA Testing Targets

### A. Keyboard Navigation & Focus Management
1. **Full Operability**: Every interactive element (buttons, links, inputs, table rows, dropdowns) must be navigable and activatable using only the `Tab`, `Shift+Tab`, `Enter`, `Space`, and arrow keys.
2. **Visible Focus Indicators**: Focus rings must be prominent and high-contrast (e.g. `focus-visible:ring-2 focus-visible:ring-sky-500`). Never set `outline: none` without providing an accessible fallback.
3. **Focus Trapping in Modals**: When a dialog or modal opens, focus must be trapped within the dialog container. Pressing `Escape` must dismiss the dialog, and focus must return to the trigger element that opened it.
4. **Logical Tab Sequence**: The DOM order must reflect the visual reading and operational order.

### B. Screen Reader Semantics & ARIA
1. **Semantic HTML First**: Use native `<button>`, `<a>`, `<input>`, `<nav>`, `<main>`, `<header>` instead of `<div>` with `onClick`.
2. **Accessible Names**: All icon-only buttons (such as search, close, filter, delete) must have an `aria-label` or visually hidden text (e.g. `@radix-ui/react-visually-hidden`).
3. **Dynamic State Attributes**:
   - Collapsible accordions/drawers: `aria-expanded="true|false"`
   - Active tabs: `aria-selected="true|false"`
   - Loading sections: `aria-busy="true"`
   - Asynchronous error banners: `role="alert"` and `aria-live="assertive"`

### C. Color Contrast & Visual Readability
1. **Contrast Ratios (WCAG AA)**:
   - Normal text (< 18pt / < 24px): Minimum **4.5:1** contrast ratio against its background.
   - Large text ($\ge$ 18pt / $\ge$ 24px) & UI components/borders: Minimum **3:1** contrast ratio.
2. **No Color-Only Information**: Never communicate status solely through color (e.g. a red dot). Always accompany colors with text labels, badges, or distinct icons.
3. **Badge Readability**: Avoid semi-transparent washes (e.g. `bg-emerald-500/10`) that become unreadable in dark mode or low-brightness screens. Use solid, high-contrast tokens.

### D. Form Accessibility
1. **Explicit Form Labels**: Every input, select, and textarea must have an associated `<label>` using `htmlFor="inputId"` matching the element's `id`.
2. **Accessible Error Messages**: Input errors must be programmatically associated via `aria-invalid="true"` and `aria-describedby="errorId"`.

### E. Motion & Scaling Resilience
1. **Respect Reduced Motion**: Support `prefers-reduced-motion: reduce` by disabling non-essential parallax, shader transitions, and looping hero animations.
2. **Text Zoom Resilience**: Layouts must remain fully functional and legible when browser zoom is set to **200%** without overlapping or clipped content.

---

## 4. Required Testing Approach

```text
[ STAGE 1: AUTOMATED AUDIT ]
  ├── Run axe-core browser audit or Lighthouse Accessibility check
  └── Verify zero critical or serious automated violations

[ STAGE 2: KEYBOARD TRAVERSAL TEST ]
  ├── Navigate through the page using Tab / Shift+Tab only
  ├── Verify all interactive items receive focus in logical order
  └── Open and close modals using Enter and Escape keys

[ STAGE 3: CONTRAST & READABILITY AUDIT ]
  ├── Inspect text and badge contrast in both Light and Dark themes
  └── Verify status indicators use icons/text alongside color
```

> [!IMPORTANT]
> **Automated checks (axe-core, Lighthouse) only detect ~30–40% of accessibility issues.** Manual keyboard navigation and focus verification are mandatory.

---

## 5. Recommended Tools

- **axe-core / Playwright Axe**: Automated a11y test integration
- **Lighthouse CI**: Comprehensive accessibility score auditing ($\ge 95$)
- **Screen Readers**: VoiceOver (macOS/iOS), TalkBack (Android), NVDA (Windows)
- **Contrast Checkers**: WebAIM Contrast Checker or browser DevTools color picker

---

## 6. Actual Project Commands

```bash
# 1. Monorepo typography check ensuring accessible font weights and line heights
node scripts/check-typography.mjs

# 2. Touch target & ergonomics guard (verifies minimum 44px touch targets)
node scripts/test-touch-haptics.mjs

# 3. Mobile screen accessibility and modal invariant check
node apps/mobile/test/run-tests.mjs
```

---

## 7. Success Criteria

1. **Zero Axe Violations**: Zero critical or serious accessibility violations.
2. **Full Keyboard Navigation**: 100% of interactive controls are reachable and operable via keyboard.
3. **Contrast Compliance**: 100% of body text meets the 4.5:1 contrast ratio in both Light and Dark modes.
4. **Accessible Modals**: All modals trap focus and restore focus on close.

---

## 8. Failure Handling

- If an icon button lacks an accessible name: add `aria-label="Action description"` immediately.
- If a badge fails color contrast: switch from an un-styled semi-transparent wash to the canonical `@reachinternational/design-tokens` high-contrast badge variant.
- If focus disappears: ensure that conditionally rendered elements do not unmount while still holding active focus.

---

## 9. Evidence & Reporting

The test report must provide:
- Status of keyboard navigation verification.
- Contrast check outcomes in Light and Dark modes.
- Confirmation of accessible labels for all form inputs and icon buttons.

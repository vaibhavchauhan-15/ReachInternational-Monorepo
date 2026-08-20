# UI & Aesthetic Rules — ReachInternational (Web & Mobile UI/UX Consistency Protocol)

## Specific ReachInternational Aesthetics
1. **Enterprise Dark/Light Mode**: Use curated dark color palettes (`#0a0a0a` canvas, `#171717` cards, `#262626` / `#ebebeb` hairlines, blue `#3b82f6` / `#0070f3` accents) with smooth glassmorphism (`backdrop-blur-md`, `bg-slate-900/80`).
2. **Typography**: Modern Vercel Geist font stack (`Geist Sans` & `Geist Mono`) with high legibility for industrial data tables, KPI metrics, and log timelines.
3. **Animations**: Subtle, purposeful micro-animations using `framer-motion` for page transitions, tab switches, and modal opens. Avoid heavy or disruptive transitions.
4. **Responsive Layouts**: Design for both desktop monitors and mobile touch devices. Mobile bottom navigation must utilize Expo Router tabs + top hairline border.
5. **UI Primitives**: Always reuse components from `components/ui/*` (`Button`, `Card`, `Badge`, `EnterpriseTable`, `Modal`, `PageHeader`, `Toast`, `Skeleton`) and shared design tokens (`@reachinternational/design-tokens`) before inventing custom elements.
6. **No Placeholders**: Never use broken or filler image links; generate or build SVG mockups.

---

# Global Rule: Web & Mobile UI/UX Consistency

## Objective

The **Web App and Mobile App must be designed as one unified product**.

Both platforms must have the same visual identity, design language, navigation logic, terminology, interaction patterns, and overall user experience.

The UI should feel like:

> **One application adapted to two screen sizes — NOT two separately designed applications.**

The mobile app may adapt layouts and interactions for smaller screens, but it must **never introduce a completely different visual or UX language**.

---

## 1. Single Source of Truth for Design

Before creating or modifying any UI, the AI agent must identify and follow the existing application's design system (`@reachinternational/design-tokens`).

Create and maintain a shared design system containing:

* Brand colors
* Background colors
* Surface/card colors
* Text colors
* Border colors
* Primary/secondary colors
* Success/warning/error colors
* Typography
* Font sizes
* Font weights
* Border radius
* Shadows
* Spacing
* Icons
* Component styles
* Interaction states
* Animation principles

**Do not independently choose colors, spacing, typography, icons, or component styles for Web and Mobile.**

If a design token already exists, reuse it.

---

## 2. Color System — MUST BE IDENTICAL

Web and Mobile must use the **exact same color tokens**.

For example:

```ts
const colors = {
  primary: "...",
  secondary: "...",

  background: "...",
  surface: "...",
  surfaceMuted: "...",

  textPrimary: "...",
  textSecondary: "...",
  textMuted: "...",

  border: "...",

  success: "...",
  warning: "...",
  error: "...",
  info: "...",
};
```

The values must come from a shared design specification (`@reachinternational/design-tokens`).

### Rules

* Never invent a new primary color for Mobile.
* Never use a different shade of the brand color on Mobile.
* Never change semantic colors between platforms.
* Success must look like Success everywhere.
* Warning must look like Warning everywhere.
* Error must look like Error everywhere.
* Primary actions must use the same brand color everywhere.

Mobile can adjust **contrast or size when required for accessibility**, but the underlying design token must remain the same.

---

## 3. Typography Must Be Consistent

Use the same typography hierarchy across Web and Mobile.

Maintain consistent:

* Font family
* Font weight
* Heading hierarchy
* Body text hierarchy
* Label styles
* Caption styles
* Button typography
* Navigation typography

Example:

```text
H1
H2
H3
Body
Body Small
Label
Caption
Button
```

The actual font size may be slightly responsive when necessary, but the **hierarchy and visual weight must remain consistent**.

For example:

```text
Web H1 → 32px
Mobile H1 → 28px
```

is acceptable.

But:

```text
Web H1 → bold dark text
Mobile H1 → thin colored text
```

is not acceptable.

---

## 4. Components Must Look Identical

Common components must maintain the same visual design across both platforms.

This includes:

* Buttons
* Cards
* Inputs
* Selects
* Dropdowns
* Tabs
* Tables
* Badges
* Alerts
* Modals
* Bottom sheets
* Navigation
* Sidebar
* Headers
* Search
* Filters
* Empty states
* Loading states
* Error states
* Confirmation dialogs
* User profiles
* Status indicators

The implementation can be platform-specific, but the **visual design must remain consistent**.

Example:

### Web

```text
[ + Add Machine ]
```

### Mobile

```text
      [+]
```

The mobile version may use an icon-only button because of space constraints, but it must use the **same icon, color, typography principles, radius, elevation, and interaction behavior**.

---

## 5. Navigation Must Follow the Same Information Architecture

Web and Mobile must use the same:

* Navigation hierarchy
* Menu names
* Section names
* Page names
* Icons
* Routes/concepts
* Grouping
* Active states
* Permissions

Do not rename a feature on Mobile simply because the UI is different.

Example:

```text
Web:
Machines
 ├─ Machine Directory
 ├─ Service Logs
 └─ Breakdown Complaints
```

Mobile must preserve the same information architecture:

```text
Machines
 ├─ Machine Directory
 ├─ Service Logs
 └─ Breakdown Complaints
```

Only the presentation may change.

---

## 6. Responsive Adaptation ≠ Different Design

The AI agent must distinguish between:

### Allowed

Adapting the layout to the device:

```text
Desktop:
Sidebar + Content

Mobile:
Bottom Navigation + Content
```

### Not Allowed

Creating an unrelated design:

```text
Desktop:
Professional dashboard

Mobile:
Completely different colors,
different icons,
different cards,
different terminology,
different navigation structure
```

The mobile experience should be considered a **responsive adaptation of the same design system**.

---

## 7. Use the Same Icons

Use the same icon family across Web and Mobile wherever possible.

For example:

```text
Machines          → same icon
Service Logs      → same icon
Reports           → same icon
Settings          → same icon
Profile           → same icon
Notifications     → same icon
```

Do not use:

* Lucide on Web
* Material Icons on Mobile

unless there is a deliberate design-system decision.

If platform limitations require different icon implementations, choose visually equivalent icons and maintain the same meaning and visual weight (e.g. via `@reachinternational/design-tokens` icon registry).

---

## 8. Same Interaction States

Every interactive component must have consistent states:

```text
Default
Hover       → Web
Pressed     → Web + Mobile
Focus       → Web + Mobile
Active
Selected
Disabled
Loading
Success
Error
```

The visual language of these states must remain consistent.

For example:

```text
Active → Primary brand color + subtle background
Disabled → Reduced opacity
Error → Error color + clear message
Loading → Same loading indicator style
```

---

## 9. Same UX Logic

Business logic and user workflows must remain consistent.

For example:

If Web requires:

```text
Machines
→ Machine Directory
→ Select Machine
→ View Details
→ Service Logs
```

Mobile should follow the same logical flow.

Do not introduce unnecessary additional steps on Mobile.

Mobile may change the presentation:

```text
Web:
Table

Mobile:
Machine cards
```

but the user should still be able to complete the **same task using the same logical workflow**.

---

## 10. Shared Design Tokens

Create a central design-token system wherever the project architecture allows it.

Example:

```ts
export const designTokens = {
  colors: {},
  typography: {},
  spacing: {},
  radius: {},
  shadows: {},
  animation: {},
};
```

Web and Mobile should consume these tokens (`@reachinternational/design-tokens`) instead of hard-coding values independently.

Avoid:

```tsx
// Web
background: "#123456"
```

and:

```tsx
// Mobile
backgroundColor: "#164A72"
```

when both represent the same design token.

Instead:

```text
primary
surface
background
textPrimary
border
success
warning
error
```

should be centrally defined.

---

## 11. Spacing & Layout System

Use the same spacing scale across platforms.

Example:

```text
4
8
12
16
20
24
32
40
48
```

The exact layout may adapt to screen width, but spacing should follow the same system.

Avoid arbitrary values such as:

```text
13px
17px
23px
27px
```

unless there is a specific design reason.

---

## 12. Border Radius & Elevation

Maintain the same visual language for:

* Cards
* Buttons
* Inputs
* Modals
* Sheets
* Menus
* Navigation containers

Example:

```text
Small → 6px
Medium → 10px
Large → 14px
Pill → 999px
```

The actual values must follow the project's established design tokens.

Shadows/elevation must also follow the same hierarchy.

---

## 13. Animation & Motion

Web and Mobile should use the same **motion philosophy**.

Maintain consistent:

* Animation speed
* Easing
* Transition behavior
* Feedback
* Enter/exit behavior

For example:

```text
Fast → 150ms
Normal → 200ms
Slow → 300ms
```

Do not add excessive animations to Mobile that don't exist on Web.

Avoid:

* Unnecessary bouncing
* Excessive scaling
* Long transitions
* Decorative animations that reduce usability

Animations should communicate state changes and improve usability.

---

## 14. Platform-Specific Adaptation

Platform-specific UI is allowed **only when necessary for usability**.

Examples:

### Web

```text
Sidebar
Hover menus
Data tables
Multi-column layouts
Desktop dropdowns
```

### Mobile

```text
Bottom navigation
Bottom sheets
Swipe gestures
Touch-friendly controls
Stacked cards
Mobile filters
```

These are **layout adaptations**, not separate design systems.

The same:

* Colors
* Typography
* Icons
* Terminology
* Visual hierarchy
* UX principles
* Component identity

must remain intact.

---

## 15. Touch Targets

Mobile controls must be optimized for touch.

Interactive elements should have sufficiently large touch targets while preserving the same visual design.

Do not simply shrink Web components onto Mobile.

Instead:

```text
Same component
+
Mobile-friendly dimensions
+
Same design language
```

---

## 16. Content & Terminology Must Match

Web and Mobile must use the same:

* Feature names
* Button labels
* Status labels
* Error messages
* Empty-state messages
* Confirmation messages
* Navigation labels
* Terminology

Example:

If Web says:

> "Breakdown Complaints"

Mobile should not say:

> "Issues"

unless there is a deliberate product-level terminology decision.

---

## 17. Accessibility Must Be Consistent

Accessibility standards must apply to both platforms.

Maintain:

* Sufficient contrast
* Clear focus/selection states
* Readable text
* Meaningful labels
* Accessible icons
* Error messaging
* Touch target sizes
* Keyboard accessibility on Web
* Screen-reader accessibility where applicable

Do not sacrifice accessibility simply to make the platforms visually identical.

---

## 18. Dark/Light Theme

If the product supports themes, Web and Mobile must use the **same theme definitions**.

For example:

```text
Light Theme
Dark Theme
```

must use the same semantic tokens.

Do not create separate colors for:

```text
Web Dark Mode
Mobile Dark Mode
```

unless technically required.

---

## 19. Before Creating Any New UI

The AI agent MUST follow this process:

### Step 1 — Inspect

Check the existing:

* Web UI
* Mobile UI
* Design tokens
* Components
* Navigation
* Icons
* Colors
* Typography

### Step 2 — Reuse

Before creating a new component, check whether an equivalent component already exists.

### Step 3 — Compare

If Web and Mobile currently differ, identify the difference.

### Step 4 — Standardize

Use the existing approved design language as the source of truth.

### Step 5 — Adapt

Only change layout where the platform requires it.

### Step 6 — Verify

After implementation, compare Web and Mobile side-by-side.

---

## 20. AI Agent Must NOT Do This

The AI agent must never:

* Invent a new color without justification.
* Create a separate Mobile design system.
* Change icons unnecessarily.
* Rename existing features.
* Create inconsistent button styles.
* Create different card styles for the same feature.
* Introduce different spacing systems.
* Introduce different border-radius systems.
* Change the navigation hierarchy.
* Create unnecessary platform-specific UI.
* Copy desktop UI directly onto a small screen without adaptation.
* Make visual changes simply because they "look better" without checking the existing design system.

---

## 21. Priority Order

When making UI decisions, follow this priority:

```text
1. Existing Design System
        ↓
2. Product UX / Information Architecture
        ↓
3. Web ↔ Mobile Consistency
        ↓
4. Accessibility
        ↓
5. Platform-specific usability
        ↓
6. Visual refinement
```

Never sacrifice the product's overall consistency for a minor visual improvement.

---

## 22. Final Quality Rule

Before completing any UI task, the AI agent must ask internally:

> **"If I place the Web and Mobile screens side-by-side, will a user immediately recognize that they belong to the same product?"**

The answer must be **YES**.

The final product should feel:

* Consistent
* Professional
* Predictable
* Clean
* Modern
* Easy to navigate
* Visually unified

### Golden Rule

> **Same product → Same design system → Same visual language → Same UX logic → Platform-specific layout only when necessary.**

Web and Mobile are two interfaces for **one product**, not two independently designed products.

# UI & Aesthetic Rules — ServiceCentric

1. **Enterprise Dark/Light Mode**: Use curated dark color palettes (`slate-900`, `zinc-950`, indigo/cyan glow highlights) with smooth glassmorphism (`backdrop-blur-md`, `bg-slate-900/80`).
2. **Typography**: Modern font stack with high legibility for industrial data tables, KPI metrics, and log timelines.
3. **Animations**: Subtle, purposeful micro-animations using `framer-motion` for page transitions, tab switches, and modal opens. Avoid heavy or disruptive transitions.
4. **Responsive Layouts**: Design for both desktop monitors and mobile touch devices. Mobile navigation must utilize `MobileBottomNav.tsx`.
5. **UI Primitives**: Always reuse components from `components/ui/*` (`Button`, `Card`, `Badge`, `EnterpriseTable`, `Modal`, `PageHeader`, `Toast`, `Skeleton`) before inventing custom elements.
6. **No Placeholders**: Never use broken or filler image links; generate or build SVG mockups.

# Current Task: Mobile Bottom Navbar Equal Padding & Spacing (/dashboard & Mobile App)

Status: COMPLETED (2026-10-01)

## 1. Problem & Root Cause Analysis
On mobile viewports (360×800), the mobile bottom navigation bar (`<BottomNav>`) had `px-1` with `justify-around` and `flex-1 min-w-0` on `li` elements without any `gap` between tabs or internal padding inside `<Link>` controls. As a result:
1. All 5 tabs were touching edge-to-edge with 0 space between them.
2. Long labels like "Attendance" (10 chars) pressed tightly against adjacent tabs ("Machines" and "Account").
3. Items lacked equal internal padding and active pill background feedback.

---

## 2. Delivered Architectural Changes
1. **Web App Mobile Bottom Navigation (`apps/web/components/navigation/BottomNav.tsx`)**:
   - Updated `<ul>` container to `flex items-center justify-between h-14 max-w-md mx-auto px-2 py-1 gap-1 sm:px-4 sm:gap-2`.
   - Added equal 8px edge padding (`px-2`), equal vertical padding (`py-1`), and explicit 4px gap (`gap-1` / `sm:gap-2`) between all tab items.
   - Updated `<li>` to `flex-1 min-w-0 h-full flex items-center justify-center`.
   - Updated `<Link>` to `w-full h-full min-h-[44px] px-1 py-1 rounded-lg gap-0.5 text-[11px] sm:text-xs tracking-tight transition-all duration-150 active:scale-95`.
   - Added subtle Geist-compliant active background feedback (`bg-[var(--color-canvas)]/60`) and hover background (`hover:bg-[var(--color-canvas)]/40`).
   - Adjusted icon to `size={19}` and repositioned active indicator dot to `bottom-1`.

2. **Cross-Platform Mobile App Synchronization (`apps/mobile/components/navigation/MobileBottomNav.tsx`)**:
   - Updated `pillBar` container to `justifyContent: 'space-between'`, `paddingHorizontal: 8`, `paddingVertical: 5`, and added `gap: 4`.
   - Updated `navItemBtn` to `paddingHorizontal: 2`, `paddingVertical: 3`, and added `borderRadius: 12`.
   - Added active pill background feedback (`theme.colors.canvas + '80'`).
   - Ensured `numberOfLines={1}` on item labels.

---

## 3. Files Changed
- `apps/web/components/navigation/BottomNav.tsx` (MODIFIED)
- `apps/mobile/components/navigation/MobileBottomNav.tsx` (MODIFIED)

---

## 4. Verification & Quality Assurance
- **Web TypeScript Check**: `pnpm --filter @reachinternational/web exec tsc --noEmit` → 0 errors.
- **Mobile TypeScript Check**: `pnpm --filter @reachinternational/mobile exec tsc --noEmit` → 0 errors.
- **Responsive Geometry (360×800)**: 16px edge padding + 16px gap (4 × 4px) + 328px distributed evenly across 5 tabs (65.6px per tab with 4px inner padding), allowing "Attendance" to render with equal padding and breathing room.

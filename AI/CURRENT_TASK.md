# Current Task

## Task: Mobile Assign Personnel Header, Machine Dropdown Functionality & Universal Search Input Layout Polish
**Status**: ✅ COMPLETED / VERIFIED
**Date**: 2026-10-03
**Type**: Mobile UI/UX Polish / Component Architecture / Cross-Platform Parity (`apps/mobile`)

## User Requests
1. **Header Cleanliness**: From `MobileAssignPersonnelModal.tsx` header, remove the static machine details (`M/C-0001` and subtitle `• JCB 3DX Super - JCB3DX-2024-001`), keeping strictly the clean title `"Assign Machine Operator"`.
2. **Functional Machine Dropdown**: Make the machine dropdown selection fully functional in the modal.
3. **Universal Search Input Border & Layout Fix**: Fix broken search box layouts and browser-default inset border rectangles across the native app as visible in user screenshots; implement proper edge border highlighting (`#0284c7` / `#38bdf8`) on focus.

## Root Causes
1. **Static Machine Info in Header**: `MobileAssignPersonnelModal.tsx` previously hardcoded `M/C-0001` badge and `• JCB 3DX Super - JCB3DX-2024-001` subtitle into the modal header instead of showing the modal title cleanly.
2. **Non-functional Machine Dropdown**:
   - `mousedown` event listener fired before `click`/`onPress`. Because `data-dropdown-container` was previously passed as a bare boolean prop without value, React Native Web omitted it from the DOM element, so `target.closest('[data-dropdown-container]')` returned `null`, unmounting the dropdown before selection could register.
   - `position: 'absolute'` inside a relative card container caused touch clipping in React Native Android outside the parent bounds.
3. **Broken Search Box Layouts & Inset Borders**:
   - React Native Web renders `<TextInput>` as an HTML `<input>` which browser default stylesheets style with `border: 2px inset rgb(118, 118, 118)` unless explicitly stripped.
   - Inner `<TextInput>` elements lacked explicit `borderWidth: 0` and `backgroundColor: 'transparent'`, causing an inner gray rectangular border inside rounded search containers.

## Solutions Implemented
1. **Header Polish**: Removed static machine pill and model subtitle from `MobileAssignPersonnelModal.tsx` header.
2. **Machine Dropdown Overhaul**:
   - Refactored Section 1 Machinery Equipment dropdown to an inline expandable panel (`styles.dropdownInlinePanel`) with responsive `<ScrollView>` and `<SearchInput>`.
   - Updated outside-click event listener from `mousedown` to `click` with explicit `{...({ 'data-dropdown-container': 'true' } as any)}` attributes.
   - Verified tapping any equipment updates `selectedMachineId`, reloads personnel assignments, triggers haptics, and smoothly collapses the panel.
3. **Canonical `SearchInput` Component (`apps/mobile/components/ui/SearchInput.tsx`)**:
   - Built reusable search input primitive adhering to Vercel Geist design tokens.
   - Edge border highlighting on focus: `#0284c7` (primary brand blue) / `#38bdf8` (dark mode) with subtle focus ring glow on web.
   - Seamless borderless inner `<TextInput>` with `backgroundColor: 'transparent'`, `borderWidth: 0`, and web resets (`outline: 'none'`, `border: 'none'`, `boxShadow: 'none'`).
   - Integrated Search icon (turns blue on focus), activity loading spinner, clear `X` button with hitSlop, and haptic feedback.
   - Exported through `apps/mobile/components/ui/index.ts` and integrated into `FilterToolbar.tsx`.
4. **Universal Search Box Resets Monorepo-Wide**:
   - Applied borderless inner text input resets across `SearchableSelect.tsx`, `FilterToolbar.tsx`, `DropdownFilterSelector.tsx`, `ClientSelectModal.tsx`, `MultiUserSelectModal.tsx`, `MachineDetailView.tsx`, `machines.tsx`, `attendance.tsx`, `payroll.tsx`, `users.tsx`, `Input.tsx`, `MobileHeader.tsx`, `MobileCommandPalette.tsx`, `OperationsFilterSelectorModal.tsx`, `CustomFilterSelectorModal.tsx`, and `_layout.tsx`.

## Files Modified
- `apps/mobile/components/ui/SearchInput.tsx` (new)
- `apps/mobile/components/ui/index.ts`
- `apps/mobile/components/ui/FilterToolbar.tsx`
- `apps/mobile/components/operations/MobileAssignPersonnelModal.tsx`
- `apps/mobile/components/machines/MachineModal.tsx`
- `apps/mobile/components/ui/SearchableSelect.tsx`
- `apps/mobile/components/machines/DropdownFilterSelector.tsx`
- `apps/mobile/components/machines/ClientSelectModal.tsx`
- `apps/mobile/components/machines/MultiUserSelectModal.tsx`
- `apps/mobile/components/machines/MachineDetailView.tsx`
- `apps/mobile/app/(app)/machines.tsx`
- `apps/mobile/app/(app)/attendance.tsx`
- `apps/mobile/app/(app)/payroll.tsx`
- `apps/mobile/app/(app)/users.tsx`
- `apps/mobile/components/ui/Input.tsx`
- `apps/mobile/components/ui/MobileHeader.tsx`
- `apps/mobile/components/navigation/MobileCommandPalette.tsx`
- `apps/mobile/components/operations/OperationsFilterSelectorModal.tsx`
- `apps/mobile/components/users/CustomFilterSelectorModal.tsx`
- `apps/mobile/app/_layout.tsx`

## Verification
- Mobile TypeScript: Clean pass (`pnpm --filter @reachinternational/mobile exec tsc --noEmit` -> 0 errors)
- Web TypeScript: Clean pass (`pnpm --filter @reachinternational/web exec tsc --noEmit` -> 0 errors)
- Full Monorepo Typecheck: Clean pass across 7/7 packages (`pnpm typecheck` -> 7 successful, 0 errors)

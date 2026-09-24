# Current Task: Standardize Machine Detail & Personnel Modal Card Hover Animations & Proportional Icon Sizing (/machines/[id])

Status: COMPLETED (2026-09-24)

## User Request Feedback
- Feedback on `/machines/d2390003-21f5-40db-af94-dd9f036de0e5`:
  1. `<MachineClientView> <FadeIn> <motion.div> <Card>` rounded border (`div > .card-base > .grid > .rounded-xl`): "when i hover this card then icon should start animating with default animation behaviour instead of only hover to the icon then icon will animate. make sure dont add any custom animation all imported icon have its default animation keep this only. also make the icon size proper as per titile padding"
  2. `<MachineClientView> <FadeIn> <motion.div> <Card>` rounded border (`div > .card-base > .grid > .rounded-xl`): same requirement for operators panel card.
  3. `<DismissableLayer> <motion.div>` "Unsaved roster changes" (`.space-y-5 > .pt-3 > .text-xs > .text-amber-500`): card-level hover animation and proper icon size.
  4. `<DismissableLayer> <motion.div>` flex items (`.flex-1 > .space-y-5 > .space-y-2 > .flex`): Supervisors section in `MachinePersonnelModal` with card-level hover animation and proper icon size.
  5. `<DismissableLayer> <motion.div>` flex items (`.space-y-5 > .space-y-2 > .flex > .flex`): Operators section in `MachinePersonnelModal` with card-level hover animation and proper icon size.

## Root Cause Analysis
1. **Direct Icon Hover Dependency**:
   - In `apps/web/app/(app)/machines/[id]/machine-client-view.tsx`, the Supervisors and Operators panels were rendered with static `Shield` and `Wrench` icons from `lucide-react` without bridged animation handlers or card-level hover hooks.
2. **Modal Section Layout & Icon Sizing**:
   - In `apps/web/components/machines/MachineEditModals.tsx`, `MachinePersonnelModal` rendered raw headers with static `Shield`, `Wrench`, and `AlertCircle` icons at `w-3.5 h-3.5` without card wrappers (`data-hover-parent`) or standard title hairline divider padding.
3. **Bridge Direct Hover Bypass**:
   - In `apps/web/components/icons/icon-bridge.tsx`, `onMouseEnter` on the icon was conditionally skipped if `hasParentRef.current` was true, preventing direct hover on the icon from triggering its animation if it was already inside a parent container.

## Delivered Solution
1. **Standardized Card-Level Hover Micro-Interactions (`machine-client-view.tsx`)**:
   - Replaced static icons with bridged animated icons (`AnimatedShield`, `AnimatedWrench`, `AnimatedUsers`, `AnimatedBuilding`, `AnimatedClock`, `AnimatedPhone`, `AnimatedMail`, `AnimatedInfo`, `AnimatedAlertCircle`).
   - Added `data-hover-parent` to:
     - Section 1: Basic Info card (`<Card data-hover-parent>`)
     - Section 2: Assigned Shift Personnel card (`<Card data-hover-parent>`)
     - Section 2 Inner Supervisors panel (`<div data-hover-parent className="rounded-xl border ...">`)
     - Section 2 Inner Operators panel (`<div data-hover-parent className="rounded-xl border ...">`)
     - Individual `PersonnelCard`s (`<div data-hover-parent className="rounded-xl ...">`)
     - Section 3: Client Details card (`<Card data-hover-parent>`)
   - Standardized header icon sizing to `size={16}` (`w-4 h-4 shrink-0`) with consistent title padding (`pb-2 mb-3 border-b border-[var(--color-hairline)]`).
2. **Standardized Modal Section Cards (`MachineEditModals.tsx`)**:
   - Wrapped `MachinePersonnelModal` Supervisors and Operators sections into standardized cards (`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors`) with `data-hover-parent`, `AnimatedShield size={16}`, `AnimatedWrench size={16}`, and `AnimatedAlertCircle size={14}` for unsaved roster changes notice.
   - Synchronized `MachineInfoModal` and `MachineClientModal` with matching `data-hover-parent` section cards and animated icons.
3. **Edit Page & Add Modal Parity (`machine-edit-client.tsx` & `MachineModal.tsx`)**:
   - Synchronized full edit page (`machine-edit-client.tsx`) and creation modal (`MachineModal.tsx`) cards with `data-hover-parent`, `size={16}` icons, and proportional title padding.
4. **Bridge Dual-Trigger Support (`icon-bridge.tsx`)**:
   - Enabled direct `onMouseEnter` triggering on bridged icons so they respond both to card/parent hover and direct icon hover.
   - Preserved 100% native default Framer Motion animation behavior without any custom animation hacks.

## Monorepo Quality Gates Passed
- Web TypeScript: `pnpm --filter @reachinternational/web exec tsc --noEmit` exited code 0 (0 errors).
- Mobile TypeScript: `pnpm --filter @reachinternational/mobile typecheck` exited code 0 (0 errors).
- Permissions Unit Tests: `pnpm --filter @reachinternational/permissions test` passed (3/3 passed).
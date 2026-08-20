# Current Task Context

## Completed Task (2026-08-19) — Proper Tooltip Wrappers for Unlabeled Project Icons

**Goal**: Address user feedback on `/machines?tab=complaints`: "add proper tool tip for all the icons in this project which have not any label".

### Implementation Summary
1. **Modal Dialog Close Button (`apps/web/components/animate-ui/components/radix/dialog.tsx`)**:
   - Wrapped `DialogPrimitive.Close` button with `<TooltipWrapper content="Close modal (Esc)" side="left">`, automatically providing interactive tooltips on the close button across all modals in the application.

2. **Complaints Table Action Tooltips (`apps/web/components/complaints/ComplaintsClient.tsx`)**:
   - Wrapped `View FSR Report`, `Resolve (Fill FSR)` / `View Details`, `Edit Complaint`, and `Delete Complaint` icon buttons in `<TooltipWrapper>` popovers.

3. **Complaints & FSR Detail Modal Actions (`ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`)**:
   - Wrapped `Delete Complaint`, `Edit Complaint`, `Edit Report`, and table row removal (`Trash2`) buttons with `<TooltipWrapper>` popovers.

4. **Machine Services Table Actions (`apps/web/components/services/ServicesClient.tsx`)**:
   - Wrapped `Update Service Log` and `Delete Service Log` icon buttons in `<TooltipWrapper>` popovers.

5. **Enterprise Table Toolbar Controls (`apps/web/components/ui/EnterpriseTable.tsx`)**:
   - Added tooltips to table density buttons (`Compact`, `Default`, `Comfortable`) and column selector toggle (`Columns`).

### Verification Results
- TypeScript Verification: Executed `pnpm --filter @servicecentric/web typecheck` (**Passed cleanly with 0 compilation errors**).


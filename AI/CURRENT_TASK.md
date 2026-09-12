# Current Task: Optimize & Standardize PDF Generation — Centralized PDF Service

Status: COMPLETE (2026-09-12)

## Overview & Background
The project had 5 separate PDF generation implementations scattered across Web and Mobile apps, duplicating document structure, print CSS, logo handling, signature blocks, KPI strips, table rendering, and export filename logic.

This task centralized and standardized the PDF generation architecture across Web (`window.print()`) and Mobile (`expo-print`) apps with zero regressions, maintaining lightweight, high-quality, vector-sharp PDF generation.

---

## Deliverables & Implementations

### Phase 1: Centralized PDF Service & Shared Components (Web)
- `apps/web/lib/pdf/pdf-config.ts`: Single source of truth for page dimensions (A4 portrait), margins, branding (`REACH INTERNATIONAL`, `/pdf-logo.png`), month names, date/time slug formatters (`formatExportDateTimeSlug`), and standardized filename builders (`buildExportFileName`, `buildMachineExportFileName`, `buildMachinesExportFileName`).
- `apps/web/lib/pdf/pdf-print-styles.ts`: Centralized print CSS generator (`getPrintStylesheet`) standardizing `@page`, `@media print`, table layout, header, KPI strip, and page break prevention (`page-break-inside: avoid`).
- `apps/web/lib/pdf/pdf-utils.ts`: Shared utility functions including `isUuid`, `formatCompactTiming`, `computeDurationHours`, `resolveCleanClientName`, `resolvePeriodLabel`, `resolveClientLocation`, and `handleBrowserPrint` (temporary title swap for clean download filename).
- `apps/web/components/pdf/PDFReportHeader.tsx`: Reusable header component rendering logo, centered title/subtitle, pipe-separated scopes, and key-value metadata strip.
- `apps/web/components/pdf/PDFKPIStrip.tsx`: Reusable KPI summary strip with light and dark variants.
- `apps/web/components/pdf/PDFSignatureBlock.tsx`: Reusable 3-column verification block (Prepared By, Client Details & Sign-off, Verified & Approved By).
- `apps/web/components/pdf/PDFTableWrapper.tsx`: Reusable table container with print styling and screen scroll support.
- `apps/web/components/pdf/index.ts`: Barrel export for all PDF components and utilities.

### Phase 2: Refactor Existing Web PDF Modals
- `apps/web/components/operations/PrintableSupervisorLogsModal.tsx`: Refactored to use centralized components (`PDFReportHeader`, `PDFKPIStrip`, `PDFSignatureBlock`, `PDFTableWrapper`, `getPrintStylesheet`, and `pdf-utils.ts`). Code reduced by ~325 lines.
- `apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`: Refactored to use centralized components and utilities. Code reduced by ~164 lines.
- `apps/web/components/machines/PrintableMachineDirectoryModal.tsx`: Refactored to use centralized components and utilities. Code reduced by ~132 lines.

### Phase 3: Centralize Export Utilities
- `apps/web/lib/utils/operator-logs-export.ts`: Re-exports shared config from `pdf-config.ts` and `pdf-utils.ts` for 100% backward compatibility.
- `apps/web/lib/utils/supervisor-logs-export.ts`: Directly imports shared config and utilities from `pdf-config` and `pdf-utils`.
- `apps/web/lib/utils/machines-export.ts`: Directly imports shared config from `pdf-config`.

### Phase 4: Standardize Mobile PDF Templates
- `apps/mobile/lib/pdf-html-templates.ts`: Centralized HTML template builder functions for `expo-print` (`buildPdfHtmlStyles`, `buildPdfHtmlHeader`, `buildPdfHtmlKpiStrip`, `buildPdfHtmlSignatureBlock`, `buildPdfHtmlWrapper`).
- `apps/mobile/components/operations/OperationsExportModal.tsx`: Refactored `generateReportHtml()` to use shared template builders, eliminating over 200 lines of duplicate HTML and inline CSS.
- `apps/mobile/components/machines/MachineExportModal.tsx`: Refactored `generateReportHtml()` to use shared template builders with landscape orientation and 3-column verification signature block.

### Phase 5: Verification
- `pnpm typecheck`: Passed across all 7 workspace packages (0 errors).
- `node apps/mobile/run-tests.mjs`: Passed all 18/18 mobile automated verification test scenarios.
- Zero breaking changes to existing export or report behavior.

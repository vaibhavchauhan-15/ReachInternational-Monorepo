# Reports & Export Generation Audit (Phase 1)

> **SCOPE**: Audit of PDF generation, A4 printable modals, and Excel (`xlsx`) exports across `apps/web`.

---

## 1. Export Mechanisms & Capabilities

ReachInternational provides two primary reporting formats for field and fleet operations:
1. **A4 Printable PDF Reports**: Clean, high-density printable HTML rendered inside dialog modals and printed via browser `window.print()` using CSS `@media print` rules (A4 page size, `@page { size: A4 portrait; margin: 8mm; }`).
2. **Excel Spreadsheet (`.xlsx`) Exports**: Generated on the client side using SheetJS (`xlsx`) for tabular spreadsheet downloads.

---

## 2. Report & Export Module Inventory

| Report Name | Component / Utility | Generation Mode | Heavy Dependencies | Execution Location | Bundle Size Impact | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Supervisor Running Hours PDF** | `components/operations/PrintableSupervisorLogsModal.tsx` | Browser Print (`window.print`) | `@base-ui/react/dialog` | Client | 40.9 KB | 🔴 P0 (Statically bundled in Operations) |
| **Operator Daily Log PDF** | `components/dashboard/PrintableOperatorLogsModal.tsx` | Browser Print (`window.print`) | `@base-ui/react/dialog` | Client | 23.4 KB | 🔴 P0 (Statically bundled in Operator dashboard) |
| **Running Hours Excel Export** | `lib/utils/supervisor-logs-export.ts` | SheetJS Workbook | `xlsx` | Client | ~150 KB (SheetJS runtime) | 🟠 P1 (Imported on demand) |
| **Field Service Report (FSR)** | `components/complaints/FieldServiceReportModal.tsx` | Browser Print (`window.print`) | Dialog, signature canvas | Client | 31.1 KB | 🟡 P2 |
| **Delivery Challan** | `components/challans/PrintableDeliveryChallan.tsx` | Browser Print (`window.print`) | Print CSS | Client | 15.2 KB | 🟢 P3 |
| **Parts Issue Challan** | `components/inventory/PrintablePartsIssueChallan.tsx` | Browser Print (`window.print`) | Print CSS | Client | 14.8 KB | 🟢 P3 |
| **Purchase Order** | `components/purchase-orders/PrintablePurchaseOrder.tsx` | Browser Print (`window.print`) | Print CSS | Client | 16.1 KB | 🟢 P3 |

---

## 3. Findings & Performance Bottlenecks

### Finding RPT-01: Large Synchronous Modal Bundling (🔴 P0)
- **Problem**: `PrintableSupervisorLogsModal` (40.9 KB) is statically imported directly inside `OperationsClient.tsx`.
- **Impact**: Every user viewing the running hours logs table downloads this 40 KB component during initial page load, even if they never open or print the PDF preview.
- **Remediation**: Dynamically import via Next.js `dynamic()`:
  ```tsx
  const PrintableSupervisorLogsModal = dynamic(
    () => import("./PrintableSupervisorLogsModal").then(m => m.PrintableSupervisorLogsModal),
    { ssr: false }
  );
  ```

### Finding RPT-02: Client-Side XLSX Processing on Large Datasets (🟠 P1)
- **Problem**: In `supervisor-logs-export.ts`, `xlsx` builds workbook sheets in browser memory from the in-memory log array.
- **Impact**: If a supervisor exports 10,000+ historical records, client-side memory usage spikes.
- **Remediation**: Cap client-side export to current filtered table view (max 500 rows). For full annual fleet archives, introduce server-streamed CSV generation.

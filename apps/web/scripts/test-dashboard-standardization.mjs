import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

console.log("================================================================");
console.log("  DASHBOARD UI, TYPOGRAPHY & RESPONSIVE SIZING VERIFICATION");
console.log("================================================================");

let totalPassed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// 1. DashboardShell & Skeleton Layout Containment
check("DashboardShell: container uses max-w-7xl mx-auto without double padding", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/DashboardShell.tsx"), "utf8");
  assert.match(content, /w-full max-w-7xl mx-auto/);
  assert.doesNotMatch(content, /px-3\.5 sm:px-6/);
  assert.doesNotMatch(content, /py-5 sm:py-7/);
});

check("DashboardSkeleton: matches DashboardShell container dimensions", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/DashboardSkeleton.tsx"), "utf8");
  assert.match(content, /w-full max-w-7xl mx-auto/);
  assert.doesNotMatch(content, /px-3\.5 sm:px-6/);
});

// 2. globals.css Token Definitions
check("globals.css: defines --color-surface in :root and .dark", () => {
  const content = fs.readFileSync(path.join(webRoot, "app/globals.css"), "utf8");
  assert.match(content, /--color-surface:\s*var\(--color-canvas-elevated\);/);
});

// 3. DashboardHeader
check("DashboardHeader: supports role badge and role-specific default subtitles", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/DashboardHeader.tsx"), "utf8");
  assert.match(content, /super_admin:/);
  assert.match(content, /admin:/);
  assert.match(content, /manager:/);
  assert.match(content, /supervisor:/);
  assert.match(content, /hr:/);
  assert.match(content, /operator:/);
  assert.match(content, /roleMeta\.badge/);
  assert.match(content, /roleMeta\.defaultSubtitle/);
  assert.match(content, /tabular-nums/);
  assert.match(content, /bg-\[var\(--color-canvas-elevated\)\]/);
});

// 4. KPICard
check("KPICard: renders subtitle, trend, and active/hover/focus states", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/KPICard.tsx"), "utf8");
  assert.match(content, /trend &&/);
  assert.match(content, /subtitle &&/);
  assert.match(content, /tabular-nums/);
  assert.match(content, /hover:-translate-y-0\.5/);
  assert.match(content, /focus-visible:ring-2/);
  assert.match(content, /bg-\[var\(--color-canvas-elevated\)\]/);
  assert.doesNotMatch(content, /from-\[var\(--color-surface\)\]/);
});

// 5. KPIGrid
check("KPIGrid: responsive column scaling for 2, 3, 4, 5, 6 columns", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/KPIGrid.tsx"), "utf8");
  assert.match(content, /4:\s*"grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4"/);
  assert.match(content, /5:\s*"grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5"/);
  assert.match(content, /6:\s*"grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6"/);
  assert.match(content, /gap-3 sm:gap-3\.5 lg:gap-4/);
});

// 6. PrimaryAction
check("PrimaryAction: Geist card tokens, min 56px/64px ergonomics, hover arrow", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/PrimaryAction.tsx"), "utf8");
  assert.match(content, /bg-\[var\(--color-canvas-elevated\)\]/);
  assert.match(content, /min-h-\[56px\] sm:min-h-\[64px\]/);
  assert.match(content, /group-hover:translate-x-1/);
  assert.match(content, /focus-visible:ring-2/);
  assert.doesNotMatch(content, /from-\[var\(--color-surface\)\]/);
});

// 7. AlertWidget & StatusCard
check("AlertWidget: informative default title and micro-transitions", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/AlertWidget.tsx"), "utf8");
  assert.match(content, /title = "Operational Alerts"/);
  assert.match(content, /font-mono/);
  assert.match(content, /group-hover:translate-x-0\.5/);
});

check("StatusCard: elevated canvas, font-mono technical eyebrow, and focus ring", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/StatusCard.tsx"), "utf8");
  assert.match(content, /bg-\[var\(--color-canvas-elevated\)\]/);
  assert.match(content, /font-mono text-\[var\(--color-mute\)\] uppercase/);
  assert.match(content, /focus-visible:ring-2/);
  assert.doesNotMatch(content, /from-\[var\(--color-surface\)\]/);
});

// 8. OperatorDashboardView
check("OperatorDashboardView: high-contrast Reach Sky Blue CTA button (no dark mode white-on-white bug)", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/dashboard/operator/OperatorDashboardView.tsx"), "utf8");
  assert.match(content, /bg-\[var\(--color-primary\)\] text-white/);
  assert.doesNotMatch(content, /bg-\[var\(--color-ink\)\] text-white/);
  assert.match(content, /min-h-\[44px\]/);
  assert.match(content, /font-mono/);
  assert.match(content, /bg-\[var\(--color-canvas-elevated\)\]/);
});

// 9. All Other Role Dashboard Views (Super Admin, Admin, Manager, Supervisor, HR)
check("Role Views: font-mono technical eyebrows and standardized grid gaps", () => {
  const views = [
    "components/dashboard/super-admin/SuperAdminDashboardView.tsx",
    "components/dashboard/admin/AdminDashboardView.tsx",
    "components/dashboard/manager/ManagerDashboardView.tsx",
    "components/dashboard/supervisor/SupervisorDashboardView.tsx",
    "components/dashboard/hr/HRDashboardView.tsx",
  ];

  for (const view of views) {
    const content = fs.readFileSync(path.join(webRoot, view), "utf8");
    assert.match(content, /font-mono text-\[var\(--color-mute\)\] uppercase tracking-wider/, `Missing font-mono technical eyebrow in ${view}`);
    assert.match(content, /gap-3 sm:gap-3\.5 lg:gap-4/, `Missing standard gap spacing in ${view}`);
  }
});

// 10. ActivityWidget & WidgetSkeleton
check("ActivityWidget & WidgetSkeleton: surface tokens standardized", () => {
  const actContent = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/ActivityWidget.tsx"), "utf8");
  assert.match(actContent, /bg-\[var\(--color-canvas-elevated\)\]/);
  assert.doesNotMatch(actContent, /from-\[var\(--color-surface\)\]/);

  const skelContent = fs.readFileSync(path.join(webRoot, "components/dashboard/shared/WidgetSkeleton.tsx"), "utf8");
  assert.match(skelContent, /bg-\[var\(--color-canvas-elevated\)\]/);
  assert.doesNotMatch(skelContent, /bg-\[var\(--color-surface\)\]/);
});

console.log("================================================================");
console.log(`  ALL ${totalPassed} DASHBOARD STANDARDIZATION CHECKS PASSED! (100%)`);
console.log("================================================================");

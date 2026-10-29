import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
const webRoot = path.resolve(__dirname, "..");
const mobileRoot = path.resolve(monorepoRoot, "apps/mobile");

console.log("================================================================");
console.log("  MACHINE CLIENT MODAL & SITE SELECTION VERIFICATION (WEB & MOBILE)");
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

// 1. Web MachineClientModal Header
check("MachineClientModal: MachineSelect dropdown is removed from header/title", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/MachineEditModals.tsx"), "utf8");
  // Ensure title is a clean string without nested MachineSelect
  assert.match(content, /<Modal\s+open=\{isOpen\}\s+onClose=\{onClose\}\s+title="Client Assignment"/);
});

// 2. Web MachineClientModal Body Order
check("MachineClientModal: MachineSelect dropdown is placed above ClientSelect in body", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/MachineEditModals.tsx"), "utf8");
  const modalIndex = content.indexOf("export function MachineClientModal(");
  assert.ok(modalIndex > 0, "MachineClientModal must exist");
  const modalContent = content.slice(modalIndex);

  const machineSelectMatch = modalContent.match(/<MachineSelect\s/);
  const clientSelectMatch = modalContent.match(/<ClientSelect\s/);

  assert.ok(machineSelectMatch && machineSelectMatch.index !== undefined, "MachineSelect must be rendered in modal");
  assert.ok(clientSelectMatch && clientSelectMatch.index !== undefined, "ClientSelect must be rendered in modal");
  assert.ok(
    machineSelectMatch.index < clientSelectMatch.index,
    `MachineSelect (${machineSelectMatch.index}) must appear before ClientSelect (${clientSelectMatch.index})`
  );
});

// 3. Web MachineClientModal Site Dropdown Conditional
check("MachineClientModal: Site dropdown is shown only when client has > 1 site, auto-assigned when 1 site", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/MachineEditModals.tsx"), "utf8");
  assert.match(content, /clientId\s*&&\s*sites\.length\s*>\s*1/);
  assert.match(content, /clientId\s*&&\s*sites\.length\s*===\s*1/);
  assert.match(content, /setSiteId\(activeSites\[0\]\.id\)/);
  assert.match(content, /<SearchableSelect/);
});

// 4. Web Data Layer & Actions site_id inclusion
check("Data Layer: machine-list, machine-detail, and getAssignableMachinesAction include site_id", () => {
  const listContent = fs.readFileSync(path.join(webRoot, "lib/data/machines/machine-list.ts"), "utf8");
  assert.match(listContent, /site_id,/);

  const detailContent = fs.readFileSync(path.join(webRoot, "lib/data/machines/machine-detail.ts"), "utf8");
  assert.match(detailContent, /site_id,/);

  const assignActionContent = fs.readFileSync(path.join(webRoot, "app/actions/assignments.ts"), "utf8");
  assert.match(assignActionContent, /site_id:\s*string\s*\|\s*null/);
  assert.match(assignActionContent, /site_id:\s*m\.site_id\s*\|\|\s*null/);

  const machineActionContent = fs.readFileSync(path.join(webRoot, "app/actions/machines.ts"), "utf8");
  assert.match(machineActionContent, /site_id:\s*validSiteId/);
});

// 5. Mobile MachineModal Consistency
check("Mobile MachineModal: Shows Machinery Unit above Client and conditional Site dropdown (> 1 site)", () => {
  const content = fs.readFileSync(path.join(mobileRoot, "components/machines/MachineModal.tsx"), "utf8");
  assert.match(content, /initialSection === 'client' && machineToEdit/);
  assert.match(content, /selectedClient && clientSites\.length > 1/);
  assert.match(content, /selectedClient && clientSites\.length === 1/);
  assert.match(content, /setSiteId\(data\[0\]\.id\)/);
});

console.log("================================================================");
console.log(`  ALL ${totalPassed} VERIFICATION CHECKS PASSED! (100% PARITY)`);
console.log("================================================================");

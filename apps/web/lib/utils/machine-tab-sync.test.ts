import { test } from "node:test";
import assert from "node:assert/strict";

type MachineTab = "overview" | "running_hours" | "audit_trail";

function resolveMachineTab(tabParam: string | null): MachineTab {
  if (tabParam === "running_hours" || tabParam === "logs" || tabParam === "hmr") {
    return "running_hours";
  }
  if (tabParam === "audit_trail" || tabParam === "audit") {
    return "audit_trail";
  }
  return "overview";
}

test("browser Back navigation without tab param restores overview", () => {
  let activeTab: MachineTab = "overview";

  // User navigates to running hours
  activeTab = resolveMachineTab("running_hours");
  assert.equal(activeTab, "running_hours");

  // User hits browser Back button -> searchParams.get("tab") is null
  activeTab = resolveMachineTab(null);
  assert.equal(activeTab, "overview", "Must restore overview when tab param is absent");
});

test("invalid tab query falls back safely to overview", () => {
  assert.equal(resolveMachineTab("invalid-tab-name"), "overview");
  assert.equal(resolveMachineTab(""), "overview");
});

test("aliases map to canonical tabs", () => {
  assert.equal(resolveMachineTab("logs"), "running_hours");
  assert.equal(resolveMachineTab("hmr"), "running_hours");
  assert.equal(resolveMachineTab("audit"), "audit_trail");
});

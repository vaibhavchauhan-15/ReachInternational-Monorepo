import test from "node:test";
import assert from "node:assert/strict";
import { pick, readDraft, hasMeaningfulData } from "./useFormDraft.ts";

// Minimal localStorage shim for Node.js testing
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: () => null,
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: (globalThis as unknown as { localStorage: Storage }).localStorage,
};

test("pick drops fields outside the allowlist", () => {
  assert.deepEqual(pick({ email: "a@b.c", password: "x" }, ["email"]), { email: "a@b.c" });
});

test("pick returns empty object for empty allowlist", () => {
  assert.deepEqual(pick({ email: "a@b.c" }, []), {});
});

test("pick handles missing keys gracefully", () => {
  assert.deepEqual(pick({ email: "a@b.c" }, ["phone"]), {});
});

test("hasMeaningfulData returns false for empty or static default form fields", () => {
  assert.equal(hasMeaningfulData({}), false);
  assert.equal(hasMeaningfulData({ full_name: "", email: "" }), false);
  assert.equal(
    hasMeaningfulData({
      role: "operator",
      shift_start_time: "08:00 AM",
      shift_end_time: "08:00 PM",
      agreed_to_terms: false,
    }),
    false
  );
});

test("hasMeaningfulData returns true when actual user data is entered", () => {
  assert.equal(hasMeaningfulData({ full_name: "Rahul Sharma" }), true);
  assert.equal(hasMeaningfulData({ role: "operator", email: "rahul@test.com" }), true);
  assert.equal(hasMeaningfulData({ agreed_to_terms: true }), true);
});

test("readDraft returns data inside TTL, null after it", () => {
  store.set("k", JSON.stringify({ savedAt: 1000, data: { email: "a@b.c", password: "x" } }));
  // Within TTL: returns only allowed fields
  assert.deepEqual(readDraft("k", ["email"], 2000)?.data, { email: "a@b.c" });
  // Re-set because readDraft doesn't remove the key when it's valid
  store.set("k", JSON.stringify({ savedAt: 1000, data: { email: "a@b.c", password: "x" } }));
  // After TTL (25 hours): returns null and removes the key
  assert.equal(readDraft("k", ["email"], 1000 + 25 * 3600 * 1000), null);
  assert.equal(store.has("k"), false); // expired draft is deleted
});

test("readDraft returns null for corrupt JSON", () => {
  store.set("k", "not json");
  assert.equal(readDraft("k", ["email"]), null);
});

test("readDraft returns null for empty or default-only data", () => {
  store.set("k", JSON.stringify({ savedAt: Date.now(), data: { email: "", phone: "" } }));
  assert.equal(readDraft("k", ["email", "phone"]), null);
});

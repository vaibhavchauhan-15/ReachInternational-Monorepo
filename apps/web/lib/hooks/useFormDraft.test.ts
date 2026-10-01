import test from "node:test";
import assert from "node:assert/strict";
import { pick, readDraft } from "./useFormDraft";

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

test("pick drops fields outside the allowlist", () => {
  assert.deepEqual(pick({ email: "a@b.c", password: "x" }, ["email"]), { email: "a@b.c" });
});

test("pick returns empty object for empty allowlist", () => {
  assert.deepEqual(pick({ email: "a@b.c" }, []), {});
});

test("pick handles missing keys gracefully", () => {
  assert.deepEqual(pick({ email: "a@b.c" }, ["phone"]), {});
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

test("readDraft returns null for empty data", () => {
  store.set("k", JSON.stringify({ savedAt: Date.now(), data: { email: "", phone: "" } }));
  assert.equal(readDraft("k", ["email", "phone"]), null);
});

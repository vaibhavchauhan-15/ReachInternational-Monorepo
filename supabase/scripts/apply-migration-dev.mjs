// Applies a migration SQL file to the Supabase project via the Management API.
// Usage: node scripts/apply-migration-dev.mjs <path-to-sql>
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../..");
const envFile = fs.readFileSync(path.join(rootDir, "apps/web/.env.local"), "utf8");
const token = envFile.match(/SUPABASE_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
const PROJECT_ID = "vlmxciuogczumumrwyot"; // Development (default write target)

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing in apps/web/.env.local");
  process.exit(1);
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node scripts/apply-migration-dev.mjs <sql-file>");
  process.exit(1);
}
const sql = fs.readFileSync(path.resolve(rootDir, sqlPath), "utf8");

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

try {
  const result = await runQuery(sql);
  console.log("Migration applied:", JSON.stringify(result).slice(0, 500));
} catch (err) {
  console.error("Migration FAILED:", err.message);
  process.exit(1);
}

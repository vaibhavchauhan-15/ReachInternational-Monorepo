import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2]?.replace(/^['"]|['"]$/g, "").trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY;

function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const cookiesMap = {};
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookiesMap).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookiesMap[name] = value;
        });
      },
    },
  });

  const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: "superadmin@reachinternational.co.in",
  });

  if (linkErr) {
    console.error("Link error:", linkErr);
    process.exit(1);
  }

  await client.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  const cookieHeader = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join("; ");

  console.log("==================================================================");
  console.log("TESTING MACHINE DETAIL ROUTES (/machines/[...id])");
  console.log("==================================================================");

  // Test 1: Fetch by UUID -> Should render 200 without 404 and contain machine details
  const res1 = await httpRequest("http://localhost:3000/machines/8d0011dd-150e-4f71-b166-a8eb9e460480", {
    headers: {
      Cookie: cookieHeader,
    },
  });

  console.log("Test 1 (UUID route /machines/8d0011dd-...):");
  console.log("  Status:", res1.statusCode, "(expected: 200)");
  console.log("  Page includes 'M/C-0001':", res1.body.includes("M/C-0001"));
  console.log("  Page includes '3DX Super':", res1.body.includes("3DX Super"));
  console.log("  Page includes 'Page Not Found':", res1.body.includes("Page Not Found"));
  console.log("  Page includes 'Looks like you':", res1.body.includes("Looks like you"));

  // Test 2: Fetch by human-readable machine_id /machines/M/C-0001
  const res2 = await httpRequest("http://localhost:3000/machines/M/C-0001", {
    headers: {
      Cookie: cookieHeader,
    },
  });

  console.log("\nTest 2 (Direct M/C-0001 route /machines/M/C-0001):");
  console.log("  Status:", res2.statusCode, "(expected: 200)");
  console.log("  Page includes 'M/C-0001':", res2.body.includes("M/C-0001"));
  console.log("  Page includes '3DX Super':", res2.body.includes("3DX Super"));
  console.log("  Page includes 'Page Not Found':", res2.body.includes("Page Not Found"));
  console.log("  Page includes 'Looks like you':", res2.body.includes("Looks like you"));

  const passed =
    res1.statusCode === 200 &&
    res1.body.includes("3DX Super") &&
    !res1.body.includes("Page Not Found") &&
    !res1.body.includes("Looks like you") &&
    res2.statusCode === 200 &&
    res2.body.includes("3DX Super") &&
    res2.body.includes("M/C-0001") &&
    !res2.body.includes("Page Not Found") &&
    !res2.body.includes("Looks like you");

  console.log("\n==================================================================");
  if (passed) {
    console.log("ALL MACHINE DETAIL ROUTE TESTS PASSED CLEANLY! (100%)");
  } else {
    console.error("SOME CHECKS FAILED!");
    process.exit(1);
  }
  console.log("==================================================================");
}

run();

import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== PHASE 9: PROXY, RATE LIMITS, AND ENVIRONMENT VERIFICATION SUITE ===");

let passedChecks = 0;

async function run() {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 1: Verify next.config.ts has no serverActions.bodySizeLimit workaround
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 1] Verifying apps/web/next.config.ts has zero bodySizeLimit workarounds...");

    const nextConfigContent = fs.readFileSync("apps/web/next.config.ts", "utf8");
    assert.equal(
      nextConfigContent.includes("bodySizeLimit"),
      false,
      "apps/web/next.config.ts must not contain bodySizeLimit"
    );
    assert.equal(
      nextConfigContent.includes("serverActions:"),
      false,
      "apps/web/next.config.ts must not contain serverActions override"
    );

    passedChecks++;
    console.log("  ✓ CHECK 1 PASSED: serverActions.bodySizeLimit workaround completely eradicated.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 2: Verify proxy.ts Next-Action Header Bypass (No Raw JSON 429 to Actions)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 2] Verifying proxy.ts server action bypass for next-action header...");

    const proxyContent = fs.readFileSync("apps/web/proxy.ts", "utf8");

    // Must check for `request.headers.has("next-action")`
    assert.ok(
      proxyContent.includes('request.headers.has("next-action")'),
      "proxy.ts must detect server actions via next-action header"
    );

    // Must skip edge rate limiting when isServerAction is true
    assert.ok(
      proxyContent.includes("if (!isServerAction) {"),
      "proxy.ts must wrap edge rate limiter in if (!isServerAction) block"
    );

    passedChecks++;
    console.log("  ✓ CHECK 2 PASSED: proxy.ts skips edge rate limiter for next-action header.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 3: Verify /api/signup/upload-urls Has Dedicated Profile (30 req / 10 min)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 3] Verifying /api/signup/upload-urls dedicated rate limit profile...");

    // Check rate limiter profile definition in rate-limiter.ts
    const rateLimiterContent = fs.readFileSync("apps/web/lib/security/rate-limiter.ts", "utf8");
    assert.ok(
      rateLimiterContent.includes("SIGNUP_UPLOAD: { windowMs: 10 * 60 * 1000, maxRequests: 30 }"),
      "rate-limiter.ts must define SIGNUP_UPLOAD with 30 maxRequests and 10 minute window"
    );

    // Check proxy.ts applies SIGNUP_UPLOAD profile to /api/signup/upload-urls
    assert.ok(
      proxyContent.includes('path === "/api/signup/upload-urls"'),
      'proxy.ts must explicitly identify path === "/api/signup/upload-urls"'
    );
    assert.ok(
      proxyContent.includes("RATE_LIMIT_PROFILES.SIGNUP_UPLOAD"),
      "proxy.ts must bind RATE_LIMIT_PROFILES.SIGNUP_UPLOAD for signup uploads"
    );

    passedChecks++;
    console.log("  ✓ CHECK 3 PASSED: /api/signup/upload-urls correctly assigned 30 req / 10 min profile.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 4: Verify Per-Request React cache() on getUser() in lib/supabase/server.ts
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 4] Verifying per-request React cache() on getUser() in lib/supabase/server.ts...");

    const serverClientContent = fs.readFileSync("apps/web/lib/supabase/server.ts", "utf8");

    // Must import cache from "react"
    assert.ok(
      serverClientContent.includes('import { cache } from "react";'),
      'server.ts must import { cache } from "react"'
    );

    // Must export getCachedAuthUser wrapped in cache()
    assert.ok(
      serverClientContent.includes("export const getCachedAuthUser = cache("),
      "server.ts must define getCachedAuthUser = cache(async () => ...)"
    );

    // createSupabaseServerClient must wrap client.auth.getUser
    assert.ok(
      serverClientContent.includes("client.auth.getUser = "),
      "server.ts must wrap client.auth.getUser to delegate to getCachedAuthUser"
    );

    passedChecks++;
    console.log("  ✓ CHECK 4 PASSED: getUser() correctly wrapped in React cache() per request.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 5: Verify Environment Variables in apps/web/.env.example & lib/env/server.ts
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 5] Verifying environment variable coverage and configuration...");

    const envExampleContent = fs.readFileSync("apps/web/.env.example", "utf8");
    const serverEnvContent = fs.readFileSync("apps/web/lib/env/server.ts", "utf8");

    const requiredKeys = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPLOAD_SESSION_SECRET",
      "CRON_SECRET",
      "NEXT_PUBLIC_APP_URL",
    ];

    for (const key of requiredKeys) {
      assert.ok(
        envExampleContent.includes(key),
        `.env.example must document ${key}`
      );
    }

    assert.ok(serverEnvContent.includes("getUpstashRedisConfig"), "server.ts must export Upstash config loader");
    assert.ok(serverEnvContent.includes("getUploadSessionSecret"), "server.ts must export upload session secret loader");
    assert.ok(serverEnvContent.includes("getCronSecret"), "server.ts must export cron secret loader");

    // Verify local .env.local has NEXT_PUBLIC_APP_URL and secrets
    const localEnv = fs.readFileSync("apps/web/.env.local", "utf8");
    assert.ok(localEnv.includes("NEXT_PUBLIC_APP_URL="), ".env.local must have NEXT_PUBLIC_APP_URL");
    assert.ok(localEnv.includes("UPLOAD_SESSION_SECRET="), ".env.local must have UPLOAD_SESSION_SECRET");
    assert.ok(localEnv.includes("CRON_SECRET="), ".env.local must have CRON_SECRET");

    passedChecks++;
    console.log("  ✓ CHECK 5 PASSED: All Phase 9 environment variables documented and verified.");

    console.log("\n========================================================");
    console.log(`ALL ${passedChecks}/5 PHASE 9 VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ PHASE 9 VERIFICATION SUITE FAILED:", err);
    process.exit(1);
  }
}

run();

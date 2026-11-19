const { execSync } = require("child_process");

const isCloudflare = Boolean(
  process.env.WORKERS_CI === "1" ||
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE === "1" ||
  process.env.WORKERS_CI_BUILD_UUID
);

const isNetlify = Boolean(
  process.env.NETLIFY === "true" ||
  process.env.NETLIFY === "1"
);

if (isCloudflare) {
  console.log("⚡ [Build Dispatcher] Cloudflare Workers CI environment detected.");

  // Ensure essential public environment variables exist during CI build
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dhbbgfzbyatzvqafnsqp.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_FL-1BqCcGNxYByFYzrBWuA_BvHMxVis";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYmJnZnpieWF0enZxYWZuc3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NTQyNDcsImV4cCI6MjEwMTIzMDI0N30.4ZHaKqZ-VIzB2-6kOkhIA-j0xpCmN5j5pJIWpfdyat8";
  process.env.NEXT_PUBLIC_APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || "https://dashboard-reachinternational.vercel.app";
  process.env.NEXT_PUBLIC_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.5.0";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-DC126P3SM9";
  process.env.NEXT_PUBLIC_ENABLE_AGENTATION = process.env.NEXT_PUBLIC_ENABLE_AGENTATION || "false";
  process.env.NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH = process.env.NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH || "true";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BICrnhbND6KveFxhqPQt1n7tZINfLxQJ0eD2oh0N_49hwW2Y-jCNOnAOkXR9lL342S-fYVDlQbjq7erm8q21xuA";
  process.env.NODE_ENV = "production";

  // Run patch-opennext to ensure patches are applied on CI runner
  try {
    console.log("   Verifying OpenNext patches...");
    require("./patch-opennext.js");
  } catch (err) {
    console.warn("   [Build Dispatcher] patch-opennext notice:", err.message);
  }

  console.log("   Executing OpenNext Cloudflare worker build (`pnpm run build:worker`)...");
  execSync("pnpm run build:worker", { stdio: "inherit", env: process.env });
} else if (isNetlify) {
  console.log("🌐 [Build Dispatcher] Netlify environment detected.");

  // Ensure essential public environment variables exist during CI build
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dhbbgfzbyatzvqafnsqp.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_FL-1BqCcGNxYByFYzrBWuA_BvHMxVis";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoYmJnZnpieWF0enZxYWZuc3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NTQyNDcsImV4cCI6MjEwMTIzMDI0N30.4ZHaKqZ-VIzB2-6kOkhIA-j0xpCmN5j5pJIWpfdyat8";
  process.env.NEXT_PUBLIC_APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://dashboard-reachinternational.vercel.app";
  process.env.NEXT_PUBLIC_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.5.0";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-DC126P3SM9";
  process.env.NEXT_PUBLIC_ENABLE_AGENTATION = process.env.NEXT_PUBLIC_ENABLE_AGENTATION || "false";
  process.env.NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH = process.env.NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH || "true";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BICrnhbND6KveFxhqPQt1n7tZINfLxQJ0eD2oh0N_49hwW2Y-jCNOnAOkXR9lL342S-fYVDlQbjq7erm8q21xuA";
  process.env.NODE_ENV = "production";

  console.log("   Executing Turborepo web build (`turbo run build --filter=@reachinternational/web`)...");
  execSync("turbo run build --filter=@reachinternational/web", { stdio: "inherit", env: process.env });
} else {
  console.log("🚀 [Build Dispatcher] Standard / Vercel build environment detected.");
  console.log("   Executing Turborepo build (`turbo run build`)...");
  execSync("turbo run build", { stdio: "inherit" });
}

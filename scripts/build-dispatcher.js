const { execSync } = require("child_process");

const isCloudflare = Boolean(
  process.env.WORKERS_CI === "1" ||
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE === "1" ||
  process.env.WORKERS_CI_BUILD_UUID
);

if (isCloudflare) {
  console.log("⚡ [Build Dispatcher] Cloudflare Workers CI environment detected.");
  console.log("   Executing OpenNext Cloudflare worker build (`pnpm run build:worker`)...");
  execSync("pnpm run build:worker", { stdio: "inherit" });
} else {
  console.log("🚀 [Build Dispatcher] Standard / Vercel build environment detected.");
  console.log("   Executing Turborepo build (`turbo run build`)...");
  execSync("turbo run build", { stdio: "inherit" });
}

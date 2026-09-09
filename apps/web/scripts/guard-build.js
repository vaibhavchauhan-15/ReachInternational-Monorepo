const net = require("net");
const fs = require("fs");
const path = require("path");

if (
  process.env.CI ||
  process.env.VERCEL ||
  process.env.SKIP_BUILD_GUARD === "1" ||
  process.env.SKIP_BUILD_GUARD === "true"
) {
  process.exit(0);
}

const port = parseInt(process.env.PORT || "3000", 10);
const client = new net.Socket();
client.setTimeout(600);

client.connect(port, "127.0.0.1", () => {
  client.destroy();
  console.error(
    `\n❌ [Build Guard Error] Next.js dev server is actively running on port ${port}.\n` +
      `   Running 'pnpm build' concurrently corrupts the shared '.next' compiler cache.\n` +
      `   Please stop the dev server (Ctrl+C in your dev terminal) before running 'pnpm build'.\n`
  );
  process.exit(1);
});

client.on("error", () => {
  cleanStaleDevArtifacts();
  process.exit(0);
});

client.on("timeout", () => {
  client.destroy();
  cleanStaleDevArtifacts();
  process.exit(0);
});

function cleanStaleDevArtifacts() {
  try {
    const devPath = path.resolve(".next", "dev");
    if (fs.existsSync(devPath)) {
      fs.rmSync(devPath, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

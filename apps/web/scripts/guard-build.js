const net = require("net");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// ============================================================================
// guard-build.js — Pre-build Concurrency Guard for Next.js on Windows
// ============================================================================
// Prevents filesystem collisions inside '.next' by verifying that no Next.js
// development server is actively running before allowing 'next build' to compile.
// ============================================================================

if (
  process.env.CI ||
  process.env.VERCEL ||
  process.env.SKIP_BUILD_GUARD === "1" ||
  process.env.SKIP_BUILD_GUARD === "true"
) {
  process.exit(0);
}

function getActiveDevProcess() {
  if (process.platform !== "win32") return null;
  try {
    const currentPid = process.pid;
    const parentPid = process.ppid;
    const stdout = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation",
      ],
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    );

    const lines = stdout.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^"(\d+)",\s*"(.*)"$/s);
      if (match) {
        const pid = parseInt(match[1], 10);
        const cmd = match[2].replace(/""/g, '"');
        if (isNaN(pid) || pid === currentPid || pid === parentPid) continue;

        const isThisProject = cmd.toLowerCase().includes("reachinternational");
        const isDev =
          isThisProject &&
          (cmd.includes(".next\\dev") ||
            cmd.includes("start-server.js") ||
            (cmd.includes("next") && /\bdev\b/i.test(cmd)) ||
            cmd.includes("guard-dev.js"));

        if (isDev) {
          return { pid, cmd };
        }
      }
    }
  } catch {
    /* best effort process inspection */
  }
  return null;
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    let resolved = false;
    let checked = 0;
    const hosts = ["127.0.0.1", "::1"];

    hosts.forEach((host) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.connect(port, host, () => {
        socket.destroy();
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });
      socket.on("error", () => {
        checked++;
        if (checked === hosts.length && !resolved) {
          resolved = true;
          resolve(false);
        }
      });
      socket.on("timeout", () => {
        socket.destroy();
        checked++;
        if (checked === hosts.length && !resolved) {
          resolved = true;
          resolve(false);
        }
      });
    });
  });
}

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

async function main() {
  // Check 1: Active dev process check
  const activeDev = getActiveDevProcess();
  if (activeDev) {
    console.error(
      `\n❌ [Build Guard Error] Next.js dev server is actively running (PID ${activeDev.pid}).\n` +
        `   Running 'pnpm build' concurrently corrupts shared '.next' compiler artifacts.\n` +
        `   Please stop the dev server (Ctrl+C in your dev terminal) before running 'pnpm build'.\n`
    );
    process.exit(1);
  }

  // Check 2: Dual-stack IPv4/IPv6 port check
  const port = parseInt(process.env.PORT || "3000", 10);
  const portInUse = await checkPortInUse(port);
  if (portInUse) {
    console.error(
      `\n❌ [Build Guard Error] Port ${port} is actively in use (likely Next.js dev server).\n` +
        `   Running 'pnpm build' concurrently corrupts shared '.next' compiler artifacts.\n` +
        `   Please stop the dev server (Ctrl+C in your dev terminal) before running 'pnpm build'.\n`
    );
    process.exit(1);
  }

  // Check 3: Pristine isolation — purge stale dev artifacts
  cleanStaleDevArtifacts();
  process.exit(0);
}

main();

const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

// ============================================================================
// guard-dev.js — Pre-dev cleanup for Next.js 16 Turbopack on Windows
// ============================================================================
// Prevents RocksDB SST file-lock corruption and missing runtime chunk errors
// by killing orphaned node processes and cleaning stale build artifacts before
// booting the dev server.
// ============================================================================

const NEXT_DIR = path.resolve(".next");
const DEV_DIR = path.resolve(".next", "dev");
const LOCK_FILE = path.resolve(".next", "dev", "lock");
const TURBO_CACHE_DIR = path.resolve(".turbo");

// Directories that must be cleaned before dev starts
const dirsToClean = [
  path.resolve(".next", "dev"),
  path.resolve(".next", "server"),
];

// Stale production artifacts at .next root that contaminate dev
const staleRootArtifacts = [
  "BUILD_ID",
  "build-manifest.json",
  "fallback-build-manifest.json",
  "routes-manifest.json",
  "app-path-routes-manifest.json",
  "export-marker.json",
  "images-manifest.json",
  "prerender-manifest.json",
  "required-server-files.js",
  "required-server-files.json",
  "next-server.js.nft.json",
  "next-minimal-server.js.nft.json",
  "trace",
  "trace-build",
  "package.json",
];

const staleRootDirs = ["build", "server", "static"];

// Helper: Safely enumerate all active node.exe processes with command lines on Windows
function getNodeProcesses() {
  if (process.platform !== "win32") return [];
  try {
    const stdout = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation",
      ],
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    );

    const processes = [];
    const lines = stdout.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const match = line.match(/^"(\d+)",\s*"(.*)"$/s);
      if (match) {
        const pid = parseInt(match[1], 10);
        const cmd = match[2].replace(/""/g, '"');
        processes.push({ pid, cmd });
      }
    }
    return processes;
  } catch {
    return [];
  }
}

// Step 0: Abort if 'next build' is actively compiling to prevent file collisions
function checkActiveBuild() {
  if (process.platform !== "win32") return;
  try {
    const currentPid = process.pid;
    const parentPid = process.ppid;
    const processes = getNodeProcesses();

    for (const proc of processes) {
      const { pid, cmd } = proc;
      if (isNaN(pid) || pid === currentPid || pid === parentPid) continue;

      const isThisProject = cmd.toLowerCase().includes("reachinternational");
      if (!isThisProject) continue;

      const isDev =
        cmd.includes(".next\\dev") ||
        cmd.includes("start-server.js") ||
        (cmd.includes("next") && /\bdev\b/i.test(cmd)) ||
        cmd.includes("guard-dev.js");

      const isBuild =
        !isDev &&
        (((cmd.includes("next") || cmd.includes("turbopack")) && /\bbuild\b/i.test(cmd)) ||
          cmd.includes("guard-build.js"));

      if (isBuild) {
        console.error(
          `\n❌ [Dev Guard Error] 'next build' is actively running in another process (PID ${pid}).\n` +
            `   Running dev concurrently corrupts the shared '.next' build manifests.\n` +
            `   Please wait for 'next build' to complete before running 'pnpm dev'.\n`
        );
        process.exit(1);
      }
    }
  } catch {
    /* best effort */
  }
}

// Step 1: Kill orphaned node processes holding .next/dev locks (Windows-specific)
function killOrphanedNodeProcesses() {
  if (process.platform !== "win32") return;

  try {
    const currentPid = process.pid;
    const parentPid = process.ppid;

    // 1. Kill any process holding the dev server port (default 3000)
    const port = process.env.PORT || "3000";
    try {
      const netstatOut = execSync(`netstat -ano -p tcp`, { encoding: "utf-8", timeout: 3000 });
      for (const line of netstatOut.split("\n")) {
        if (line.includes(`:${port} `) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(pid) && pid !== currentPid && pid !== parentPid) {
            try {
              execSync(`taskkill /PID ${pid} /F`, { timeout: 3000, stdio: ["pipe", "pipe", "pipe"] });
              console.warn(`   Killed process PID ${pid} listening on port ${port}`);
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* best effort */
    }

    // 2. Surgical search for Next.js DEV server processes belonging to this repo
    const processes = getNodeProcesses();
    for (const proc of processes) {
      const { pid, cmd } = proc;
      if (isNaN(pid) || pid === currentPid || pid === parentPid) continue;

      const isThisProject = cmd.toLowerCase().includes("reachinternational");
      if (!isThisProject) continue;

      // CRITICAL: NEVER terminate an active build process or build worker
      const isDev =
        cmd.includes(".next\\dev") ||
        cmd.includes("start-server.js") ||
        (cmd.includes("next") && /\bdev\b/i.test(cmd)) ||
        cmd.includes("guard-dev.js");

      const isBuild =
        !isDev &&
        (((cmd.includes("next") || cmd.includes("turbopack")) && /\bbuild\b/i.test(cmd)) ||
          cmd.includes("guard-build.js"));

      if (isBuild) continue;

      // Only terminate orphaned dev servers
      const isNextDev =
        cmd.includes(".next\\dev") ||
        cmd.includes("start-server.js") ||
        (cmd.includes("next") && /\bdev\b/i.test(cmd));

      if (isNextDev) {
        try {
          execSync(`taskkill /PID ${pid} /F`, {
            timeout: 3000,
            stdio: ["pipe", "pipe", "pipe"],
          });
          console.warn(`   Killed orphaned dev process PID ${pid}`);
        } catch {
          // Process may have already exited
        }
      }
    }

    // Brief delay to let OS release file handles
    const start = Date.now();
    while (Date.now() - start < 300) {
      /* spin wait for handle release */
    }
  } catch {
    // Non-critical — continue with cleanup attempt
  }
}

// Step 2: Clean stale production build artifacts from .next root
function cleanStaleProductionArtifacts() {
  if (!fs.existsSync(NEXT_DIR)) return;

  for (const file of staleRootArtifacts) {
    try {
      const filePath = path.resolve(NEXT_DIR, file);
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    } catch { /* best effort */ }
  }

  for (const dir of staleRootDirs) {
    try {
      const dirPath = path.resolve(NEXT_DIR, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch { /* best effort */ }
  }
}

// Step 3: Clean dev and server directories (Turbopack RocksDB cache)
function cleanDevDirectories() {
  for (const dir of dirsToClean) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (err) {
      // If cleanup fails even after killing orphans, warn the user
      console.error(
        `\n⚠️  [Dev Guard] Could not clean ${path.relative(process.cwd(), dir)}.\n` +
        `   A process may still be locking files. Try:\n` +
        `     1. Close all terminals running this project\n` +
        `     2. Run: taskkill /IM node.exe /F\n` +
        `     3. Manually delete the .next folder\n` +
        `     4. Run: pnpm dev\n`
      );
    }
  }
}

// Step 4: Clean Turborepo task cache to prevent stale predev commands
function cleanTurboCache() {
  try {
    if (fs.existsSync(TURBO_CACHE_DIR)) {
      fs.rmSync(TURBO_CACHE_DIR, { recursive: true, force: true });
    }
  } catch { /* best effort */ }
}

// Execute all steps in order
checkActiveBuild();
killOrphanedNodeProcesses();
cleanStaleProductionArtifacts();
cleanDevDirectories();
cleanTurboCache();

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const filesToCheck = [
  "SECURITY.md",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/mobile/AGENTS.md",
  ...fs.readdirSync("security").map((f) => path.join("security", f)),
  ...fs.readdirSync("apps/web/security").map((f) => path.join("apps/web/security", f)),
  ...fs.readdirSync("apps/mobile/security").map((f) => path.join("apps/mobile/security", f)),
];

const errors = [];
let checkedLinksCount = 0;

for (const relFile of filesToCheck) {
  const file = path.resolve(rootDir, relFile);
  if (!file.endsWith(".md") || !fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);

  // Match markdown links: [text](target)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[2].trim();
    // Skip external http/https, mailto, anchor only (#)
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:") ||
      rawTarget.startsWith("#")
    ) {
      continue;
    }

    // Strip anchors
    const targetPath = rawTarget.split("#")[0];
    if (!targetPath) continue;

    checkedLinksCount++;

    let resolved;
    if (targetPath.startsWith("file:///")) {
      let p = targetPath.replace("file:///", "").replace(/%20/g, " ");
      resolved = path.normalize(p);
    } else {
      resolved = path.resolve(dir, targetPath);
    }

    if (!fs.existsSync(resolved)) {
      errors.push({ file: relFile, link: rawTarget, resolved });
    }
  }
}

console.log(`Checked ${checkedLinksCount} relative links across ${filesToCheck.length} files.`);
if (errors.length > 0) {
  console.error("BROKEN LINKS FOUND:", errors);
  process.exit(1);
} else {
  console.log("SUCCESS: All relative links are valid and exist on disk!");
}

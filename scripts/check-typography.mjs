import fs from 'node:fs';
import path from 'node:path';

const TARGET_DIRS = [
  'apps/mobile/app',
  'apps/mobile/components',
  'apps/mobile/lib',
];

const IGNORE_PATTERNS = [
  path.normalize('components/ui/Text.tsx'),
  path.normalize('lib/typography/'),
];

const PROP_REGEX = /\b(fontSize|fontFamily|fontWeight|lineHeight|letterSpacing)\b/;

let count = 0;
const matches = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const normalized = path.normalize(fullPath);
      if (IGNORE_PATTERNS.some((p) => normalized.includes(p))) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (PROP_REGEX.test(lines[i])) {
          count++;
          if (matches.length < 10) {
            matches.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
  }
}

for (const dir of TARGET_DIRS) {
  scanDir(path.resolve(process.cwd(), dir));
}

console.log(`Found ${count} typography property instances across apps/mobile.`);
if (count > 0) {
  console.error(`ERROR: ${count} raw typography property instances detected across apps/mobile.`);
  console.error(`Sample instances:\n  ${matches.join('\n  ')}`);
  console.error('\nTypography properties must not be defined manually. Use canonical <Text variant="..."> or useTypeStyle().');
  process.exit(1);
}

console.log('Typography check passed cleanly: 0 raw typography properties found.');
process.exit(0);

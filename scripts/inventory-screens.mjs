import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'apps', 'mobile', 'app');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full, fileList);
    } else if (full.endsWith('.tsx')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const screenFiles = walk(appDir);
console.log(`Auditing ${screenFiles.length} screens:\n`);

const screenInventory = [];

for (const screenPath of screenFiles) {
  const rel = path.relative(rootDir, screenPath).replace(/\\/g, '/');
  const content = fs.readFileSync(screenPath, 'utf8');

  // Check imports
  const usesRNTextInput = /import\s*\{[^}]*\bTextInput\b[^}]*\}\s*from\s*['"]react-native['"]/.test(content);
  const usesRNSwitch = /import\s*\{[^}]*\bSwitch\b[^}]*\}\s*from\s*['"]react-native['"]/.test(content);
  const usesRNAlert = /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/.test(content);
  const usesRNRInput = /import\s*\{[^}]*\bInput\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRButton = /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRCard = /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRBadge = /import\s*\{[^}]*\bBadge\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRSwitch = /import\s*\{[^}]*\bSwitch\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRAvatar = /import\s*\{[^}]*\bAvatar\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRTabs = /import\s*\{[^}]*\bTabs\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRSeparator = /import\s*\{[^}]*\bSeparator\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);
  const usesRNRSkeleton = /import\s*\{[^}]*\bSkeleton\b[^}]*\}\s*from\s*['"]@\/components\/ui/.test(content);

  screenInventory.push({
    screen: rel,
    usesRNTextInput,
    usesRNSwitch,
    usesRNAlert,
    usesRNRInput,
    usesRNRButton,
    usesRNRCard,
    usesRNRBadge,
    usesRNRSwitch,
    usesRNRAvatar,
    usesRNRTabs,
    usesRNRSeparator,
    usesRNRSkeleton,
  });
}

for (const s of screenInventory) {
  console.log(`[Screen]: ${s.screen}`);
  const legacy = [];
  if (s.usesRNTextInput) legacy.push('RN TextInput');
  if (s.usesRNSwitch) legacy.push('RN Switch');
  if (s.usesRNAlert) legacy.push('RN Alert');
  if (legacy.length > 0) console.log(`   ⚠️ Legacy RN primitives: ${legacy.join(', ')}`);

  const rnr = [];
  if (s.usesRNRButton) rnr.push('Button');
  if (s.usesRNRInput) rnr.push('Input');
  if (s.usesRNRCard) rnr.push('Card');
  if (s.usesRNRBadge) rnr.push('Badge');
  if (s.usesRNRSwitch) rnr.push('Switch');
  if (s.usesRNRAvatar) rnr.push('Avatar');
  if (s.usesRNRTabs) rnr.push('Tabs');
  if (s.usesRNRSeparator) rnr.push('Separator');
  if (s.usesRNRSkeleton) rnr.push('Skeleton');
  console.log(`   ✨ RNR primitives: ${rnr.join(', ') || 'None'}`);
}

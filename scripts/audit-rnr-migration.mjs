import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'apps', 'mobile');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.expo' && file !== '.git') {
        walk(full, fileList);
      }
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allMobileFiles = walk(mobileDir);
console.log(`Total mobile source files scanned: ${allMobileFiles.length}`);

// Inspect screens
const screenFiles = allMobileFiles.filter(f => f.includes(path.join('apps', 'mobile', 'app')));
console.log(`Total mobile screen/route files: ${screenFiles.length}`);

// Inspect UI components
const uiComponentFiles = allMobileFiles.filter(f => f.includes(path.join('apps', 'mobile', 'components', 'ui')));
console.log(`Total UI primitive files in components/ui: ${uiComponentFiles.length}`);

// Inspect other components
const featureComponentFiles = allMobileFiles.filter(f => 
  f.includes(path.join('apps', 'mobile', 'components')) && 
  !f.includes(path.join('apps', 'mobile', 'components', 'ui'))
);
console.log(`Total feature component files: ${featureComponentFiles.length}`);

// Search for imports in screens & feature components
const directImports = {
  RNText: [],
  RNTextInput: [],
  RNSwitch: [],
  RNButton: [],
  RNModal: [],
  RNAlert: [],
  RNTouchableOpacity: [],
  RNTouchableHighlight: [],
  RNTouchableWithoutFeedback: [],
};

const rnrUsage = {
  Button: [],
  IconButton: [],
  Text: [],
  Card: [],
  Badge: [],
  Input: [],
  Checkbox: [],
  Switch: [],
  Radio: [],
  RadioGroup: [],
  Dialog: [],
  AlertDialog: [],
  ConfirmDialog: [],
  Tabs: [],
  Progress: [],
  Tooltip: [],
  Popover: [],
  Separator: [],
  Avatar: [],
  Skeleton: [],
  EmptyState: [],
  Alert: [],
};

const nonUiFiles = allMobileFiles.filter(f => !f.includes(path.join('apps', 'mobile', 'components', 'ui')));

for (const file of nonUiFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');

  // Check react-native imports
  const rnImports = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]react-native['"]/g);
  if (rnImports) {
    for (const statement of rnImports) {
      const match = statement.match(/\{([^}]+)\}/);
      if (match) {
        const tokens = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
        if (tokens.includes('Text')) directImports.RNText.push(rel);
        if (tokens.includes('TextInput')) directImports.RNTextInput.push(rel);
        if (tokens.includes('Switch')) directImports.RNSwitch.push(rel);
        if (tokens.includes('Button')) directImports.RNButton.push(rel);
        if (tokens.includes('Modal')) directImports.RNModal.push(rel);
        if (tokens.includes('Alert')) directImports.RNAlert.push(rel);
        if (tokens.includes('TouchableOpacity')) directImports.RNTouchableOpacity.push(rel);
        if (tokens.includes('TouchableHighlight')) directImports.RNTouchableHighlight.push(rel);
        if (tokens.includes('TouchableWithoutFeedback')) directImports.RNTouchableWithoutFeedback.push(rel);
      }
    }
  }

  // Check RNR usage
  for (const comp of Object.keys(rnrUsage)) {
    const regex = new RegExp(`\\b${comp}\\b`);
    if (regex.test(content) && (content.includes(`components/ui`) || content.includes(`@/components/ui`))) {
      rnrUsage[comp].push(rel);
    }
  }
}

console.log('\n--- DIRECT REACT NATIVE PRIMITIVE IMPORTS (OUTSIDE components/ui) ---');
for (const [key, list] of Object.entries(directImports)) {
  console.log(`${key} (${list.length} files):`);
  list.forEach(f => console.log(`  - ${f}`));
}

console.log('\n--- REACT NATIVE REUSABLES / UI PRIMITIVES USAGE SUMMARY ---');
for (const [comp, list] of Object.entries(rnrUsage)) {
  console.log(`${comp}: used in ${list.length} files`);
}

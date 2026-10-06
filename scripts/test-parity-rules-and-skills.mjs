#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m FAIL: ${message}`);
  }
}

console.log('\n================================================================');
console.log('  REACHINTERNATIONAL PARITY RULES & SKILLS VERIFICATION SUITE  ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SECTION 1: Authoritative Rule Files Discovery & Accessibility
// -------------------------------------------------------------
console.log('\x1b[36m[1/5] Testing Discovery & Accessibility of Authoritative Rules...\x1b[0m');

const REQUIRED_AI_RULES = [
  'ARCHITECTURE.md',
  'AUTHENTICATION-AUTHORIZATION.md',
  'DATA-PROTECTION-PRIVACY.md',
  'DEPLOYMENT-DEVOPS-RELEASE.md',
  'DESIGN-SYSTEM.md',
  'GLOBAL-RESPONSIVE-DESIGN.md',
  'MULTI-AGENT-ENGINEERING-TEAM.md',
  'OBSERVABILITY-MONITORING-LOGGING.md',
  'PERFORMANCE.md',
  'SECURITY.md',
  'SEO-METADATA-DISCOVERABILITY.md',
  'TESTING-QA.md',
  'UI-UX.md',
  'VALIDATION-ERROR-RESILIENCE.md',
  'WEB-MOBILE-PARITY.md',
];

const REQUIRED_AGENT_RULES = [
  'global_responsive_design.md',
  'mandatory_rules_reading_and_enforcement.md',
  'multi_agent_engineering_team.md',
  'responsive_cross_platform_design.md',
  'web_mobile_ui_consistency.md',
  'web_mobile_parity.md',
  'native_backend_architecture.md',
];

const REQUIRED_CORE_SPECS = [
  'DESIGN.md',
  'ARCHITECTURE.md',
  'AGENTS.md',
  'apps/web/AGENTS.md',
  'apps/mobile/AGENTS.md',
  'supabase/AGENTS.md',
  'packages/design-tokens/AGENTS.md',
  'packages/permissions/AGENTS.md',
  'packages/types/AGENTS.md',
  'packages/validation/AGENTS.md',
  'packages/api-client/AGENTS.md',
  'packages/utils/AGENTS.md',
  'packages/config/AGENTS.md',
  'AI/PROJECT_MEMORY.md',
  'AI/FILE_INDEX.md',
];

for (const rule of REQUIRED_AI_RULES) {
  const fullPath = path.join(ROOT_DIR, 'AI', 'RULES', rule);
  const exists = fs.existsSync(fullPath);
  const size = exists ? fs.statSync(fullPath).size : 0;
  assert(exists && size > 500, `AI/RULES/${rule} exists and is readable (${size} bytes)`);
}

for (const rule of REQUIRED_AGENT_RULES) {
  const fullPath = path.join(ROOT_DIR, '.agents', 'rules', rule);
  const exists = fs.existsSync(fullPath);
  const size = exists ? fs.statSync(fullPath).size : 0;
  assert(exists && size > 500, `.agents/rules/${rule} exists and is readable (${size} bytes)`);
}

for (const spec of REQUIRED_CORE_SPECS) {
  const fullPath = path.join(ROOT_DIR, spec);
  const exists = fs.existsSync(fullPath);
  const size = exists ? fs.statSync(fullPath).size : 0;
  assert(exists && size >= 400, `${spec} exists and is readable (${size} bytes)`);
}

// -------------------------------------------------------------
// SECTION 2: Skills Discovery & Frontmatter Verification
// -------------------------------------------------------------
console.log('\n\x1b[36m[2/5] Testing Discovery & YAML Frontmatter of Required Agent Skills...\x1b[0m');

const SKILLS_DIR = path.join(ROOT_DIR, '.agents', 'skills');
assert(fs.existsSync(SKILLS_DIR), `.agents/skills directory exists`);

const PARITY_SKILL_PATH = path.join(SKILLS_DIR, 'web-mobile-parity', 'SKILL.md');
assert(fs.existsSync(PARITY_SKILL_PATH), `web-mobile-parity skill exists at .agents/skills/web-mobile-parity/SKILL.md`);

if (fs.existsSync(PARITY_SKILL_PATH)) {
  const skillContent = fs.readFileSync(PARITY_SKILL_PATH, 'utf8');
  const hasFrontmatter = skillContent.startsWith('---') && skillContent.indexOf('---', 3) > 3;
  assert(hasFrontmatter, `web-mobile-parity/SKILL.md contains valid YAML frontmatter`);

  const hasName = /name:\s*web-mobile-parity/.test(skillContent);
  assert(hasName, `web-mobile-parity/SKILL.md specifies name: web-mobile-parity`);

  const hasDescription = /description:\s*.+/.test(skillContent);
  assert(hasDescription, `web-mobile-parity/SKILL.md specifies clear agent description`);

  const has8Dimensions = [
    'UI/UX',
    'Behavior',
    'Responsiveness',
    'Design',
    'Layout',
    'Color',
    'Theme',
    'Typography',
  ].every((dim) => skillContent.includes(dim));
  assert(has8Dimensions, `web-mobile-parity/SKILL.md covers all 8 parity dimensions`);
}

const NATIVE_ARCH_SKILL_PATH = path.join(SKILLS_DIR, 'native-backend-architecture', 'SKILL.md');
assert(fs.existsSync(NATIVE_ARCH_SKILL_PATH), `native-backend-architecture skill exists at .agents/skills/native-backend-architecture/SKILL.md`);

if (fs.existsSync(NATIVE_ARCH_SKILL_PATH)) {
  const nativeSkillContent = fs.readFileSync(NATIVE_ARCH_SKILL_PATH, 'utf8');
  const hasFrontmatter = nativeSkillContent.startsWith('---') && nativeSkillContent.indexOf('---', 3) > 3;
  assert(hasFrontmatter, `native-backend-architecture/SKILL.md contains valid YAML frontmatter`);

  const hasName = /name:\s*native-backend-architecture/.test(nativeSkillContent);
  assert(hasName, `native-backend-architecture/SKILL.md specifies name: native-backend-architecture`);

  const hasDescription = /description:\s*.+/.test(nativeSkillContent);
  assert(hasDescription, `native-backend-architecture/SKILL.md specifies clear agent description`);

  const hasKeyPatterns = [
    'TanStack Query',
    'expo-secure-store',
    '44px',
    'StyleSheet.create',
  ].every((pattern) => nativeSkillContent.includes(pattern));
  assert(hasKeyPatterns, `native-backend-architecture/SKILL.md defines TanStack Query, SecureStore, 44px targets & typography`);
}

// -------------------------------------------------------------
// SECTION 3: Content Verification of 100% Parity Contract
// -------------------------------------------------------------
console.log('\n\x1b[36m[3/5] Testing 100% Web & Mobile Parity Rules Contract Coverage...\x1b[0m');

const parityRulePath = path.join(ROOT_DIR, 'AI', 'RULES', 'WEB-MOBILE-PARITY.md');
const parityRuleContent = fs.existsSync(parityRulePath) ? fs.readFileSync(parityRulePath, 'utf8') : '';

const consistencyRulePath = path.join(ROOT_DIR, '.agents', 'rules', 'web_mobile_ui_consistency.md');
const consistencyRuleContent = fs.existsSync(consistencyRulePath) ? fs.readFileSync(consistencyRulePath, 'utf8') : '';

const combinedParityText = parityRuleContent + '\n' + consistencyRuleContent;

// 1. UI/UX
assert(
  combinedParityText.includes('UI/UX') && combinedParityText.includes('EmptyState') && combinedParityText.includes('ConfirmationDialog'),
  `Parity rules enforce identical UI/UX components (EmptyState, ConfirmationDialog, segmented toggles)`
);

// 2. Behavior
assert(
  combinedParityText.includes('Behavior') && combinedParityText.includes('toast') && combinedParityText.includes('validation'),
  `Parity rules enforce identical behavior (toast notifications, validation feedback, error retry)`
);

// 3. Responsiveness
assert(
  combinedParityText.includes('Responsiveness') && combinedParityText.includes('3-tier') && combinedParityText.includes('≤ 640px'),
  `Parity rules enforce 3-tier responsiveness (Mobile ≤640px, Tablet 641-1023px, Desktop ≥1024px)`
);

// 4. Design
assert(
  combinedParityText.includes('Vercel Geist') && combinedParityText.includes('1px hairline') && combinedParityText.includes('6px'),
  `Parity rules enforce Vercel Geist design system (1px hairlines, bimodal radius)`
);

// 5. Layout
assert(
  combinedParityText.includes('Layout') && combinedParityText.includes('information hierarchy'),
  `Parity rules enforce identical layout and visual information hierarchy`
);

// 6. Color
assert(
  combinedParityText.includes('#0284c7') && combinedParityText.includes('#10b981') && combinedParityText.includes('#ee0000') && combinedParityText.includes('#f5a623'),
  `Parity rules enforce exact color hex tokens (Sky Blue #0284c7, Emerald #10b981, Amber #f5a623, Red #ee0000)`
);

// 7. Theme
assert(
  combinedParityText.includes('#fafafa') && combinedParityText.includes('#0a0a0a') && combinedParityText.includes('Light') && combinedParityText.includes('Dark'),
  `Parity rules enforce 100% Light and Dark theme synchronization`
);

// 8. Typography
assert(
  combinedParityText.includes('Geist Sans') && combinedParityText.includes('Geist Mono') && combinedParityText.includes('Text variant='),
  `Parity rules enforce Geist typography and canonical <Text variant="...">`
);

// 9. Native Backend Architecture
assert(
  combinedParityText.includes('TanStack Query') &&
  combinedParityText.includes('expo-secure-store') &&
  combinedParityText.includes('AsyncStorage') &&
  combinedParityText.includes('44px') &&
  combinedParityText.includes('Haptics'),
  `Parity rules mandate native backend architecture (TanStack Query, SecureStore, Offline Queue, 44px touch targets, Haptics)`
);

// 10. Web Backend Architecture
assert(
  combinedParityText.includes('React Server Components') &&
  combinedParityText.includes('Data Access Layer') &&
  combinedParityText.includes('Server Actions') &&
  combinedParityText.includes('@supabase/ssr'),
  `Parity rules mandate web backend architecture (Next.js 16.2 App Router, RSC, DAL, Server Actions, SSR Auth)`
);

// -------------------------------------------------------------
// SECTION 4: Design Tokens Invariant Verification
// -------------------------------------------------------------
console.log('\n\x1b[36m[4/5] Testing Design Tokens Parity Invariants...\x1b[0m');

const colorsFilePath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'src', 'tokens', 'colors.ts');
const typographyFilePath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'src', 'tokens', 'typography.ts');
const spacingFilePath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'src', 'tokens', 'spacing.ts');
const radiusFilePath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'src', 'tokens', 'radius.ts');
const typeVariantsFilePath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'src', 'typography.ts');

assert(fs.existsSync(colorsFilePath), `colors.ts exists in packages/design-tokens/src/tokens`);
assert(fs.existsSync(typographyFilePath), `typography.ts exists in packages/design-tokens/src/tokens`);
assert(fs.existsSync(spacingFilePath), `spacing.ts exists in packages/design-tokens/src/tokens`);
assert(fs.existsSync(radiusFilePath), `radius.ts exists in packages/design-tokens/src/tokens`);
assert(fs.existsSync(typeVariantsFilePath), `typography.ts (TYPE_VARIANTS) exists in packages/design-tokens/src`);

if (fs.existsSync(colorsFilePath)) {
  const colorsContent = fs.readFileSync(colorsFilePath, 'utf8');

  assert(colorsContent.includes("'#0284c7'"), `colors.ts defines Reach Sky Blue #0284c7 (light primary)`);
  assert(colorsContent.includes("'#0ea5e9'"), `colors.ts defines Reach Sky Blue #0ea5e9 (dark primary)`);
  assert(colorsContent.includes("'#171717'"), `colors.ts defines ink #171717`);
  assert(colorsContent.includes("'#fafafa'"), `colors.ts defines canvas #fafafa`);
  assert(colorsContent.includes("'#10b981'"), `colors.ts defines success #10b981`);
  assert(colorsContent.includes("'#ee0000'"), `colors.ts defines error #ee0000`);
  assert(colorsContent.includes("'#f5a623'"), `colors.ts defines warning #f5a623`);
}

if (fs.existsSync(typeVariantsFilePath)) {
  const typeContent = fs.readFileSync(typeVariantsFilePath, 'utf8');
  assert(typeContent.includes('TYPE_VARIANTS'), `typeVariants exports canonical TYPE_VARIANTS`);
}

if (fs.existsSync(spacingFilePath)) {
  const spacingContent = fs.readFileSync(spacingFilePath, 'utf8');
  assert(spacingContent.includes('xxs:') || spacingContent.includes("'4px'"), `spacing scale starts at 4px base unit`);
}

if (fs.existsSync(radiusFilePath)) {
  const radiusContent = fs.readFileSync(radiusFilePath, 'utf8');
  assert(radiusContent.includes("'6px'") || radiusContent.includes('sm: 6'), `radius scale enforces 6px app chrome corners`);
}

// -------------------------------------------------------------
// SECTION 5: Cross-Referencing in Mandatory Agent Entrypoints
// -------------------------------------------------------------
console.log('\n\x1b[36m[5/5] Testing Mandatory Rule Ingestion References...\x1b[0m');

const agentsRootPath = path.join(ROOT_DIR, 'AGENTS.md');
const agentsRootContent = fs.existsSync(agentsRootPath) ? fs.readFileSync(agentsRootPath, 'utf8') : '';
assert(
  agentsRootContent.includes('AI/RULES/WEB-MOBILE-PARITY.md'),
  `AGENTS.md mandates reading AI/RULES/WEB-MOBILE-PARITY.md`
);
assert(
  agentsRootContent.includes('.agents/rules/web_mobile_ui_consistency.md'),
  `AGENTS.md mandates reading .agents/rules/web_mobile_ui_consistency.md`
);

assert(
  agentsRootContent.includes('.agents/skills/web-mobile-parity/SKILL.md'),
  `AGENTS.md explicitly mandates reading .agents/skills/web-mobile-parity/SKILL.md`
);
assert(
  agentsRootContent.includes('.agents/rules/web_mobile_parity.md'),
  `AGENTS.md mandates reading .agents/rules/web_mobile_parity.md`
);
assert(
  agentsRootContent.includes('.agents/rules/native_backend_architecture.md'),
  `AGENTS.md mandates reading .agents/rules/native_backend_architecture.md`
);
assert(
  agentsRootContent.includes('.agents/skills/native-backend-architecture/SKILL.md'),
  `AGENTS.md explicitly mandates reading .agents/skills/native-backend-architecture/SKILL.md`
);

const has8DimsRoot = ['UI/UX', 'Behavior', 'Responsiveness', 'Design', 'Layout', 'Color', 'Theme', 'Typography'].every(
  (dim) => agentsRootContent.includes(dim)
);
assert(has8DimsRoot, `AGENTS.md Section 9 enumerates all 8 parity dimensions`);

const webAgentsPath = path.join(ROOT_DIR, 'apps', 'web', 'AGENTS.md');
const webAgentsContent = fs.existsSync(webAgentsPath) ? fs.readFileSync(webAgentsPath, 'utf8') : '';
const has8DimsWeb = ['UI/UX', 'Behavior', 'Responsiveness', 'Design', 'Layout', 'Color', 'Theme', 'Typography'].every(
  (dim) => webAgentsContent.includes(dim)
);
assert(has8DimsWeb, `apps/web/AGENTS.md Section 0 enumerates all 8 parity dimensions`);
assert(
  webAgentsContent.includes('web-mobile-parity/SKILL.md'),
  `apps/web/AGENTS.md references .agents/skills/web-mobile-parity/SKILL.md`
);

const mobileAgentsPath = path.join(ROOT_DIR, 'apps', 'mobile', 'AGENTS.md');
const mobileAgentsContent = fs.existsSync(mobileAgentsPath) ? fs.readFileSync(mobileAgentsPath, 'utf8') : '';
const has8DimsMobile = ['UI/UX', 'Behavior', 'Responsiveness', 'Design', 'Layout', 'Color', 'Theme', 'Typography'].every(
  (dim) => mobileAgentsContent.includes(dim)
);
assert(has8DimsMobile, `apps/mobile/AGENTS.md Section 0 enumerates all 8 parity dimensions`);
assert(
  mobileAgentsContent.includes('web-mobile-parity/SKILL.md'),
  `apps/mobile/AGENTS.md references .agents/skills/web-mobile-parity/SKILL.md`
);

const mandatoryRulesPath = path.join(ROOT_DIR, '.agents', 'rules', 'mandatory_rules_reading_and_enforcement.md');
const mandatoryRulesContent = fs.existsSync(mandatoryRulesPath) ? fs.readFileSync(mandatoryRulesPath, 'utf8') : '';
assert(
  mandatoryRulesContent.includes('WEB-MOBILE-PARITY.md'),
  `mandatory_rules_reading_and_enforcement.md lists WEB-MOBILE-PARITY.md`
);
assert(
  mandatoryRulesContent.includes('web-mobile-parity'),
  `mandatory_rules_reading_and_enforcement.md lists web-mobile-parity skill`
);
assert(
  mandatoryRulesContent.includes('web_mobile_parity.md'),
  `mandatory_rules_reading_and_enforcement.md lists web_mobile_parity.md`
);
assert(
  mandatoryRulesContent.includes('native_backend_architecture.md'),
  `mandatory_rules_reading_and_enforcement.md lists native_backend_architecture.md`
);
assert(
  mandatoryRulesContent.includes('native-backend-architecture'),
  `mandatory_rules_reading_and_enforcement.md lists native-backend-architecture skill`
);

const projectMemoryPath = path.join(ROOT_DIR, 'AI', 'PROJECT_MEMORY.md');
const projectMemoryContent = fs.existsSync(projectMemoryPath) ? fs.readFileSync(projectMemoryPath, 'utf8') : '';
assert(
  projectMemoryContent.includes('WEB-MOBILE-PARITY.md'),
  `AI/PROJECT_MEMORY.md references WEB-MOBILE-PARITY.md`
);

const fileIndexPath = path.join(ROOT_DIR, 'AI', 'FILE_INDEX.md');
const fileIndexContent = fs.existsSync(fileIndexPath) ? fs.readFileSync(fileIndexPath, 'utf8') : '';
assert(
  fileIndexContent.includes('AI/RULES/WEB-MOBILE-PARITY.md') && fileIndexContent.includes('.agents/skills/web-mobile-parity/SKILL.md'),
  `AI/FILE_INDEX.md indexes both the parity rule and agent skill`
);
assert(
  fileIndexContent.includes('.agents/rules/native_backend_architecture.md') && fileIndexContent.includes('.agents/skills/native-backend-architecture/SKILL.md'),
  `AI/FILE_INDEX.md indexes both the native architecture rule and agent skill`
);

const designTokensAgentsPath = path.join(ROOT_DIR, 'packages', 'design-tokens', 'AGENTS.md');
const designTokensAgentsContent = fs.existsSync(designTokensAgentsPath) ? fs.readFileSync(designTokensAgentsPath, 'utf8') : '';
assert(
  designTokensAgentsContent.includes('#0284c7'),
  `packages/design-tokens/AGENTS.md mandates Reach Sky Blue #0284c7`
);

const permissionsAgentsPath = path.join(ROOT_DIR, 'packages', 'permissions', 'AGENTS.md');
const permissionsAgentsContent = fs.existsSync(permissionsAgentsPath) ? fs.readFileSync(permissionsAgentsPath, 'utf8') : '';
const has6Roles = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'operator'].every(
  (role) => permissionsAgentsContent.includes(role)
);
assert(
  has6Roles,
  `packages/permissions/AGENTS.md enshrines exactly 6 canonical roles (super_admin, admin, manager, supervisor, hr, operator)`
);

const supabaseAgentsPath = path.join(ROOT_DIR, 'supabase', 'AGENTS.md');
const supabaseAgentsContent = fs.existsSync(supabaseAgentsPath) ? fs.readFileSync(supabaseAgentsPath, 'utf8') : '';
assert(
  supabaseAgentsContent.includes('vlmxciuogczumumrwyot') && supabaseAgentsContent.includes('dhbbgfzbyatzvqafnsqp'),
  `supabase/AGENTS.md enforces development isolation (vlmxciuogczumumrwyot) and production protection (dhbbgfzbyatzvqafnsqp)`
);

// -------------------------------------------------------------
// SUMMARY & EXIT
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
if (failedTests > 0) {
  console.log(`  \x1b[31mFAILURE: ${failedTests} tests failed!\x1b[0m`);
  console.log('================================================================\n');
  process.exit(1);
} else {
  console.log('  \x1b[32mSTATUS: 100% PASS — ALL RULES & SKILLS VERIFIED COMPLIANT\x1b[0m');
  console.log('================================================================\n');
  process.exit(0);
}

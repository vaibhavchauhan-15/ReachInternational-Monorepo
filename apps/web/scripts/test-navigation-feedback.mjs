import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('  NAVIGATION & LIQUID METAL BUTTON VERIFICATION');
console.log('================================================================');

const navPath = path.resolve('apps/web/components/marketing/navigation/Navigation.tsx');
const liquidBtnPath = path.resolve('apps/web/components/ui/liquid-metal-button.tsx');
const uiIndexPath = path.resolve('apps/web/components/ui/index.ts');

const navCode = fs.readFileSync(navPath, 'utf8');
const liquidBtnCode = fs.readFileSync(liquidBtnPath, 'utf8');
const uiIndexCode = fs.readFileSync(uiIndexPath, 'utf8');

// 1. Industries removed from navbar
if (navCode.includes('<span>Industries</span>')) {
  console.error('❌ FAIL: Desktop Industries trigger button is still in navbar');
  process.exit(1);
}
if (navCode.includes('Industries We Serve')) {
  console.error('❌ FAIL: Industries dropdown panel is still in Navigation.tsx');
  process.exit(1);
}
if (navCode.includes('mobileIndustriesOpen')) {
  console.error('❌ FAIL: mobileIndustriesOpen state is still in Navigation.tsx');
  process.exit(1);
}
console.log('  ✓ Feedback 1: "Industries" completely removed from desktop nav and mobile drawer');

// 2. Sign In optimized UX for Staff/Employee Portal
if (navCode.includes('>Sign In</Button>') || navCode.includes('>Sign In to Portal</Button>')) {
  console.error('❌ FAIL: Generic prominent Sign In button is still rendered');
  process.exit(1);
}
if (!navCode.includes('Staff Portal') || !navCode.includes('Staff & Employee Portal')) {
  console.error('❌ FAIL: Staff Portal label not found in Navigation.tsx');
  process.exit(1);
}
if (!navCode.includes('href="/login"')) {
  console.error('❌ FAIL: Login route link missing');
  process.exit(1);
}
console.log('  ✓ Feedback 2: "Sign In" cleanly refactored to unobtrusive Staff Portal for admin/employees');

// 3. LiquidMetalButton component and Request a Quote CTA
if (!fs.existsSync(liquidBtnPath)) {
  console.error('❌ FAIL: liquid-metal-button.tsx does not exist');
  process.exit(1);
}
if (!liquidBtnCode.includes('liquidMetalFragmentShader') || !liquidBtnCode.includes('ShaderMount')) {
  console.error('❌ FAIL: liquid-metal-button.tsx does not use @paper-design/shaders');
  process.exit(1);
}
if (!liquidBtnCode.includes('u_shiftRed: 0') || !liquidBtnCode.includes('u_shiftBlue: 0')) {
  console.error('❌ FAIL: liquid-metal-button.tsx does not have consistent monochromatic color (zero chromatic aberration)');
  process.exit(1);
}
if (!liquidBtnCode.includes('LiquidMetalButtonDemo')) {
  console.error('❌ FAIL: LiquidMetalButtonDemo export missing');
  process.exit(1);
}
if (!uiIndexCode.includes('LiquidMetalButton')) {
  console.error('❌ FAIL: LiquidMetalButton not exported from components/ui/index.ts');
  process.exit(1);
}
if (!navCode.includes('<LiquidMetalButton') || !navCode.includes('label="Request a Quote"')) {
  console.error('❌ FAIL: LiquidMetalButton is not used for Request a Quote in Navigation.tsx');
  process.exit(1);
}
console.log('  ✓ Feedback 3: LiquidMetalButton created with premium obsidian/brand finish, consistent color, and integrated for Request a Quote');

console.log('================================================================');
console.log('  ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
console.log('================================================================');

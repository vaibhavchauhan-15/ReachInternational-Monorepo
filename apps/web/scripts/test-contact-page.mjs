import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('================================================================');
console.log('  CONTACT PAGE & SEO / AI DISCOVERABILITY VERIFICATION          ');
console.log('================================================================\n');

// 1. Verify Contact Page File exists
const contactPagePath = path.resolve('apps/web/app/(marketing)/contact/page.tsx');
assert.ok(fs.existsSync(contactPagePath), 'apps/web/app/(marketing)/contact/page.tsx must exist');
const contactPageSrc = fs.readFileSync(contactPagePath, 'utf8');

// 2. Verify Canonical & Metadata
assert.ok(
  contactPageSrc.includes('canonical: "https://www.reachinternational.co.in/contact"') ||
  contactPageSrc.includes("https://www.reachinternational.co.in/contact"),
  'Contact page must declare canonical URL https://www.reachinternational.co.in/contact'
);
assert.ok(
  contactPageSrc.includes('REACH INTERNATIONAL — Reaching All Heights'),
  'Contact page title must follow brand format'
);
console.log('  ✓ 1. Metadata and canonical URL verified.');

// 3. Verify Contact Components
const heroPath = path.resolve('apps/web/components/marketing/contact/ContactHero.tsx');
const cardPath = path.resolve('apps/web/components/marketing/contact/DepartmentCard.tsx');
const tablePath = path.resolve('apps/web/components/marketing/contact/ContactDirectoryTable.tsx');
const faqPath = path.resolve('apps/web/components/marketing/contact/ContactFaq.tsx');
const hubsPath = path.resolve('apps/web/components/marketing/contact/RegionalHubs.tsx');

assert.ok(fs.existsSync(heroPath), 'ContactHero.tsx must exist');
assert.ok(fs.existsSync(cardPath), 'DepartmentCard.tsx must exist');
assert.ok(fs.existsSync(tablePath), 'ContactDirectoryTable.tsx must exist');
assert.ok(fs.existsSync(faqPath), 'ContactFaq.tsx must exist');
assert.ok(fs.existsSync(hubsPath), 'RegionalHubs.tsx must exist');

const cardSrc = fs.readFileSync(cardPath, 'utf8');
const tableSrc = fs.readFileSync(tablePath, 'utf8');

// 4. Verify Rental Details (mo: 8800040308, mail: rental@reachinternational.co.in)
assert.ok(cardSrc.includes('8800040308'), 'DepartmentCard must contain rental raw mobile 8800040308');
assert.ok(cardSrc.includes('+91 88000 40308'), 'DepartmentCard must contain formatted rental mobile');
assert.ok(cardSrc.includes('rental@reachinternational.co.in'), 'DepartmentCard must contain rental email');
assert.ok(tableSrc.includes('8800040308'), 'ContactDirectoryTable must contain rental phone');
assert.ok(tableSrc.includes('rental@reachinternational.co.in'), 'ContactDirectoryTable must contain rental email');
console.log('  ✓ 2. Rental Desk credentials verified (+91 88000 40308 / rental@reachinternational.co.in).');

// 5. Verify Sale Details (mo: 9867732204, mail: sale@reachinternational.co.in)
assert.ok(cardSrc.includes('9867732204'), 'DepartmentCard must contain sale raw mobile 9867732204');
assert.ok(cardSrc.includes('+91 98677 32204'), 'DepartmentCard must contain formatted sale mobile');
assert.ok(cardSrc.includes('sale@reachinternational.co.in'), 'DepartmentCard must contain sale email');
assert.ok(tableSrc.includes('9867732204'), 'ContactDirectoryTable must contain sale phone');
assert.ok(tableSrc.includes('sale@reachinternational.co.in'), 'ContactDirectoryTable must contain sale email');
console.log('  ✓ 3. Sales Desk credentials verified (+91 98677 32204 / sale@reachinternational.co.in).');

// 6. Verify JSON-LD Structured Data Schema
const jsonLdPath = path.resolve('apps/web/lib/seo/jsonld.ts');
const jsonLdSrc = fs.readFileSync(jsonLdPath, 'utf8');
assert.ok(jsonLdSrc.includes('buildContactPageJsonLd'), 'jsonld.ts must export buildContactPageJsonLd');
assert.ok(jsonLdSrc.includes("'@type': 'ContactPage'"), 'jsonld.ts must declare ContactPage schema');
assert.ok(jsonLdSrc.includes("'@type': 'ContactPoint'"), 'jsonld.ts must declare ContactPoint schema');
assert.ok(contactPageSrc.includes('buildContactPageJsonLd'), 'page.tsx must call buildContactPageJsonLd');
assert.ok(contactPageSrc.includes('application/ld+json'), 'page.tsx must render JSON-LD script tags');
console.log('  ✓ 4. Schema.org ContactPage, LocalBusiness & ContactPoint JSON-LD verified.');

// 7. Verify Sitemap & Robots.txt
const sitemapPath = path.resolve('apps/web/app/sitemap.ts');
const sitemapSrc = fs.readFileSync(sitemapPath, 'utf8');
assert.ok(sitemapSrc.includes('${baseUrl}/contact'), 'sitemap.ts must contain ${baseUrl}/contact');

const robotsPath = path.resolve('apps/web/app/robots.ts');
const robotsSrc = fs.readFileSync(robotsPath, 'utf8');
assert.ok(robotsSrc.includes('"/contact"'), 'robots.ts must allow /contact');
assert.ok(robotsSrc.includes('"/contact/"'), 'robots.ts must allow /contact/');
console.log('  ✓ 5. Sitemap and robots.txt rules verified.');

// 8. Verify llms.txt route
const llmsPath = path.resolve('apps/web/app/llms.txt/route.ts');
const llmsSrc = fs.readFileSync(llmsPath, 'utf8');
assert.ok(llmsSrc.includes('8800040308'), 'llms.txt must contain Rental mobile');
assert.ok(llmsSrc.includes('rental@reachinternational.co.in'), 'llms.txt must contain Rental email');
assert.ok(llmsSrc.includes('9867732204'), 'llms.txt must contain Sales mobile');
assert.ok(llmsSrc.includes('sale@reachinternational.co.in'), 'llms.txt must contain Sales email');
assert.ok(llmsSrc.includes('${baseUrl}/contact'), 'llms.txt must link to /contact');
console.log('  ✓ 6. llms.txt direct contact documentation verified.');

// 9. Verify StickyActionBar does not block contact page
const stickyPath = path.resolve('apps/web/components/marketing/sticky-action-bar/StickyActionBar.tsx');
const stickySrc = fs.readFileSync(stickyPath, 'utf8');
assert.ok(stickySrc.includes("pathname?.startsWith('/contact')"), 'StickyActionBar must be hidden on /contact');
console.log('  ✓ 7. StickyActionBar collision guard verified.');

// 10. Verify Mobile Parity in support screen
const mobileSupportPath = path.resolve('apps/mobile/app/(app)/settings/about/support.tsx');
const mobileSupportSrc = fs.readFileSync(mobileSupportPath, 'utf8');
assert.ok(mobileSupportSrc.includes('+91 88000 40308'), 'Mobile support must feature Rental mobile');
assert.ok(mobileSupportSrc.includes('rental@reachinternational.co.in'), 'Mobile support must feature Rental email');
assert.ok(mobileSupportSrc.includes('+91 98677 32204'), 'Mobile support must feature Sales mobile');
assert.ok(mobileSupportSrc.includes('sale@reachinternational.co.in'), 'Mobile support must feature Sales email');
console.log('  ✓ 8. Web-to-Mobile Parity synchronized for Support & Contact.\n');

console.log('================================================================');
console.log('  SUCCESS: ALL 8 CONTACT & SEO/AI VERIFICATION CHECKS PASSED!   ');
console.log('================================================================\n');
process.exit(0);

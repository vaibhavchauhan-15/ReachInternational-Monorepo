import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const url = 'http://localhost:3000/about';
const runs = 3;
const results = [];

console.log(`Starting 3 Lighthouse Mobile runs on ${url}...\n`);

for (let i = 1; i <= runs; i++) {
  const outputPath = path.resolve(`apps/web/scripts/lh-report-run-${i}.json`);
  console.log(`--- RUN ${i} of ${runs} ---`);

  // Flags for mobile emulation with standard Lighthouse mobile throttling
  const cmd = `npx lighthouse ${url} --output=json --output-path="${outputPath}" --chrome-flags="--headless=new --no-sandbox" --form-factor=mobile --screenEmulation.mobile --throttling.rttMs=150 --throttling.throughputKbps=1638.4 --throttling.cpuSlowdownMultiplier=4 --quiet`;

  try {
    execSync(cmd, { stdio: 'inherit' });
    const raw = fs.readFileSync(outputPath, 'utf8');
    const report = JSON.parse(raw);

    const perf = Math.round((report.categories.performance?.score || 0) * 100);
    const a11y = Math.round((report.categories.accessibility?.score || 0) * 100);
    const bp = Math.round((report.categories['best-practices']?.score || 0) * 100);
    const seo = Math.round((report.categories.seo?.score || 0) * 100);

    const lcp = report.audits['largest-contentful-paint']?.numericValue / 1000;
    const cls = report.audits['cumulative-layout-shift']?.numericValue;
    const tbt = report.audits['total-blocking-time']?.numericValue;
    const fcp = report.audits['first-contentful-paint']?.numericValue / 1000;

    results.push({
      run: i,
      perf,
      a11y,
      bp,
      seo,
      lcp,
      cls,
      tbt,
      fcp,
    });

    console.log(`Run ${i} Result: Perf: ${perf}, A11y: ${a11y}, BP: ${bp}, SEO: ${seo} | LCP: ${lcp.toFixed(2)}s, CLS: ${cls.toFixed(3)}, TBT: ${Math.round(tbt)}ms\n`);
  } catch (err) {
    console.error(`Run ${i} failed:`, err.message);
  }
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log('\n========================================');
console.log('       LIGHTHOUSE MOBILE 3× SUMMARY');
console.log('========================================\n');

console.log('| Metric | Run 1 | Run 2 | Run 3 | MEDIAN | TARGET | STATUS |');
console.log('|---|---|---|---|---|---|---|');

const perfMed = median(results.map((r) => r.perf));
const a11yMed = median(results.map((r) => r.a11y));
const bpMed = median(results.map((r) => r.bp));
const seoMed = median(results.map((r) => r.seo));
const lcpMed = median(results.map((r) => r.lcp));
const clsMed = median(results.map((r) => r.cls));
const tbtMed = median(results.map((r) => r.tbt));

console.log(`| **Performance** | ${results[0]?.perf} | ${results[1]?.perf} | ${results[2]?.perf} | **${perfMed}** | ≥ 90 | ${perfMed >= 90 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **Accessibility** | ${results[0]?.a11y} | ${results[1]?.a11y} | ${results[2]?.a11y} | **${a11yMed}** | 100 | ${a11yMed >= 95 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **Best Practices** | ${results[0]?.bp} | ${results[1]?.bp} | ${results[2]?.bp} | **${bpMed}** | 100 | ${bpMed >= 95 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **SEO** | ${results[0]?.seo} | ${results[1]?.seo} | ${results[2]?.seo} | **${seoMed}** | 100 | ${seoMed >= 95 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **LCP** | ${results[0]?.lcp.toFixed(2)}s | ${results[1]?.lcp.toFixed(2)}s | ${results[2]?.lcp.toFixed(2)}s | **${lcpMed.toFixed(2)}s** | ≤ 2.0s | ${lcpMed <= 2.0 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **CLS** | ${results[0]?.cls.toFixed(3)} | ${results[1]?.cls.toFixed(3)} | ${results[2]?.cls.toFixed(3)} | **${clsMed.toFixed(3)}** | ≤ 0.05 | ${clsMed <= 0.05 ? '✅ PASS' : '❌ FAIL'} |`);
console.log(`| **TBT** | ${Math.round(results[0]?.tbt)}ms | ${Math.round(results[1]?.tbt)}ms | ${Math.round(results[2]?.tbt)}ms | **${Math.round(tbtMed)}ms** | ≤ 200ms | ${tbtMed <= 200 ? '✅ PASS' : '❌ FAIL'} |`);

console.log('\n========================================\n');

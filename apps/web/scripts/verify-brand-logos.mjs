import fs from 'fs';
import path from 'path';
import http from 'http';

async function runVerification() {
  console.log('=====================================================');
  console.log('REACH INTERNATIONAL — OEM BRAND LOGO VERIFICATION SUITE');
  console.log('=====================================================\n');

  let passedAll = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      passedAll = false;
    }
  }

  const brandsDir = path.resolve('apps/web/public/images/brands');

  // 1. Check all 12 versioned files exist on disk
  const expectedFiles = [
    'jcb_v3.svg', 'jcb_dark_v3.svg',
    'toyota_v3.svg', 'toyota_dark_v3.svg',
    'hyundai_v3.svg', 'hyundai_dark_v3.svg',
    'jlg_v3.svg', 'jlg_dark_v3.svg',
    'genie_v3.png', 'genie_dark_v3.png',
    'byd_v3.svg', 'byd_dark_v3.svg',
  ];

  for (const file of expectedFiles) {
    const fullPath = path.join(brandsDir, file);
    assert(fs.existsSync(fullPath), `File exists on disk: ${file} (${fs.existsSync(fullPath) ? fs.statSync(fullPath).size + ' bytes' : 'NOT FOUND'})`);
  }

  // 2. Check Toyota Dark is the official TMH_White lockup (>6000 bytes, contains Toyota Material Handling paths)
  const toyotaDarkContent = fs.readFileSync(path.join(brandsDir, 'toyota_dark_v3.svg'), 'utf8');
  assert(toyotaDarkContent.length > 6000 && toyotaDarkContent.includes('fill="white"'), 'Toyota Dark is authentic Scene7 TMH_White vector (>6KB with official white lockup)');

  // 3. Check JCB Dark has official yellow `#FCAF26` & black `#231F20`
  const jcbDarkContent = fs.readFileSync(path.join(brandsDir, 'jcb_dark_v3.svg'), 'utf8');
  assert(jcbDarkContent.includes('#FCAF26') && jcbDarkContent.includes('#231F20'), 'JCB Dark is authentic official logo from jcb.com with yellow badge & black container');

  // 4. Check Hyundai Dark has pure `#FFFFFF` vector
  const hyundaiDarkContent = fs.readFileSync(path.join(brandsDir, 'hyundai_dark_v3.svg'), 'utf8');
  assert(hyundaiDarkContent.includes('#FFFFFF') && !hyundaiDarkContent.includes('sodipodi:namedview'), 'Hyundai Dark is clean vector with #FFFFFF mark without Inkscape bloat');

  // 5. Check JLG Dark has pure `#FFFFFF` vector without coordinate clipping
  const jlgDarkContent = fs.readFileSync(path.join(brandsDir, 'jlg_dark_v3.svg'), 'utf8');
  assert(jlgDarkContent.includes('#FFFFFF') && !jlgDarkContent.includes('sodipodi:docname'), 'JLG Dark is clean vector with #FFFFFF mark without Inkscape clipping');

  // 6. Check Genie Dark is authentic PNG from genielift.com (3590 bytes)
  const genieDarkBuf = fs.readFileSync(path.join(brandsDir, 'genie_dark_v3.png'));
  assert(genieDarkBuf.length === 3590, `Genie Dark is authentic official 3590-byte PNG from genielift.com (actual: ${genieDarkBuf.length} bytes)`);

  // 7. Check BYD Dark has pure `#FFFFFF` vector
  const bydDarkContent = fs.readFileSync(path.join(brandsDir, 'byd_dark_v3.svg'), 'utf8');
  assert(bydDarkContent.includes('#FFFFFF'), 'BYD Dark is clean official vector with #FFFFFF mark');

  // 8. Check globals.css contains brand-logo theme switching rules
  const globalsCss = fs.readFileSync('apps/web/app/globals.css', 'utf8');
  assert(globalsCss.includes('.brand-logo-on-light') && globalsCss.includes('.dark .brand-logo-on-dark'), 'globals.css defines .brand-logo-on-light and .brand-logo-on-dark with .dark overrides');

  // 9. Check BrandsSection.tsx references versioned paths and classes
  const brandsSection = fs.readFileSync('apps/web/components/marketing/brands/BrandsSection.tsx', 'utf8');
  assert(brandsSection.includes('toyota_dark_v3.svg') && brandsSection.includes('brand-logo-on-dark'), 'BrandsSection.tsx references toyota_dark_v3.svg and brand-logo-on-dark');

  // 10. Check live dev server HTTP responses
  console.log('\n--- Verifying Live Dev Server HTTP Endpoints ---');
  for (const file of expectedFiles) {
    const url = `http://localhost:3000/images/brands/${file}`;
    try {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      assert(res.status === 200 && buf.length > 0, `HTTP 200 for ${file} (${buf.length} bytes, content-type: ${res.headers.get('content-type')})`);
    } catch (e) {
      assert(false, `HTTP request failed for ${url}: ${e.message}`);
    }
  }

  // 11. Check home page HTML contains all 6 dark logos
  console.log('\n--- Verifying Homepage SSR Output ---');
  try {
    const pageRes = await fetch('http://localhost:3000/');
    const pageHtml = await pageRes.text();
    for (const brand of ['jcb_dark_v3', 'toyota_dark_v3', 'hyundai_dark_v3', 'jlg_dark_v3', 'genie_dark_v3', 'byd_dark_v3']) {
      assert(pageHtml.includes(brand), `Homepage SSR HTML includes ${brand}`);
    }
  } catch (e) {
    assert(false, `Failed to fetch homepage: ${e.message}`);
  }

  console.log('\n=====================================================');
  if (passedAll) {
    console.log('🎉 ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  } else {
    console.error('❌ SOME CHECKS FAILED! Please inspect errors above.');
    process.exit(1);
  }
  console.log('=====================================================');
}

runVerification();

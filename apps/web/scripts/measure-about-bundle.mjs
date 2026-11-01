import zlib from 'zlib';

async function measurePageJs() {
  console.log('Fetching http://localhost:3000/about ...');
  const res = await fetch('http://localhost:3000/about');
  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  // Find all modern script tags with src (exclude nomodule fallback scripts)
  const scriptRegex = /<script(?![^>]*\bnomodule\b)[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const scriptUrls = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    if (src.endsWith('.js') || src.includes('.js?')) {
      scriptUrls.push(src);
    }
  }

  console.log(`\nFound ${scriptUrls.length} first-load script assets on /about:\n`);
  let totalRawBytes = 0;
  let totalGzipBytes = 0;

  console.log('| Asset | Raw Size | Gzip Size |');
  console.log('|---|---|---|');

  for (const src of scriptUrls) {
    const fullUrl = src.startsWith('http') ? src : `http://localhost:3000${src}`;
    const scriptRes = await fetch(fullUrl);
    if (!scriptRes.ok) {
      console.warn(`Failed to fetch script: ${fullUrl}`);
      continue;
    }
    const buffer = Buffer.from(await scriptRes.arrayBuffer());
    const gzipped = zlib.gzipSync(buffer);

    totalRawBytes += buffer.length;
    totalGzipBytes += gzipped.length;

    const fileName = src.split('/').pop().split('?')[0];
    console.log(
      `| \`${fileName}\` | ${(buffer.length / 1024).toFixed(2)} KB | ${(gzipped.length / 1024).toFixed(2)} KB |`
    );
  }

  const totalRawKb = (totalRawBytes / 1024).toFixed(2);
  const totalGzipKb = (totalGzipBytes / 1024).toFixed(2);

  console.log('\n========================================');
  console.log(`Total First-Load JS (Raw):  ${totalRawKb} KB`);
  console.log(`Total First-Load JS (Gzip): ${totalGzipKb} KB`);
  console.log(`Budget:                      ≤ 170.00 KB`);
  console.log(`Status:                      ${totalGzipBytes <= 170 * 1024 ? '✅ PASS (UNDER BUDGET)' : '❌ OVER BUDGET'}`);
  console.log('========================================\n');
}

measurePageJs().catch((err) => {
  console.error(err);
  process.exit(1);
});

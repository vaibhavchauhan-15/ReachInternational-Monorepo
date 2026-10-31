import assert from 'node:assert';

// Emulate the CORS logic from apps/web/app/api/users/[id]/route.ts
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)?reachinternational\.co\.in$/,
  /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/,
];

function getCorsHeaders(origin, appUrl) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    Vary: 'Origin',
  };

  if (origin) {
    const isAllowed =
      (Boolean(appUrl) && origin === appUrl) ||
      ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));

    if (isAllowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

console.log('🔒 Testing API Route CORS & Origin Validation Security...\n');

// 1. Untrusted third-party origins
const untrusted1 = getCorsHeaders('https://attacker.evil.com');
assert.strictEqual(untrusted1['Access-Control-Allow-Origin'], undefined, 'Must NOT reflect unauthorized origin');
assert.strictEqual(untrusted1['Access-Control-Allow-Credentials'], undefined, 'Must NOT set credentials for untrusted origin');
console.log('  ✓ Untrusted origin (https://attacker.evil.com) rejected with zero allow-origin headers');

const untrusted2 = getCorsHeaders('https://reachinternational.co.in.evil.com');
assert.strictEqual(untrusted2['Access-Control-Allow-Origin'], undefined, 'Subdomain spoofing must NOT be allowed');
console.log('  ✓ Domain spoofing attempt (https://reachinternational.co.in.evil.com) rejected');

// 2. Trusted localhost / 127.0.0.1
const localDev = getCorsHeaders('http://localhost:3000');
assert.strictEqual(localDev['Access-Control-Allow-Origin'], 'http://localhost:3000');
assert.strictEqual(localDev['Access-Control-Allow-Credentials'], 'true');
console.log('  ✓ Localhost dev server (http://localhost:3000) allowed with credentialed access');

const localMetro = getCorsHeaders('http://localhost:8081');
assert.strictEqual(localMetro['Access-Control-Allow-Origin'], 'http://localhost:8081');
console.log('  ✓ Metro bundler (http://localhost:8081) allowed');

// 3. Trusted Production & Preview domains
const prodOrigin = getCorsHeaders('https://dashboard.reachinternational.co.in');
assert.strictEqual(prodOrigin['Access-Control-Allow-Origin'], 'https://dashboard.reachinternational.co.in');
assert.strictEqual(prodOrigin['Access-Control-Allow-Credentials'], 'true');
console.log('  ✓ Production portal (https://dashboard.reachinternational.co.in) allowed with credentials');

const vercelPreview = getCorsHeaders('https://reach-preview-abc123.vercel.app');
assert.strictEqual(vercelPreview['Access-Control-Allow-Origin'], 'https://reach-preview-abc123.vercel.app');
console.log('  ✓ Vercel preview deployment allowed');

// 4. No Origin header (Native Mobile fetch or direct same-origin request)
const noOrigin = getCorsHeaders(null);
assert.strictEqual(noOrigin['Access-Control-Allow-Origin'], undefined);
assert.strictEqual(noOrigin['Access-Control-Allow-Credentials'], undefined);
console.log('  ✓ Direct same-origin / Native mobile requests without Origin header handled cleanly');

console.log('\n🎉 ALL CORS & ORIGIN SECURITY CHECKS PASSED PERFECTLY!');

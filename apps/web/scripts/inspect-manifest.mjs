import fs from 'fs';
import vm from 'vm';

const manifest = fs.readFileSync(
  'apps/web/.next/server/app/(marketing)/about/page_client-reference-manifest.js',
  'utf8'
);

const sandbox = { globalThis: {} };
vm.createContext(sandbox);
vm.runInContext(manifest, sandbox);

const rscManifest = sandbox.globalThis.__RSC_MANIFEST['/(marketing)/about/page'];
const matched = [];
for (const [key, value] of Object.entries(rscManifest.clientModules || {})) {
  const s = JSON.stringify(value);
  if (s.includes('18_z9g98kyiix')) {
    matched.push(key);
  }
}

console.log('Modules mapped to 18_z9g98kyiix (count ' + matched.length + '):');
for (const m of matched.slice(0, 20)) {
  console.log(' -', m);
}

const fs = require('fs');
const path = require('path');

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.expo' && f !== '.next' && f !== 'dist') walk(p);
    } else if (p.endsWith('.tsx') && !p.includes('AppModal.tsx')) {
      const c = fs.readFileSync(p, 'utf8');
      if (/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*['"]react-native['"]/.test(c)) {
        console.log(p);
      }
    }
  }
}
walk('apps/mobile');

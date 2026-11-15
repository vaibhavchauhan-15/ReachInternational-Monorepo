import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(path.resolve(__dirname, '../apps/web/package.json'));
const sharp = require('sharp');

const svg = `
<svg width="96" height="96" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="#ffffff"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

const outputPath = path.resolve(__dirname, '../apps/mobile/assets/notification-icon.png');

sharp(Buffer.from(svg))
  .resize(96, 96)
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log('Created white-on-transparent notification-icon.png at:', outputPath);
  })
  .catch((err) => {
    console.error('Failed to create notification-icon.png:', err);
    process.exit(1);
  });

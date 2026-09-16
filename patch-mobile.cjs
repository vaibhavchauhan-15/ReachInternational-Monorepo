const fs = require('fs');
const p = 'c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/mobile/app/(app)/operations.tsx';
let s = fs.readFileSync(p, 'utf8');
const a = 'Overtime & Remarks if present';
const b = 'Breakdown / Overtime / Remarks if present';
if (!s.includes(a)) { console.log('needle missing'); process.exit(1); }
s = s.split(a).join(b);
const viewTag = 'styles.logRemarksRow, { borderTopColor: theme.colors.hairline }]}>';
const idx = s.indexOf(b);
const vIdx = s.indexOf(viewTag, idx);
if (vIdx === -1) { console.log('viewtag missing'); process.exit(1); }
const insertPos = vIdx + viewTag.length;
const breakdownJsx = "\n                          {(log||{}).is_breakdown ? (\n                            <Text>BreakdownRow</Text>\n                          ) : null}";
s = s.slice(0, insertPos) + breakdownJsx + s.slice(insertPos);
fs.writeFileSync(p, s);
console.log('patched ok len ' + s.length);

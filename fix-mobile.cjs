const fs = require("fs");
const p = "c:/TEMP_OPS.txt";
let t = fs.readFileSync(p, "utf8");
const marker = "BreakdownRow";
if (!t.includes(marker)) { console.log("NOTFOUND"); }
else { t = t.split(marker).join("BreakdownYes"); fs.writeFileSync(p, t); console.log("OK"); }

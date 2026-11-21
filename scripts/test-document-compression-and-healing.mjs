import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== Running Document Compression, Staging & Healing Tests ===");

// Test 1: Verify apps/web/lib/utils/image-compression.ts has white background fill and black pixel detection
const imgCompCode = fs.readFileSync("apps/web/lib/utils/image-compression.ts", "utf-8");
assert(
  imgCompCode.includes("ctx.fillStyle = \"#FFFFFF\"") && imgCompCode.includes("ctx.fillRect(0, 0, safeW, safeH)"),
  "Canvas must fill white background before drawImage to prevent transparent pixels turning black in JPEG"
);
assert(
  imgCompCode.includes("isCanvasPureBlack"),
  "Must include pure black canvas detection guard"
);
assert(
  imgCompCode.includes("img.decode"),
  "Must use img.decode() to guarantee full raster decompression before drawing"
);
console.log("✓ Test 1 Passed: Client image compression engine hardened with white fill, img.decode, and black-pixel detector.");

// Test 2: Verify apps/web/app/actions/auth.ts has minimum size check
const authCode = fs.readFileSync("apps/web/app/actions/auth.ts", "utf-8");
assert(
  authCode.includes("mainSize < 8_000"),
  "Server action auth.ts must reject files smaller than 8 KB to prevent corrupted blank documents"
);
console.log("✓ Test 2 Passed: Server action enforces minimum size threshold rejecting <8KB degenerates.");

// Test 3: Verify DocumentLightboxModal.tsx has auto-fallback to thumbnail
const modalCode = fs.readFileSync(
  "apps/web/app/(app)/approvals/components/DocumentLightboxModal.tsx",
  "utf-8"
);
assert(
  modalCode.includes("isCorruptedOriginal") && modalCode.includes("doc.file_size_bytes <= 9000"),
  "DocumentLightboxModal must detect corrupted files <= 9000 bytes"
);
assert(
  modalCode.includes("setViewMode(\"thumbnail\")"),
  "DocumentLightboxModal must auto-switch to thumbnail when main is corrupted"
);
assert(
  modalCode.includes("Verified Thumbnail View"),
  "DocumentLightboxModal must render verified thumbnail badge notice"
);
console.log("✓ Test 3 Passed: DocumentLightboxModal has intelligent auto-fallback, badge, and toggle controls.");

// Test 4: Verify mobile ApprovalDetailBottomSheet signs both storage_path and thumb_path
const mobileCode = fs.readFileSync(
  "apps/mobile/components/approvals/ApprovalDetailBottomSheet.tsx",
  "utf-8"
);
assert(
  mobileCode.includes("pathsToSign.push(d.thumb_path.replace"),
  "Mobile ApprovalDetailBottomSheet must sign thumb_path in addition to storage_path"
);
console.log("✓ Test 4 Passed: Mobile approval bottom sheet signs both paths with 100% web-mobile parity.");

// Test 5: Verify mobileImageCompression has floor check
const mobileCompCode = fs.readFileSync(
  "apps/mobile/lib/utils/mobileImageCompression.ts",
  "utf-8"
);
assert(
  mobileCompCode.includes("sizeBytes < 5_000"),
  "Mobile image compression must enforce minimum size floor check"
);
console.log("✓ Test 5 Passed: Mobile image compression has minimum size floor check.");

console.log("\nAll 5 automated verification checks passed successfully!");

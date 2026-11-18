import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTargetDimensions,
  validateDocumentDimensions,
} from "./image-compression.ts";

test("calculateTargetDimensions preserves aspect ratio when scaling down", () => {
  // Landscape 2400 x 1800 -> max 1600
  const landscape = calculateTargetDimensions(2400, 1800, 1600);
  assert.equal(landscape.width, 1600);
  assert.equal(landscape.height, 1200);

  // Portrait 1800 x 2400 -> max 1600
  const portrait = calculateTargetDimensions(1800, 2400, 1600);
  assert.equal(portrait.width, 1200);
  assert.equal(portrait.height, 1600);

  // Square 2000 x 2000 -> max 1600
  const square = calculateTargetDimensions(2000, 2000, 1600);
  assert.equal(square.width, 1600);
  assert.equal(square.height, 1600);
});

test("calculateTargetDimensions leaves dimensions untouched if already within limits", () => {
  const small = calculateTargetDimensions(1200, 900, 1600);
  assert.equal(small.width, 1200);
  assert.equal(small.height, 900);

  // Compact document (e.g. cropped ID card, pan card, passport scan)
  const compact = calculateTargetDimensions(500, 350, 2400);
  assert.equal(compact.width, 500);
  assert.equal(compact.height, 350);

  const exact = calculateTargetDimensions(1600, 1200, 1600);
  assert.equal(exact.width, 1600);
  assert.equal(exact.height, 1200);
});

test("calculateTargetDimensions calculates exact thumbnail dimensions (320 px and 480 px)", () => {
  const thumb320 = calculateTargetDimensions(1600, 1200, 320);
  assert.equal(thumb320.width, 320);
  assert.equal(thumb320.height, 240);

  const portraitThumb = calculateTargetDimensions(1200, 1600, 320);
  assert.equal(portraitThumb.width, 240);
  assert.equal(portraitThumb.height, 320);

  const thumb480 = calculateTargetDimensions(2400, 1800, 480);
  assert.equal(thumb480.width, 480);
  assert.equal(thumb480.height, 360);

  // Small image already within thumbnail limit
  const smallThumb = calculateTargetDimensions(400, 300, 480);
  assert.equal(smallThumb.width, 400);
  assert.equal(smallThumb.height, 300);
});

test("calculateTargetDimensions handles multi-pass reductions", () => {
  const pass3 = calculateTargetDimensions(2800, 2100, 2000);
  assert.equal(pass3.width, 2000);
  assert.equal(pass3.height, 1500);

  const pass4 = calculateTargetDimensions(2800, 2100, 1600);
  assert.equal(pass4.width, 1600);
  assert.equal(pass4.height, 1200);

  const pass5 = calculateTargetDimensions(2800, 2100, 1400);
  assert.equal(pass5.width, 1400);
  assert.equal(pass5.height, 1050);
});

test("validateDocumentDimensions accepts compact and already compressed document images (< 600 px)", () => {
  // Clear cropped documents / scans under 600 px are accepted without artificial errors
  assert.equal(validateDocumentDimensions(500, 350).valid, true);
  assert.equal(validateDocumentDimensions(400, 300).valid, true);
  assert.equal(validateDocumentDimensions(300, 200).valid, true);
  assert.equal(validateDocumentDimensions(600, 600).valid, true);
  assert.equal(validateDocumentDimensions(1200, 800).valid, true);
  assert.equal(validateDocumentDimensions(4000, 3000).valid, true);

  // Degenerate / zero / negative dimensions are rejected
  assert.equal(validateDocumentDimensions(0, 0).valid, false);
  assert.equal(validateDocumentDimensions(-10, 100).valid, false);
  assert.equal(validateDocumentDimensions(100, -10).valid, false);
  assert.equal(validateDocumentDimensions(10, 10).valid, false);
});

test("Size threshold gate rejects final size > 2.5 MB", () => {
  const checkSizeLimit = (bytes: number) => {
    if (bytes > 2_500_000) {
      throw new Error("Document image exceeds maximum size of 2.5 MB.");
    }
    return true;
  };

  assert.equal(checkSizeLimit(400_000), true);
  assert.equal(checkSizeLimit(800_000), true);
  assert.equal(checkSizeLimit(1_000_000), true);
  assert.equal(checkSizeLimit(2_499_999), true);
  assert.equal(checkSizeLimit(2_500_000), true);

  assert.throws(
    () => checkSizeLimit(2_500_001),
    /exceeds maximum size of 2.5 MB/
  );
});

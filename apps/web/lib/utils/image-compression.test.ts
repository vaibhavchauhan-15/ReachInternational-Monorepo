import test from "node:test";
import assert from "node:assert/strict";
import { calculateTargetDimensions } from "./image-compression.ts";

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

  const exact = calculateTargetDimensions(1600, 1200, 1600);
  assert.equal(exact.width, 1600);
  assert.equal(exact.height, 1200);
});

test("calculateTargetDimensions calculates exact thumbnail dimensions (320 px)", () => {
  const thumb = calculateTargetDimensions(1600, 1200, 320);
  assert.equal(thumb.width, 320);
  assert.equal(thumb.height, 240);

  const portraitThumb = calculateTargetDimensions(1200, 1600, 320);
  assert.equal(portraitThumb.width, 240);
  assert.equal(portraitThumb.height, 320);
});

test("calculateTargetDimensions handles Pass 3 reduction to 1400 px", () => {
  const pass3 = calculateTargetDimensions(2800, 2100, 1400);
  assert.equal(pass3.width, 1400);
  assert.equal(pass3.height, 1050);
});

test("Resolution gate logic rejects short edge < 600 px", () => {
  const checkResolution = (w: number, h: number) => {
    const shortEdge = Math.min(w, h);
    if (shortEdge < 600) {
      throw new Error("Image resolution is too low. Minimum dimension is 600 px.");
    }
    return true;
  };

  assert.equal(checkResolution(1200, 800), true);
  assert.equal(checkResolution(600, 600), true);

  assert.throws(
    () => checkResolution(1200, 599),
    /Minimum dimension is 600 px/
  );
  assert.throws(
    () => checkResolution(400, 400),
    /Minimum dimension is 600 px/
  );
});

test("Size threshold gate rejects final size > 1 MB", () => {
  const checkSizeLimit = (bytes: number) => {
    if (bytes > 1_000_000) {
      throw new Error("Document image exceeds maximum size of 1 MB.");
    }
    return true;
  };

  assert.equal(checkSizeLimit(400_000), true);
  assert.equal(checkSizeLimit(999_999), true);
  assert.equal(checkSizeLimit(1_000_000), true);

  assert.throws(
    () => checkSizeLimit(1_000_001),
    /exceeds maximum size of 1 MB/
  );
});

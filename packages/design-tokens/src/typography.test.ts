import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_VARIANTS as T, FONT_SCALE_PRESETS as P, scaled } from './typography.ts';

test('hierarchy is strictly ordered', () => {
  assert.ok(
    T.display.size > T.title.size &&
    T.title.size > T.heading.size &&
    T.heading.size > T.subheading.size &&
    T.subheading.size >= T.body.size &&
    T.body.size > T.label.size &&
    T.label.size > T.caption.size
  );
});

test('line height >= 1.2x and icon fits inside line', () => {
  for (const v of Object.values(T)) {
    assert.ok(v.line >= v.size * 1.2);
    assert.ok(v.icon <= v.line);
  }
});

test('smallest rendered text stays readable', () => {
  assert.ok(scaled(T.caption.size, P.small) >= 11);
});

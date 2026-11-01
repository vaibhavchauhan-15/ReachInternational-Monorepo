import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slugify.ts';

test('slugify converts titles to clean lowercase hyphenated slugs', () => {
  assert.equal(slugify('Senior Boom Lift Operator'), 'senior-boom-lift-operator');
  assert.equal(slugify('  Lead Field Service Engineer — Hydraulics  '), 'lead-field-service-engineer-hydraulics');
  assert.equal(slugify('Safety & HSE Manager (Pan-India)'), 'safety-hse-manager-pan-india');
});

test('slugify strips diacritics and special characters correctly', () => {
  assert.equal(slugify('Crème Brûlée Specialist'), 'creme-brulee-specialist');
  assert.equal(slugify('Café & Résumé Coordinator'), 'cafe-resume-coordinator');
  assert.equal(slugify('JCB / JLG / Genie @ Site #1!'), 'jcb-jlg-genie-site-1');
});

test('slugify resolves collisions with -2, -3 increments', () => {
  const existing = ['service-engineer', 'service-engineer-2', 'service-engineer-3'];
  assert.equal(slugify('Service Engineer', existing), 'service-engineer-4');
  assert.equal(slugify('New Role', existing), 'new-role');
});

test('slugify handles empty, whitespace, and extreme inputs safely', () => {
  assert.equal(slugify(''), 'item');
  assert.equal(slugify('   '), 'item');
  assert.equal(slugify('---'), 'item');
  assert.equal(slugify('a'.repeat(120), [], 50).length <= 50, true);
});

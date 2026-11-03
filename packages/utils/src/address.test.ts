// packages/utils/src/address.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addressKey,
  normText,
  formatAddress,
  formatSiteDropdownLabel,
  formatSiteDropdownDescription,
  formatClientDropdownLabel,
} from './address.ts';

test('normText: same place different typing -> same key', () => {
  assert.equal(normText('CPM |PO : CP Mills,'), normText('cpm po cp  mills'));
});

test('addressKey: same place different typing -> same key', () => {
  const a = { street: 'CPM |PO : CP Mills,', city: 'Songadh', pincode: '394670' };
  const b = { street: 'cpm po cp  mills', city: 'SONGADH', pincode: '394670' };
  assert.equal(addressKey(a), addressKey(b));
});

test('addressKey: different pincode -> different key', () => {
  assert.notEqual(
    addressKey({ street: 'CP Mills', city: 'X', pincode: '394670' }),
    addressKey({ street: 'CP Mills', city: 'X', pincode: '394671' })
  );
});

test('formatAddress: joins non-empty parts', () => {
  const addr = { street: 'Plot 42', city: 'Pune', district: 'Pune', stateName: 'Maharashtra', pincode: '411001' };
  assert.equal(formatAddress(addr), 'Plot 42, Pune, Pune, Maharashtra, 411001');
});

test('formatAddress: skips empty parts', () => {
  assert.equal(formatAddress({ street: 'Plot 42', city: 'Pune', pincode: '411001' }), 'Plot 42, Pune, 411001');
});

test('formatSiteDropdownLabel: handles code and site_name', () => {
  assert.equal(
    formatSiteDropdownLabel({ code: 'S00', site_name: 'Fort Songadh' }),
    'S00 · Fort Songadh'
  );
  assert.equal(
    formatSiteDropdownLabel({ site_code: 'CLI-0050-S01', site_name: 'Pune Main Site' }),
    'S01 · Pune Main Site'
  );
});

test('formatClientDropdownLabel: does not concatenate location strings', () => {
  assert.equal(
    formatClientDropdownLabel({ client_id: 'CLI-0002', company_name: 'JK Paper Ltd.' }),
    'CLI-0002 · JK Paper Ltd.'
  );
  assert.equal(
    formatClientDropdownLabel({ code: 'CLI-0050', company_name: 'Afcons Infrastructure' }),
    'CLI-0050 · Afcons Infrastructure'
  );
});

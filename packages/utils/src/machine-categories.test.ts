import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MACHINE_CATEGORIES,
  MACHINE_CATEGORY_SELECT_OPTIONS,
  getMachineCategoryById,
  getMachineCategoryByName,
  isValidMachineCategory,
  normalizeMachineCategory,
  formatMachineCategoryLabel,
} from './machine-categories.ts';

describe('Machine Categories & Utilities', () => {
  it('defines the 7 required categories with correct IDs and names', () => {
    assert.strictEqual(MACHINE_CATEGORIES.length, 7);
    const expected = [
      { id: 1, name: 'Stacker' },
      { id: 3, name: 'Reach Truck' },
      { id: 4, name: 'Order Picker' },
      { id: 7, name: 'Electric Pallet Truck' },
      { id: 14, name: 'Forklift' },
      { id: 15, name: 'Scissor Lift' },
      { id: 16, name: 'Boom Lift' },
    ];
    for (const exp of expected) {
      const found = MACHINE_CATEGORIES.find((c) => c.id === exp.id);
      assert.ok(found, `Category id ${exp.id} not found`);
      assert.strictEqual(found.name, exp.name);
    }
  });

  it('generates formatted dropdown select options with category name only (no numbers)', () => {
    assert.strictEqual(MACHINE_CATEGORY_SELECT_OPTIONS.length, 7);
    assert.deepStrictEqual(MACHINE_CATEGORY_SELECT_OPTIONS[0], {
      value: 'Stacker',
      label: 'Stacker',
    });
    assert.deepStrictEqual(MACHINE_CATEGORY_SELECT_OPTIONS[1], {
      value: 'Reach Truck',
      label: 'Reach Truck',
    });
    assert.deepStrictEqual(MACHINE_CATEGORY_SELECT_OPTIONS[4], {
      value: 'Forklift',
      label: 'Forklift',
    });
  });

  it('resolves machine categories by ID', () => {
    assert.strictEqual(getMachineCategoryById(1)?.name, 'Stacker');
    assert.strictEqual(getMachineCategoryById('14')?.name, 'Forklift');
    assert.strictEqual(getMachineCategoryById(99), undefined);
  });

  it('resolves machine categories by name or code case-insensitively', () => {
    assert.strictEqual(getMachineCategoryByName('Reach Truck')?.id, 3);
    assert.strictEqual(getMachineCategoryByName('reach_truck')?.id, 3);
    assert.strictEqual(getMachineCategoryByName('forklift')?.id, 14);
    assert.strictEqual(getMachineCategoryByName('UNKNOWN'), undefined);
  });

  it('validates machine categories correctly', () => {
    assert.strictEqual(isValidMachineCategory('Forklift'), true);
    assert.strictEqual(isValidMachineCategory('14'), true);
    assert.strictEqual(isValidMachineCategory('Invalid Cat'), false);
    assert.strictEqual(isValidMachineCategory(''), false);
    assert.strictEqual(isValidMachineCategory(null), false);
  });

  it('normalizes categories from names, codes, ids, or numbered label strings', () => {
    assert.strictEqual(normalizeMachineCategory('14'), 'Forklift');
    assert.strictEqual(normalizeMachineCategory('14. Forklift'), 'Forklift');
    assert.strictEqual(normalizeMachineCategory('reach truck'), 'Reach Truck');
    assert.strictEqual(normalizeMachineCategory('electric_pallet_truck'), 'Electric Pallet Truck');
    assert.strictEqual(normalizeMachineCategory(''), null);
    assert.strictEqual(normalizeMachineCategory(null), null);
  });

  it('formats category label cleanly without numbers', () => {
    assert.strictEqual(formatMachineCategoryLabel('Forklift'), 'Forklift');
    assert.strictEqual(formatMachineCategoryLabel('14. Forklift'), 'Forklift');
    assert.strictEqual(formatMachineCategoryLabel('3. Reach Truck'), 'Reach Truck');
    assert.strictEqual(formatMachineCategoryLabel(14), 'Forklift');
    assert.strictEqual(formatMachineCategoryLabel(null), '—');
  });
});

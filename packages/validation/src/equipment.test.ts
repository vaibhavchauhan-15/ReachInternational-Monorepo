import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  equipmentUpsertSchema,
  equipmentPublishValidationSchema,
  equipmentEnquiryStatusSchema,
} from './equipment.ts';

const dummyBrandId = 'b1000000-0000-0000-0000-000000000001';
const dummyCategoryId = 'c1000000-0000-0000-0000-000000000001';
const dummyEnquiryId = 'e1000000-0000-0000-0000-000000000001';

test('equipmentUpsertSchema validates a valid draft machine', () => {
  const validDraft = {
    model_number: 'S2632E',
    model_name: 'JCB S2632E Electric Scissor Lift',
    slug: 'jcb-s2632e',
    category_id: dummyCategoryId,
    brand_id: dummyBrandId,
    full_description: 'Detailed description of the JCB S2632E electric scissor lift.',
    status: 'draft',
    power: 'electric',
    tagline: 'Compact 8.1 m electric scissor lift',
    summary: 'Electric scissor lift with 8.1 m platform height and 250 kg capacity.',
    max_platform_height_m: 8.1,
    max_working_height_m: 10.1,
    capacity_kg: 250,
    weight_kg: 2062,
    indoor_use: true,
    outdoor_use: false,
    rental_available: true,
    purchase_available: false,
    specs: {
      max_platform_height_m: { v: 8.1, d: "8.1 m / 26'6\"" },
      occupants_outdoor: { v: null, d: 'Not rated (indoor use only)' },
    },
  };

  const parsed = equipmentUpsertSchema.parse(validDraft);
  assert.equal(parsed.model_number, 'S2632E');
  assert.equal(parsed.slug, 'jcb-s2632e');
  assert.equal(parsed.status, 'draft');
  assert.equal(parsed.specs?.occupants_outdoor?.v, null);
});

test('equipmentPublishValidationSchema enforces required summary and description', () => {
  const invalidPublish = {
    model_name: 'Incomplete Machine',
    model_number: 'INC100',
    slug: 'incomplete-machine',
    brand_id: dummyBrandId,
    category_id: dummyCategoryId,
    full_description: 'Short',
    status: 'published',
    power: 'electric',
    // Missing summary
  };

  assert.throws(() => {
    equipmentPublishValidationSchema.parse(invalidPublish);
  });

  const validPublish = {
    model_name: 'Complete Machine',
    model_number: 'CMP100',
    slug: 'complete-machine',
    brand_id: dummyBrandId,
    category_id: dummyCategoryId,
    full_description: 'A completely ready machine with full details and descriptions.',
    summary: 'A concise summary for public cards and SEO metadata.',
    primary_image_url: '/images/machines/complete.webp',
    status: 'published',
    power: 'electric',
  };

  const parsed = equipmentPublishValidationSchema.parse(validPublish);
  assert.equal(parsed.status, 'published');
  assert.equal(parsed.summary, 'A concise summary for public cards and SEO metadata.');
});

test('equipmentEnquiryStatusSchema validates canonical quotation statuses', () => {
  assert.equal(
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'new' }).status,
    'new'
  );
  assert.equal(
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'contacted' }).status,
    'contacted'
  );
  assert.equal(
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'quoted' }).status,
    'quoted'
  );
  assert.equal(
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'closed' }).status,
    'closed'
  );
  assert.equal(
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'rejected' }).status,
    'rejected'
  );

  assert.throws(() => {
    equipmentEnquiryStatusSchema.parse({ id: dummyEnquiryId, status: 'invalid_status' });
  });
});

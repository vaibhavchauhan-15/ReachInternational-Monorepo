import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JobPostingInputSchema,
  PublicApplyInputSchema,
  PublishJobSchema,
} from './careers.ts';

test('JobPostingInputSchema validates valid job input', () => {
  const valid = {
    title: 'Senior Boom Lift Operator',
    slug: 'senior-boom-lift-operator',
    department_id: 1,
    employment_type: 'full_time',
    workplace_type: 'onsite',
    experience_level: 'senior',
    min_experience_years: 5,
    max_experience_years: 10,
    openings: 2,
    city: 'Mumbai',
    summary: 'Seeking experienced boom lift operator for major infrastructure projects in Mumbai.',
    description_md: 'Detailed description of the role with requirements, safety practices, equipment handled.',
    responsibilities: ['Operate boom lifts up to 48m', 'Conduct daily pre-shift inspections'],
    requirements: ['Valid heavy machinery license', 'Minimum 5 years experience'],
    status: 'draft',
    is_featured: false,
  };

  const parsed = JobPostingInputSchema.safeParse(valid);
  assert.equal(parsed.success, true);
});

test('JobPostingInputSchema rejects max experience less than min experience', () => {
  const invalid = {
    title: 'Junior Operator',
    slug: 'junior-operator',
    department_id: 1,
    employment_type: 'full_time',
    workplace_type: 'onsite',
    experience_level: 'junior',
    min_experience_years: 5,
    max_experience_years: 2, // invalid
    openings: 1,
    city: 'Pune',
    summary: 'Seeking junior operator for warehouse operations.',
    description_md: 'Detailed description of the role with requirements, safety practices.',
    responsibilities: [],
    requirements: [],
    status: 'draft',
  };

  const parsed = JobPostingInputSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});

test('PublicApplyInputSchema rejects invalid phone, bad email, or missing consent', () => {
  const invalidPhone = {
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '12345', // invalid Indian mobile
    current_city: 'Delhi',
    total_experience_yrs: 3,
    consent: true,
  };
  assert.equal(PublicApplyInputSchema.safeParse(invalidPhone).success, false);

  const missingConsent = {
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    current_city: 'Delhi',
    total_experience_yrs: 3,
    consent: false, // rejected
  };
  assert.equal(PublicApplyInputSchema.safeParse(missingConsent).success, false);
});

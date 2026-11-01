import { z } from 'zod';

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'apprenticeship',
  'temporary',
] as const;

export const WORKPLACE_TYPES = ['onsite', 'hybrid', 'remote'] as const;

export const EXPERIENCE_LEVELS = [
  'fresher',
  'junior',
  'mid',
  'senior',
  'lead',
] as const;

export const SALARY_PERIODS = ['hour', 'day', 'month', 'year'] as const;

export const JOB_STATUSES = ['draft', 'published', 'closed', 'archived'] as const;

export const APPLICATION_STATUSES = [
  'new',
  'screening',
  'shortlisted',
  'interview',
  'offered',
  'hired',
  'rejected',
  'withdrawn',
] as const;

// ReDoS safe regexes: apply .max() before regex
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INDIAN_PHONE_REGEX = /^[6-9][0-9]{9}$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const JobPostingInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must not exceed 120 characters'),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug must be at least 3 characters')
      .max(100, 'Slug must not exceed 100 characters')
      .regex(SLUG_REGEX, 'Slug must contain only lowercase alphanumeric characters and single hyphens'),
    department_id: z.coerce.number().int().positive('Please select a department'),
    employment_type: z.enum(EMPLOYMENT_TYPES, { errorMap: () => ({ message: 'Invalid employment type' }) }),
    workplace_type: z.enum(WORKPLACE_TYPES, { errorMap: () => ({ message: 'Invalid workplace type' }) }),
    experience_level: z.enum(EXPERIENCE_LEVELS, { errorMap: () => ({ message: 'Invalid experience level' }) }),
    min_experience_years: z.coerce.number().min(0, 'Minimum experience cannot be negative').max(50, 'Max experience is 50'),
    max_experience_years: z.coerce
      .number()
      .min(0, 'Maximum experience cannot be negative')
      .max(50, 'Max experience is 50')
      .nullable()
      .optional(),
    openings: z.coerce.number().int().min(1, 'Minimum 1 opening').max(500, 'Max 500 openings').default(1),
    city: z.string().trim().min(2, 'City is required').max(80, 'City must not exceed 80 characters'),
    district: z.string().trim().max(80).nullable().optional(),
    state_id: z.coerce.number().int().nullable().optional(),
    country_code: z.string().max(2).default('IN'),
    site_note: z.string().trim().max(120).nullable().optional(),
    salary_min: z.coerce.number().min(0).nullable().optional(),
    salary_max: z.coerce.number().min(0).nullable().optional(),
    salary_currency: z.string().max(3).default('INR'),
    salary_period: z.enum(SALARY_PERIODS).default('month'),
    show_salary: z.boolean().default(false),
    summary: z.string().trim().min(20, 'Summary must be at least 20 characters').max(300, 'Summary must not exceed 300 characters'),
    description_md: z.string().trim().min(50, 'Description must be at least 50 characters').max(20000, 'Description too long'),
    responsibilities: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
    requirements: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
    nice_to_have: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    benefits: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    skills: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    status: z.enum(JOB_STATUSES).default('draft'),
    is_featured: z.boolean().default(false),
    apply_by: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD')
      .nullable()
      .optional(),
    seo_title: z.string().trim().max(70).nullable().optional(),
    seo_description: z.string().trim().max(160).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.max_experience_years != null && data.max_experience_years < data.min_experience_years) {
        return false;
      }
      return true;
    },
    { message: 'Maximum experience cannot be less than minimum experience', path: ['max_experience_years'] }
  )
  .refine(
    (data) => {
      if (data.salary_max != null && data.salary_min != null && data.salary_max < data.salary_min) {
        return false;
      }
      return true;
    },
    { message: 'Maximum salary cannot be less than minimum salary', path: ['salary_max'] }
  )
  .refine(
    (data) => {
      if (data.show_salary && (data.salary_min == null || data.salary_min <= 0)) {
        return false;
      }
      return true;
    },
    { message: 'Minimum salary is required when salary is shown publicly', path: ['salary_min'] }
  );

export type JobPostingInput = z.infer<typeof JobPostingInputSchema>;

export const PublishJobSchema = JobPostingInputSchema.refine(
  (data) => data.responsibilities.length > 0,
  { message: 'At least one responsibility is required to publish', path: ['responsibilities'] }
).refine(
  (data) => data.requirements.length > 0,
  { message: 'At least one requirement is required to publish', path: ['requirements'] }
);

export const JobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((val) => [10, 25, 50, 100].includes(val), 'Invalid page size').default(10),
  search: z.string().trim().max(80).optional(),
  status: z.enum(['all', ...JOB_STATUSES]).default('all'),
  department: z.string().optional(),
  employment_type: z.string().optional(),
  workplace_type: z.string().optional(),
  state_id: z.coerce.number().int().optional(),
  sortField: z.enum(['created_at', 'published_at', 'apply_by', 'title', 'applications']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type JobListQuery = z.infer<typeof JobListQuerySchema>;

export const ApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((val) => [10, 25, 50, 100].includes(val), 'Invalid page size').default(10),
  search: z.string().trim().max(80).optional(),
  job_id: z.string().uuid().optional(),
  status: z.enum(['all', ...APPLICATION_STATUSES]).default('all'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortField: z.enum(['created_at', 'rating', 'total_experience_yrs']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ApplicationListQuery = z.infer<typeof ApplicationListQuerySchema>;

export const ApplicationStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
  rejection_reason: z.string().trim().max(500).optional(),
});

export const ApplicationNoteSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(4000),
});

export const ApplicationRatingSchema = z.object({
  id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5).nullable(),
});

export const PublicApplyInputSchema = z.object({
  job_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  email: z.string().trim().max(255).regex(EMAIL_REGEX, 'Please enter a valid email address'),
  phone: z.string().trim().regex(INDIAN_PHONE_REGEX, 'Enter a valid 10-digit Indian mobile number'),
  current_city: z.string().trim().min(2, 'City is required').max(80, 'City must not exceed 80 characters'),
  total_experience_yrs: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Max experience 50 years'),
  current_ctc: z.coerce.number().min(0).nullable().optional(),
  expected_ctc: z.coerce.number().min(0).nullable().optional(),
  notice_period_days: z.coerce.number().int().min(0).max(180).nullable().optional(),
  cover_note: z.string().trim().max(1500).nullable().optional(),
  consent: z.boolean().refine((val) => val === true, 'You must agree to the data storage terms to submit your application'),
  consent_version: z.string().default('2026-10'),
  website: z.string().max(0, 'Bot detected').optional(), // honeypot
  turnstile_token: z.string().optional(),
});

export type PublicApplyInput = z.infer<typeof PublicApplyInputSchema>;

export const PublicJobListItemSchema = z.object({
  id: z.string().uuid(),
  job_code: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  department_slug: z.string(),
  department_name: z.string(),
  employment_type: z.enum(EMPLOYMENT_TYPES),
  workplace_type: z.enum(WORKPLACE_TYPES),
  experience_level: z.enum(EXPERIENCE_LEVELS),
  min_experience_years: z.number(),
  max_experience_years: z.number().nullable(),
  openings: z.number(),
  city: z.string(),
  state_name: z.string().nullable(),
  is_featured: z.boolean(),
  apply_by: z.string().nullable(),
  published_at: z.string(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_period: z.enum(SALARY_PERIODS).nullable(),
});

export const PublicJobDetailSchema = PublicJobListItemSchema.extend({
  description_md: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  benefits: z.array(z.string()),
  skills: z.array(z.string()),
  district: z.string().nullable(),
  country_code: z.string(),
  updated_at: z.string(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  show_salary: z.boolean(),
  salary_currency: z.string().nullable(),
  availability: z.enum(['open', 'closed']),
  closed_at: z.string().nullable(),
});

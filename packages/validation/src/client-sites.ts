// packages/validation/src/client-sites.ts
import { z } from 'zod';

/**
 * Client Site validation schema.
 * .max() bounds BEFORE regex to prevent ReDoS (per VALIDATION-ERROR-RESILIENCE rule).
 */
export const SiteSchema = z.object({
  site_name: z
    .string()
    .min(2, 'Site name must be at least 2 characters')
    .max(200, 'Site name must be at most 200 characters')
    .trim(),
  street: z
    .string()
    .min(2, 'Street/Area is required')
    .max(500, 'Street must be at most 500 characters')
    .trim(),
  city: z
    .string()
    .min(2, 'City is required')
    .max(200, 'City must be at most 200 characters')
    .trim(),
  district: z
    .string()
    .min(2, 'District is required')
    .max(200, 'District must be at most 200 characters')
    .trim(),
  state_id: z
    .number({ required_error: 'State is required' })
    .int()
    .positive('Select a valid state'),
  pincode: z
    .string()
    .max(6, 'Pincode must be exactly 6 digits')
    .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
});

export const UpdateSiteSchema = SiteSchema.partial().extend({
  id: z.string().uuid(),
});

export type SiteInput = z.infer<typeof SiteSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteSchema>;

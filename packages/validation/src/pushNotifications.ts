/**
 * ReachInternational — Push Notification Payload Validation (Zod)
 *
 * Canonical validation for push tap payloads (web service worker + native tap
 * routing). Consumes the shared route allowlist from `@reachinternational/types`
 * (single registry owned by the in-app notifications task).
 */

import { z } from 'zod';
import { isAllowedPushDeepLink } from '@reachinternational/types';

const relativeAllowlistedPath = z
  .string()
  .trim()
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/, 'Push link must be a relative same-origin path')
  .refine(isAllowedPushDeepLink, 'Push link route is not in the allowlist');

/** Opaque non-enumerable reference (random UUID) — never sequential, never a credential. */
const opaqueReference = z.string().uuid();

export const pushTapDataSchema = z.object({
  nid: opaqueReference,
  link: relativeAllowlistedPath,
  priority: z.enum(['critical', 'high', 'normal', 'low']).or(z.string().max(16)),
  category: z.string().min(1).max(64),
});

export const pushPayloadSchema = pushTapDataSchema.extend({
  title: z.string().min(1).max(256),
  body: z.string().max(2048),
  tag: z.string().max(64).optional(),
});

export type PushTapDataInput = z.infer<typeof pushTapDataSchema>;
export type PushPayloadInput = z.infer<typeof pushPayloadSchema>;

/**
 * Validates an untrusted push tap payload (e.g. `notification.data` in the
 * service worker or from `expo-notifications`). Returns the parsed data or
 * null when the payload must be rejected (never navigate on invalid data).
 */
export function parsePushTapData(data: unknown): PushTapDataInput | null {
  const result = pushTapDataSchema.safeParse(data);
  return result.success ? result.data : null;
}

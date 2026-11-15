import { z } from "zod";

export const DOC_TYPES = ["bank_document", "aadhaar", "driving_license"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const StagingUploadRequestSchema = z.object({
  sessionId: z.string().uuid("Invalid staging session ID"),
  docTypes: z
    .array(z.enum(DOC_TYPES))
    .min(1, "At least one document type must be specified")
    .max(3, "Cannot request more than 3 documents simultaneously"),
});

export type StagingUploadRequest = z.infer<typeof StagingUploadRequestSchema>;

export const DocumentChangeRequestSchema = z.object({
  document_type_code: z.enum(DOC_TYPES, {
    errorMap: () => ({ message: "Invalid document type code" }),
  }),
  staging_path: z.string().min(1, "Staging path is required"),
  staging_thumb_path: z.string().optional().nullable(),
});

export type DocumentChangeRequestInput = z.infer<typeof DocumentChangeRequestSchema>;

export const SignupUploadUrlRequestSchema = z.object({
  session: z.string().optional(),
  docType: z.enum(DOC_TYPES, {
    errorMap: () => ({ message: "Invalid document type selected." }),
  }),
  turnstileToken: z.string().optional(),
});

export type SignupUploadUrlRequest = z.infer<typeof SignupUploadUrlRequestSchema>;


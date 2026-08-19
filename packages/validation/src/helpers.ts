import { z } from "zod";

export interface FormattedZodError {
  field: string;
  message: string;
}

export function formatZodError(error: z.ZodError): FormattedZodError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: FormattedZodError[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodError(result.error) };
}

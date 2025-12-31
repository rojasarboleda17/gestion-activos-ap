import { z } from "zod";

/**
 * Validation schemas for form data.
 * These provide client-side validation that mirrors expected server constraints.
 * Note: Server-side validation is enforced via RLS policies and database constraints.
 */

export const customerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, { message: "El nombre es requerido" })
    .max(200, { message: "El nombre debe tener máximo 200 caracteres" }),
  email: z
    .string()
    .trim()
    .max(255, { message: "El email debe tener máximo 255 caracteres" })
    .email({ message: "Email inválido" })
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, { message: "El teléfono debe tener máximo 50 caracteres" })
    .nullable()
    .or(z.literal("")),
  document_id: z
    .string()
    .trim()
    .max(50, { message: "El documento debe tener máximo 50 caracteres" })
    .nullable()
    .or(z.literal("")),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

/**
 * Helper to validate and transform customer form data for database insert/update.
 * Converts empty strings to null for nullable fields.
 */
export function validateCustomerData(data: {
  full_name: string;
  email: string;
  phone: string;
  document_id: string;
}): { success: true; data: { full_name: string; email: string | null; phone: string | null; document_id: string | null }; error?: never } | { success: false; error: string; data?: never } {
  try {
    const validated = customerSchema.parse(data);
    return {
      success: true,
      data: {
        full_name: validated.full_name,
        email: validated.email && validated.email.trim() !== "" ? validated.email : null,
        phone: validated.phone && validated.phone.trim() !== "" ? validated.phone : null,
        document_id: validated.document_id && validated.document_id.trim() !== "" ? validated.document_id : null,
      },
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message || "Datos inválidos" };
    }
    return { success: false, error: "Error de validación" };
  }
}

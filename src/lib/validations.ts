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
  id_type_code: z
    .string()
    .trim()
    .max(20, { message: "El tipo de documento debe tener máximo 20 caracteres" })
    .nullable()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(255, { message: "La dirección debe tener máximo 255 caracteres" })
    .nullable()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .max(100, { message: "La ciudad debe tener máximo 100 caracteres" })
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
  id_type_code: string;
  address: string;
  city: string;
}): { success: true; data: { full_name: string; email: string | null; phone: string | null; document_id: string | null; id_type_code: string | null; address: string | null; city: string | null }; error?: never } | { success: false; error: string; data?: never } {
  try {
    const validated = customerSchema.parse(data);
    return {
      success: true,
      data: {
        full_name: validated.full_name,
        email: validated.email && validated.email.trim() !== "" ? validated.email : null,
        phone: validated.phone && validated.phone.trim() !== "" ? validated.phone : null,
        document_id: validated.document_id && validated.document_id.trim() !== "" ? validated.document_id : null,
        id_type_code: validated.id_type_code && validated.id_type_code.trim() !== "" ? validated.id_type_code : null,
        address: validated.address && validated.address.trim() !== "" ? validated.address : null,
        city: validated.city && validated.city.trim() !== "" ? validated.city : null,
      },
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message || "Datos inválidos" };
    }
    return { success: false, error: "Error de validación" };
  }
}

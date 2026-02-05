export type DocTypeCode =
  | "purchase_contract"
  | "mandate"
  | "transfer_form"
  | "owner_id"
  | "property_card"
  | "other";

export const DOC_TYPES: Array<{ value: DocTypeCode; label: string }> = [
  { value: "purchase_contract", label: "Contrato Compraventa" },
  { value: "mandate", label: "Mandato" },
  { value: "transfer_form", label: "Formato de Traspaso" },
  { value: "owner_id", label: "Documento identidad propietario actual" },
  { value: "property_card", label: "Tarjeta de propiedad" },
  { value: "other", label: "Otros" },
];

export function docTypeLabel(value?: string | null) {
  if (!value) return "—";
  const hit = DOC_TYPES.find((d) => d.value === value);
  return hit?.label ?? value; // fallback para históricos ("contrato", etc.)
}



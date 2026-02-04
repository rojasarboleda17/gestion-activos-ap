import { supabase } from "@/integrations/supabase/client";

function safeFileName(original: string) {
  const base = original.split("/").pop()?.split("\\").pop() || "file";
  // Mantener letras/números/_/.- y reemplazar el resto por _
  return base.replace(/[^\w.\-]+/g, "_").slice(-120);
}

function shortId() {
  try {
    // Modern browsers
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  } catch {}
  return Math.random().toString(16).slice(2, 10);
}

export function buildVehicleFilePath(params: {
  orgId: string;
  vehicleId: string;
  visibility: "sales" | "operations" | "restricted";
  originalFileName: string;
}) {
  const { orgId, vehicleId, visibility, originalFileName } = params;
  const name = safeFileName(originalFileName);
  return `${orgId}/vehicle/${vehicleId}/${visibility}/${Date.now()}_${shortId()}_${name}`;
}

export function buildDealDocumentPath(params: {
  orgId: string;
  contextId: string; // sale_id o reservation_id
  originalFileName: string;
}) {
  const { orgId, contextId, originalFileName } = params;
  const name = safeFileName(originalFileName);
  return `${orgId}/deal/${contextId}/${Date.now()}_${shortId()}_${name}`;
}

export async function uploadToBucket(params: {
  bucket: string;
  path: string;
  file: File;
}) {
  const { bucket, path, file } = params;

  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;

  return { bucket, path };
}

import type { SupabaseClient } from "@supabase/supabase-js";

type ContractGenerationStatus = "pending" | "processing" | "done" | "error" | "idle" | "missing";

export interface DealDocumentContract {
  id: string;
  generation_status: ContractGenerationStatus | null;
  generation_error: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  created_at: string;
}

interface EnqueueContractResponse {
  deal_document_id: string;
}

interface SignedUrlSuccess {
  url: string;
  expires_in: number;
}

interface SignedUrlStatusResponse {
  status: ContractGenerationStatus;
  generation_error?: string | null;
}

export type GetContractSignedUrlResponse = SignedUrlSuccess | SignedUrlStatusResponse;

const getSupabaseConfig = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Falta configuración de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)");
  }

  return { supabaseUrl, anonKey };
};

const getAuthHeaders = async (supabase: SupabaseClient) => {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("No hay sesión activa para invocar funciones.");
  }

  const { anonKey } = getSupabaseConfig();

  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  };
};

export async function findLatestContractDoc(supabase: SupabaseClient, saleId: string): Promise<DealDocumentContract | null> {
  const { data, error } = await supabase
    .from("deal_documents")
    .select("id, generation_status, generation_error, storage_bucket, storage_path, created_at")
    .eq("sale_id", saleId)
    .eq("origin", "generated")
    .eq("doc_type", "contrato")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el contrato: ${error.message}`);
  }

  return data as DealDocumentContract | null;
}

export async function enqueueContract(supabase: SupabaseClient, saleId: string): Promise<EnqueueContractResponse> {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = await getAuthHeaders(supabase);

  const response = await fetch(`${supabaseUrl}/functions/v1/enqueue-contract`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sale_id: saleId }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "No se pudo encolar la generación del contrato");
  }

  if (!payload?.deal_document_id) {
    throw new Error("La función no devolvió deal_document_id");
  }

  return payload as EnqueueContractResponse;
}

export async function getContractSignedUrl(
  supabase: SupabaseClient,
  dealDocumentId: string,
): Promise<GetContractSignedUrlResponse> {
  const { supabaseUrl } = getSupabaseConfig();
  const headers = await getAuthHeaders(supabase);

  const response = await fetch(`${supabaseUrl}/functions/v1/get-contract-url2`, {
    method: "POST",
    headers,
    body: JSON.stringify({ deal_document_id: dealDocumentId }),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 409) {
    return {
      status: payload?.status || "processing",
      generation_error: payload?.generation_error || null,
    };
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "No se pudo obtener la URL del contrato");
  }

  if (!payload?.url) {
    throw new Error("La función no devolvió una URL firmada");
  }

  return {
    url: payload.url,
    expires_in: payload.expires_in ?? 0,
  };
}

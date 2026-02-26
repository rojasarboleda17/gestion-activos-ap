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

const DEFAULT_SUPABASE_URL = "https://vyhfmkxqyoltjnjcfohu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aGZta3hxeW9sdGpuamNmb2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTc2NzIsImV4cCI6MjA4MjczMzY3Mn0.HvDi_nKBMFMqv7DJL5BSQRZ954DJrM-xNQeGVZ-xxTM";

const getSupabaseConfig = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_ANON_KEY;

  return { supabaseUrl, anonKey };
};

const getAuthHeaders = async (supabase: SupabaseClient) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
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

const toNetworkErrorMessage = (fallback: string, err: unknown) => {
  if (err instanceof TypeError) {
    return `${fallback}. Verifica tu conexión e inténtalo nuevamente.`;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
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

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/enqueue-contract`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sale_id: saleId }),
    });
  } catch (err) {
    throw new Error(toNetworkErrorMessage("No se pudo conectar para generar el archivo", err));
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Error al generar el archivo");
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

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/get-contract-url2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ deal_document_id: dealDocumentId }),
    });
  } catch (err) {
    throw new Error(toNetworkErrorMessage("No se pudo conectar para obtener la vista previa del contrato", err));
  }

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

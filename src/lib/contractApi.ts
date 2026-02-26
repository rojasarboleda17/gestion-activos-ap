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

interface FunctionErrorLike {
  message: string;
  context?: Response;
}

const isFunctionErrorLike = (error: unknown): error is FunctionErrorLike => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as Partial<FunctionErrorLike>;
  return typeof maybeError.message === "string";
};

const parseFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (!isFunctionErrorLike(error)) {
    return fallback;
  }

  if (error.message === "Failed to fetch") {
    return fallback;
  }

  const response = error.context;
  if (!response) {
    return error.message || fallback;
  }

  const payload = await response.clone().json().catch(async () => {
    const textBody = await response.clone().text().catch(() => "");
    return { message: textBody };
  });

  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    (error.message && error.message !== "Edge Function returned a non-2xx status code" ? error.message : "") ||
    fallback;

  if (response.status === 401) {
    return "No autorizado. Inicia sesión nuevamente.";
  }

  if (response.status === 400) {
    return `Solicitud inválida: ${message}`;
  }

  if (response.status >= 500) {
    return `Error del servidor: ${message}`;
  }

  return message;
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
  const { data, error } = await supabase.functions.invoke("enqueue-contract", {
    body: { sale_id: saleId },
  });

  if (error) {
    if (isFunctionErrorLike(error) && error.message === "Failed to fetch") {
      throw new Error("No se pudo conectar para generar el archivo. Verifica tu conexión e inténtalo nuevamente.");
    }

    throw new Error(await parseFunctionErrorMessage(error, "Error al generar el archivo"));
  }

  if (!data?.deal_document_id) {
    throw new Error("La función no devolvió deal_document_id");
  }

  return data as EnqueueContractResponse;
}

export async function getContractSignedUrl(
  supabase: SupabaseClient,
  dealDocumentId: string,
): Promise<GetContractSignedUrlResponse> {
  const { data, error } = await supabase.functions.invoke("get-contract-url2", {
    body: { deal_document_id: dealDocumentId },
  });

  if (error) {
    if (isFunctionErrorLike(error) && error.context?.status === 409) {
      const payload = (data ?? {}) as Partial<SignedUrlStatusResponse>;
      const contextPayload: Partial<SignedUrlStatusResponse> = error.context
        ? await error.context.clone().json().catch(() => ({} as Partial<SignedUrlStatusResponse>))
        : {};

      return {
        status: payload.status || contextPayload?.status || "processing",
        generation_error: payload.generation_error || contextPayload?.generation_error || null,
      };
    }

    if (isFunctionErrorLike(error) && error.message === "Failed to fetch") {
      throw new Error("No se pudo conectar para obtener la vista previa del contrato. Verifica tu conexión e inténtalo nuevamente.");
    }

    throw new Error(await parseFunctionErrorMessage(error, "No se pudo obtener la URL del contrato"));
  }

  if (!data?.url) {
    throw new Error("La función no devolvió una URL firmada");
  }

  return {
    url: data.url,
    expires_in: data.expires_in ?? 0,
  };
}

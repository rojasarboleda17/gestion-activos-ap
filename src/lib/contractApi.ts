import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

type InvokeResponse<T> = {
  data: T | null;
  error: unknown;
};

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://vyhfmkxqyoltjnjcfohu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aGZta3hxeW9sdGpuamNmb2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTc2NzIsImV4cCI6MjA4MjczMzY3Mn0.HvDi_nKBMFMqv7DJL5BSQRZ954DJrM-xNQeGVZ-xxTM";

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

const resolveAccessToken = async (supabase: SupabaseClient): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return session.access_token;
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
};

const isUnauthorizedError = (error: unknown) => {
  if (!isFunctionErrorLike(error)) {
    return false;
  }

  if (error.context?.status === 401) {
    return true;
  }

  return error.message.toLowerCase().includes("unauthorized");
};

const invokeWithAuth = async <TResponse>(
  supabase: SupabaseClient,
  fnName: string,
  body: Record<string, unknown>,
): Promise<InvokeResponse<TResponse>> => {
  const firstTry = await supabase.functions.invoke(fnName, {
    body,
  }) as InvokeResponse<TResponse>;

  if (!firstTry.error || !isUnauthorizedError(firstTry.error)) {
    return firstTry;
  }

  const accessToken = await resolveAccessToken(supabase);
  if (!accessToken) {
    return firstTry;
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  return authClient.functions.invoke(fnName, {
    body,
  }) as Promise<InvokeResponse<TResponse>>;
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
  const { data, error } = await invokeWithAuth<EnqueueContractResponse>(supabase, "enqueue-contract", {
    sale_id: saleId,
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
  const { data, error } = await invokeWithAuth<SignedUrlSuccess>(supabase, "get-contract-url2", {
    deal_document_id: dealDocumentId,
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

/* eslint-disable no-console */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight, json, text } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "-";
  const userAgent = req.headers.get("user-agent") ?? "-";
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "-";
  const hasAuthorization = Boolean(req.headers.get("authorization"));

  console.log("[get-contract-url2] incoming", {
    method: req.method,
    origin,
    userAgent,
    forwardedFor,
    hasAuthorization,
  });

  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return text("Method not allowed", 405, req);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ error: "INTERNAL", message: "Missing Supabase environment configuration" }, 500, req);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400, req);
    }

    const dealDocumentId = typeof (body as Record<string, unknown>)?.deal_document_id === "string"
      ? ((body as Record<string, unknown>).deal_document_id as string).trim()
      : "";

    if (!dealDocumentId) {
      return json({ error: "MISSING_DEAL_DOCUMENT_ID" }, 400, req);
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) {
      return text("Unauthorized", 401, req);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return text("Unauthorized", 401, req);
    }

    const serverClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let doc:
      | {
          id: string;
          generation_status: string | null;
          generation_error: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          sale_id: string | null;
        }
      | null = null;

    const userRead = await userClient
      .from("deal_documents")
      .select("id, generation_status, generation_error, storage_bucket, storage_path, sale_id")
      .eq("id", dealDocumentId)
      .maybeSingle();

    if (userRead.data) {
      doc = userRead.data;
    } else {
      const serverRead = await serverClient
        .from("deal_documents")
        .select("id, generation_status, generation_error, storage_bucket, storage_path, sale_id")
        .eq("id", dealDocumentId)
        .maybeSingle();

      if (serverRead.error) {
        throw new Error(serverRead.error.message);
      }

      doc = serverRead.data;
    }

    if (!doc) {
      return json({ error: "DOC_NOT_FOUND" }, 404, req);
    }

    console.log("[get-contract-url2] doc-status", {
      origin,
      doc_id: dealDocumentId,
      user_id: user.id,
      status: doc.generation_status,
    });

    if (doc.generation_status !== "done") {
      return json(
        {
          status: doc.generation_status ?? "processing",
          generation_error: doc.generation_error,
        },
        409,
        req,
      );
    }

    const bucket = doc.storage_bucket;
    const path = doc.storage_path;

    if (!bucket || !path) {
      return json({ error: "FAILED_TO_SIGN", message: "Missing storage location", bucket, path, has_service_role_key: true }, 500, req);
    }

    const { data: signed, error: signedErr } = await serverClient.storage.from(bucket).createSignedUrl(path, 300);

    if (signedErr || !signed?.signedUrl) {
      console.log("[get-contract-url2] sign-failed", {
        origin,
        doc_id: dealDocumentId,
        user_id: user.id,
        bucket,
        path,
        message: signedErr?.message ?? null,
      });

      return json(
        {
          error: "FAILED_TO_SIGN",
          message: signedErr?.message ?? null,
          bucket,
          path,
          has_service_role_key: true,
        },
        500,
        req,
      );
    }

    return json(
      {
        version: "get-contract-url2-v1",
        deal_document_id: dealDocumentId,
        sale_id: doc.sale_id,
        url: signed.signedUrl,
        expires_in: 300,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log("[get-contract-url2] error", { message });
    return json({ error: "INTERNAL", message }, 500, req);
  }
});

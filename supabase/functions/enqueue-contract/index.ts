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

  console.log("[enqueue-contract] incoming", {
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

    const saleId = typeof (body as Record<string, unknown>)?.sale_id === "string"
      ? ((body as Record<string, unknown>).sale_id as string).trim()
      : "";

    if (!saleId) {
      return json({ error: "MISSING_SALE_ID" }, 400, req);
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

    const { data: latestDoc } = await serverClient
      .from("deal_documents")
      .select("id, generation_status")
      .eq("sale_id", saleId)
      .eq("origin", "generated")
      .eq("doc_type", "contrato")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDoc?.id && (latestDoc.generation_status === "pending" || latestDoc.generation_status === "processing")) {
      console.log("[enqueue-contract] reuse pending doc", {
        origin,
        sale_id: saleId,
        user_id: user.id,
        deal_document_id: latestDoc.id,
      });

      return json({ deal_document_id: latestDoc.id }, 200, req);
    }

    const { data: inserted, error: insertErr } = await serverClient
      .from("deal_documents")
      .insert({
        sale_id: saleId,
        origin: "generated",
        doc_type: "contrato",
        generation_status: "pending",
        generation_error: null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      throw new Error(insertErr?.message || "Could not enqueue contract generation");
    }

    console.log("[enqueue-contract] queued", {
      method: req.method,
      origin,
      sale_id: saleId,
      user_id: user.id,
      deal_document_id: inserted.id,
    });

    return json({ deal_document_id: inserted.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log("[enqueue-contract] error", { message });
    return json({ error: "INTERNAL", message }, 500, req);
  }
});

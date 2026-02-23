import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabaseClient.ts";

type AllowedDoc = "contrato_compraventa" | "mandato" | "traspaso";

const ALLOWED_DOCS: AllowedDoc[] = [
  "contrato_compraventa",
  "mandato",
  "traspaso",
];
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logRequest(params: {
  requestId: string;
  saleId?: string;
  userId?: string;
  statusCode: number;
}) {
  console.log(
    JSON.stringify({
      request_id: params.requestId,
      sale_id: params.saleId ?? null,
      user_id: params.userId ?? null,
      status_code: params.statusCode,
    }),
  );
}

function jsonResponse(
  requestId: string,
  statusCode: number,
  body: Record<string, unknown>,
  saleId?: string,
  userId?: string,
): Response {
  logRequest({ requestId, saleId, userId, statusCode });
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDocs(input: unknown):
  | { docs: AllowedDoc[] }
  | { error: { field: string; message: string } } {
  if (input === undefined) {
    return { docs: [...ALLOWED_DOCS] };
  }

  if (!Array.isArray(input)) {
    return {
      error: {
        field: "docs",
        message: "docs must be an array of allowed document codes",
      },
    };
  }

  if (input.length === 0) {
    return { error: { field: "docs", message: "docs must not be empty" } };
  }

  const docs = input as unknown[];
  const seen = new Set<string>();

  for (const doc of docs) {
    if (typeof doc !== "string") {
      return {
        error: {
          field: "docs",
          message: "each doc must be a string",
        },
      };
    }

    if (!ALLOWED_DOCS.includes(doc as AllowedDoc)) {
      return {
        error: {
          field: "docs",
          message: `invalid doc '${doc}'. Allowed: ${ALLOWED_DOCS.join(", ")}`,
        },
      };
    }

    if (seen.has(doc)) {
      return {
        error: {
          field: "docs",
          message: `duplicated doc '${doc}' is not allowed`,
        },
      };
    }

    seen.add(doc);
  }

  return { docs: docs as AllowedDoc[] };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    logRequest({ requestId, statusCode: 204 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(requestId, 405, {
      error: "METHOD_NOT_ALLOWED",
      expected: "POST",
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    return jsonResponse(requestId, 401, {
      error: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header. Expected Bearer <JWT>",
    });
  }

  const token = bearerMatch[1].trim();
  if (!token) {
    return jsonResponse(requestId, 401, {
      error: "UNAUTHORIZED",
      message: "Missing JWT token in Authorization header",
    });
  }

  const { data: userData, error: userError } = await supabaseClient.auth.getUser(
    token,
  );

  if (userError || !userData.user) {
    return jsonResponse(requestId, 401, {
      error: "UNAUTHORIZED",
      message: "Invalid or expired JWT",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(requestId, 400, {
      error: "INVALID_BODY",
      detail: { field: "body", message: "Body must be valid JSON" },
    });
  }

  const saleId = body.sale_id;
  if (typeof saleId !== "string" || !UUID_V4_REGEX.test(saleId)) {
    return jsonResponse(
      requestId,
      400,
      {
        error: "INVALID_BODY",
        detail: { field: "sale_id", message: "sale_id must be a UUID v4" },
      },
      typeof saleId === "string" ? saleId : undefined,
      userData.user.id,
    );
  }

  const parsedDocs = parseDocs(body.docs);
  if ("error" in parsedDocs) {
    return jsonResponse(
      requestId,
      400,
      {
        error: "INVALID_BODY",
        detail: parsedDocs.error,
      },
      saleId,
      userData.user.id,
    );
  }

  const { data: payload, error: rpcError } = await supabaseClient.rpc(
    "rpc_get_sale_documents_payload",
    {
      p_sale_id: saleId,
    },
  );

  if (rpcError) {
    if (rpcError.message?.includes("SALE_NOT_FOUND")) {
      return jsonResponse(
        requestId,
        404,
        { error: "SALE_NOT_FOUND" },
        saleId,
        userData.user.id,
      );
    }

    return jsonResponse(
      requestId,
      500,
      { error: "RPC_ERROR", message: "Failed to load sale documents payload" },
      saleId,
      userData.user.id,
    );
  }

  if (!payload || (typeof payload === "object" && payload?.error === "SALE_NOT_FOUND")) {
    return jsonResponse(
      requestId,
      404,
      { error: "SALE_NOT_FOUND" },
      saleId,
      userData.user.id,
    );
  }

  const eligibility =
    typeof payload === "object" && payload !== null && "eligibility" in payload
      ? (payload.eligibility as { can_generate?: boolean; reasons?: unknown })
      : null;

  if (eligibility?.can_generate === false) {
    return jsonResponse(
      requestId,
      409,
      {
        error: "NOT_ELIGIBLE",
        reasons: Array.isArray(eligibility.reasons) ? eligibility.reasons : [],
      },
      saleId,
      userData.user.id,
    );
  }

  return jsonResponse(
    requestId,
    200,
    {
      sale_id: saleId,
      docs: parsedDocs.docs,
      user_id: userData.user.id,
      payload,
    },
    saleId,
    userData.user.id,
  );
});

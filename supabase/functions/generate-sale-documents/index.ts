import { PDFDocument, PDFPage, rgb } from "pdf-lib";

import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { supabaseClient } from "../_shared/supabaseClient.ts";

type AllowedDoc = "contrato_compraventa" | "mandato" | "traspaso";

type SaleDocumentsPayload = {
  sale?: { org_id?: string | null } | null;
  vehicle?: { id?: string | null; org_id?: string | null } | null;
  eligibility?: { can_generate?: boolean; reasons?: unknown } | null;
};

type GeneratedFile = {
  doc_type: AllowedDoc;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  signed_url: string;
  page_count?: number;
  debug?: boolean;
};

const ALLOWED_DOCS: AllowedDoc[] = [
  "contrato_compraventa",
  "mandato",
  "traspaso",
];
const STORAGE_BUCKET = "vehicle-internal";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function extractPayloadData(payload: unknown):
  | { orgId: string; vehicleId: string; eligibility: { can_generate?: boolean; reasons?: unknown } | null }
  | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typedPayload = payload as SaleDocumentsPayload;
  const orgId = typedPayload.sale?.org_id ?? typedPayload.vehicle?.org_id ?? null;
  const vehicleId = typedPayload.vehicle?.id ?? null;

  if (typeof orgId !== "string" || typeof vehicleId !== "string") {
    return null;
  }

  return {
    orgId,
    vehicleId,
    eligibility: typedPayload.eligibility ?? null,
  };
}

const DOC_TYPE_PAGE_INDICES: Record<AllowedDoc, number[]> = {
  contrato_compraventa: [0, 1],
  traspaso: [2],
  mandato: [4],
};

const DEBUG_GRID_STEP = 50;

function drawDebugGrid(page: PDFPage) {
  const { width, height } = page.getSize();

  for (let x = 0; x <= width; x += DEBUG_GRID_STEP) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.7,
    });

    page.drawText(`x=${x}`, {
      x: Math.min(x + 2, width - 35),
      y: 5,
      size: 7,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  for (let y = 0; y <= height; y += DEBUG_GRID_STEP) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.7,
    });

    page.drawText(`y=${y}`, {
      x: 2,
      y: Math.min(y + 2, height - 10),
      size: 7,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  page.drawCircle({ x: 0, y: 0, size: 4, color: rgb(1, 0, 0), opacity: 0.8 });
  page.drawText("(0,0)", { x: 8, y: 8, size: 8, color: rgb(1, 0, 0) });

  page.drawCircle({
    x: width,
    y: height,
    size: 4,
    color: rgb(0, 0, 1),
    opacity: 0.8,
  });
  page.drawText(`(${Math.round(width)},${Math.round(height)})`, {
    x: Math.max(width - 85, 3),
    y: Math.max(height - 14, 3),
    size: 8,
    color: rgb(0, 0, 1),
  });
}

async function buildTemplatePdf(docType: AllowedDoc, debug: boolean): Promise<Uint8Array> {
  const selectedPageIndices = DOC_TYPE_PAGE_INDICES[docType];
  if (!selectedPageIndices) {
    throw new Error(`Unsupported doc_type '${docType}' for template extraction`);
  }

  const url = new URL("./templates/PAQUETE TRASPASO.pdf", import.meta.url);
  const templateBytes = await Deno.readFile(url);
  const templatePdf = await PDFDocument.load(templateBytes);
  const outPdf = await PDFDocument.create();

  const copiedPages = await outPdf.copyPages(templatePdf, selectedPageIndices);
  for (const page of copiedPages) {
    outPdf.addPage(page);
  }

  if (debug) {
    for (const page of outPdf.getPages()) {
      drawDebugGrid(page);
    }
  }

  return await outPdf.save();
}

function isDebugEnabled(req: Request): boolean {
  const debugQueryParam = new URL(req.url).searchParams.get("debug");
  const debugHeader = req.headers.get("X-Debug");
  return debugQueryParam === "1" || debugHeader === "1";
}

async function uploadPdfWithConflictHandling(params: {
  orgId: string;
  vehicleId: string;
  saleId: string;
  docType: AllowedDoc;
  pdfBytes: Uint8Array;
}): Promise<{ fileName: string; storagePath: string }> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const baseTimestamp = Date.now() + attempt;
    const suffix = attempt === 0 ? "" : `_${crypto.randomUUID().slice(0, 8)}`;
    const fileName = `${baseTimestamp}_${params.docType}${suffix}.pdf`;
    const storagePath = `${params.orgId}/vehicle/${params.vehicleId}/sales/${params.saleId}/documents/${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, params.pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (!error) {
      return { fileName, storagePath };
    }

    const conflict =
      error.message?.toLowerCase().includes("already") ||
      error.message?.includes("409") ||
      (error as { statusCode?: string | number }).statusCode === "409" ||
      (error as { statusCode?: string | number }).statusCode === 409;

    if (!conflict) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  throw new Error("Storage upload failed after retrying file name conflicts");
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
  if (typeof saleId !== "string" || !UUID_REGEX.test(saleId)) {
    return jsonResponse(
      requestId,
      400,
      {
        error: "INVALID_BODY",
        detail: { field: "sale_id", message: "sale_id must be a UUID" },
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
      {
        error: "RPC_ERROR",
        message: "Failed to load sale documents payload",
        request_id: requestId,
      },
      saleId,
      userData.user.id,
    );
  }

  if (
    !payload ||
    (typeof payload === "object" && payload !== null && payload?.error === "SALE_NOT_FOUND")
  ) {
    return jsonResponse(
      requestId,
      404,
      { error: "SALE_NOT_FOUND" },
      saleId,
      userData.user.id,
    );
  }

  const payloadData = extractPayloadData(payload);
  if (!payloadData) {
    return jsonResponse(
      requestId,
      500,
      {
        error: "INVALID_PAYLOAD",
        message: "Payload missing org_id or vehicle.id",
        request_id: requestId,
      },
      saleId,
      userData.user.id,
    );
  }

  if (payloadData.eligibility?.can_generate !== true) {
    return jsonResponse(
      requestId,
      409,
      {
        error: "NOT_ELIGIBLE",
        reasons: Array.isArray(payloadData.eligibility?.reasons)
          ? payloadData.eligibility?.reasons
          : [],
      },
      saleId,
      userData.user.id,
    );
  }

  const debug = isDebugEnabled(req);
  const files: GeneratedFile[] = [];

  for (const docType of parsedDocs.docs) {
    try {
      const pdfBytes = await buildTemplatePdf(docType, debug);
      const generatedPdf = await PDFDocument.load(pdfBytes);
      const { fileName, storagePath } = await uploadPdfWithConflictHandling({
        orgId: payloadData.orgId,
        vehicleId: payloadData.vehicleId,
        saleId,
        docType,
        pdfBytes,
      });

      const { data: insertedFile, error: insertError } = await supabaseAdmin
        .from("vehicle_files")
        .insert({
          org_id: payloadData.orgId,
          vehicle_id: payloadData.vehicleId,
          sale_id: saleId,
          file_kind: "document",
          doc_type: docType,
          visibility: "operations",
          storage_bucket: STORAGE_BUCKET,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: "application/pdf",
          uploaded_by: userData.user.id,
          doc_type_other: null,
        })
        .select("id")
        .single();

      if (insertError || !insertedFile?.id) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw new Error(`vehicle_files insert failed: ${insertError?.message ?? "missing inserted id"}`);
      }

      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60);

      if (signedError || !signedData?.signedUrl) {
        await supabaseAdmin.from("vehicle_files").delete().eq("id", insertedFile.id);
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw new Error(`signed URL failed: ${signedError?.message ?? "unknown error"}`);
      }

      files.push({
        doc_type: docType,
        file_name: fileName,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        signed_url: signedData.signedUrl,
        page_count: generatedPdf.getPageCount(),
        debug,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          request_id: requestId,
          sale_id: saleId,
          user_id: userData.user.id,
          doc_type: docType,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      return jsonResponse(
        requestId,
        500,
        {
          error: "DOCUMENT_GENERATION_FAILED",
          message: "Failed to generate and persist one or more documents",
          request_id: requestId,
        },
        saleId,
        userData.user.id,
      );
    }
  }

  return jsonResponse(
    requestId,
    200,
    {
      sale_id: saleId,
      docs: parsedDocs.docs,
      files,
    },
    saleId,
    userData.user.id,
  );
});

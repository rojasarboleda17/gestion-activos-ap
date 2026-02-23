import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const TEMPLATE_RELATIVE_PATH = "templates/PAQUETE TRASPASO.pdf";

async function readTemplateBytes() {
  const candidates = [
    decodeURIComponent(new URL(`./${TEMPLATE_RELATIVE_PATH}`, import.meta.url).pathname),
    `${Deno.cwd()}/supabase/functions/generate-sale-documents/${TEMPLATE_RELATIVE_PATH}`,
    `${Deno.cwd()}/${TEMPLATE_RELATIVE_PATH}`,
  ];

  for (const path of candidates) {
    try {
      const bytes = await Deno.readFile(path);
      return { bytes, path };
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }

  return { bytes: null, path: candidates[0], candidates };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed", expected: "POST" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const result = await readTemplateBytes();

  if (!result.bytes) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Template file not found",
        template_path: result.path,
        template_candidates: result.candidates,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      template_bytes: result.bytes.length,
      template_path: result.path,
      message: "Baseline runtime probe OK.",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const TEMPLATE_PATH = "./templates/PAQUETE TRASPASO.pdf";

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

  try {
    const templateUrl = new URL(TEMPLATE_PATH, import.meta.url);
    const templateBytes = await Deno.readFile(templateUrl);

    return new Response(
      JSON.stringify({
        ok: true,
        template_bytes: templateBytes.length,
        template_path: TEMPLATE_PATH,
        message: "Baseline runtime probe OK.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Template file not found",
          template_path: TEMPLATE_PATH,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    throw error;
  }
});

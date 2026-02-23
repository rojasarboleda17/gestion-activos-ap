import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

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

  const templateUrl = new URL("./templates/PAQUETE TRASPASO.pdf", import.meta.url);
  const templateBytes = await Deno.readFile(templateUrl);

  return new Response(
    JSON.stringify({
      ok: true,
      template_bytes: templateBytes.length,
      message: "Baseline runtime probe OK.",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

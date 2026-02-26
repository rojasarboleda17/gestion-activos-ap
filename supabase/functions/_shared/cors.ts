export const corsHeaders = (req?: Request): HeadersInit => {
  const origin = req?.headers.get("origin");

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, content-profile, accept-profile",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const handleCorsPreflight = (req: Request): Response | null => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders(req),
    });
  }

  return null;
};

export const json = (body: unknown, status = 200, req?: Request): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

export const text = (body: string, status = 200, req?: Request): Response => {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

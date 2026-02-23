import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!anonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable");
}

export const supabaseClient = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function createUserSupabaseClient(jwt: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

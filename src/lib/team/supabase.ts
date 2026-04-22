import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton so the client isn't constructed at module-import time,
// which would fail during `next build` page-data collection when env vars
// aren't available. Task-tracker tables use the `tt_*` prefix and stay
// isolated from the typed `submissions` client in lib/supabase.ts.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set for the team app.",
    );
  }
  client = createClient(url, key);
  return client;
}

// Proxy forwards every access (including `.from(...)`, `.auth`, etc.) to the
// lazily constructed client. This keeps route-handler code concise
// (`teamDb.from(...)`) while deferring construction until first use.
export const teamDb = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

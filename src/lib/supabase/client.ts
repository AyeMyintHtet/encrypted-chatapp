import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser/client components.
 * This client handles auth token refresh automatically via cookies.
 *
 * Previously this used a Next.js rewrite proxy (`/api/proxy`), but
 * Next.js rewrites do NOT support WebSocket upgrades. Because the
 * Supabase JS SDK derives the Realtime WebSocket URL from the base
 * `supabaseUrl`, proxying through Next.js silently broke all realtime
 * subscriptions. Supabase handles CORS natively, so the proxy is
 * unnecessary — we connect directly to the real Supabase URL.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Extract the project ref for a deterministic cookie name.
  // This keeps auth tokens consistent across tabs / reloads.
  const ref = new URL(supabaseUrl).hostname.split(".")[0];

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: `sb-${ref}-auth-token`,
      },
      global: {
        fetch: (url, options) => {
          // Disable fetch cache so realtime fetches never get stale data
          return fetch(url, { ...options, cache: "no-store" });
        },
      },
    }
  );
}

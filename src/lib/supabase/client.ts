import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Singleton cache — ensures the endpoint override only runs once.
// `createBrowserClient` already returns a singleton, but we need our own
// reference so we can patch the realtime endpoint exactly once.
// ---------------------------------------------------------------------------
let _cachedClient: SupabaseClient | null = null;

/**
 * Creates (or returns the cached) Supabase browser client.
 *
 * **Hybrid connection strategy:**
 *  • REST / Auth → routes through the Next.js `/api/proxy` rewrite so the
 *    real Supabase project URL never appears in browser network logs.
 *  • Realtime (WebSocket) → connects **directly** to Supabase because
 *    Next.js rewrites cannot upgrade HTTP → WebSocket.
 *
 * The SDK has no `realtime.url` config option — the WebSocket URL is
 * derived internally from `supabaseUrl`.  We work around this by mutating
 * `client.realtime.endPoint` after construction (it's a public, mutable
 * property on `RealtimeClient`).
 */
export function createClient(): SupabaseClient {
  if (_cachedClient) return _cachedClient;

  // ── URLs ─────────────────────────────────────────────────────────────
  const realSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Proxy URL keeps the real Supabase domain out of REST traffic.
  const proxyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/proxy`
      : realSupabaseUrl; // SSR fallback — proxy isn't available server-side

  // Project ref for deterministic cookie naming (e.g. "sb-abc123-auth-token")
  const ref = new URL(realSupabaseUrl).hostname.split(".")[0];

  // Direct WebSocket URL for Realtime — bypass the proxy
  const directWsUrl = realSupabaseUrl.replace(/^http/, "ws");

  // ── Client construction ──────────────────────────────────────────────
  const client = createBrowserClient(proxyUrl, anonKey, {
    cookieOptions: {
      name: `sb-${ref}-auth-token`,
    },
    auth: {
      // Keep auth session alive across page reloads for a chat app
      persistSession: true,
    },
    realtime: {
      // Info-level logging so connection issues surface in DevTools console
      log_level: "info",
      params: {
        // Offload heartbeat to a Web Worker so background-tab timer throttling
        // doesn't kill the WebSocket connection when the user switches tabs.
        worker: true,
      },
    },
    global: {
      fetch: (url, options) => {
        // Disable Next.js fetch cache — stale responses break realtime flows
        return fetch(url, { ...options, cache: "no-store" });
      },
    },
  });

  // ── Realtime endpoint override (the hybrid trick) ────────────────────
  // The SDK set `client.realtime.endPoint` to something like:
  //   ws://localhost:3000/api/proxy/realtime/v1/websocket
  // which will fail. Redirect it to the real Supabase WebSocket endpoint.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rt = client.realtime as any;
  rt.endPoint = `${directWsUrl}/realtime/v1/websocket`;
  rt.httpEndpoint = `${realSupabaseUrl}/realtime/v1`;

  // ── WebSocket error logging ──────────────────────────────────────────
  // RealtimeClient stores lifecycle callbacks in `stateChangeCallbacks`
  // arrays (there are no top-level onError/onClose methods).
  rt.stateChangeCallbacks.error.push((error: Event) => {
    console.warn(
      "[Supabase Realtime] WebSocket error — the connection may have dropped.",
      error
    );
  });
  rt.stateChangeCallbacks.close.push((event: CloseEvent) => {
    if (event.code !== 1000) {
      // 1000 = normal closure; anything else is worth logging
      console.warn(
        `[Supabase Realtime] WebSocket closed unexpectedly (code ${event.code}).`,
        event.reason
      );
    }
  });

  _cachedClient = client;
  return client;
}

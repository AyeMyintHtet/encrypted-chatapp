import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser/client components.
 * This client handles auth token refresh automatically via cookies.
 */
export function createClient() {
  const supabaseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/proxy`
      : process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // We explicitly declare the cookie name utilizing the real Supabase project ref
  // This ensures that the proxy's cookie name exactly matches what the backend expects
  const realUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ref = new URL(realUrl).hostname.split(".")[0];

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: `sb-${ref}-auth-token`,
      },
    }
  );
}

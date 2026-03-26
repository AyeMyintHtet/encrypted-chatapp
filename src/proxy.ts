import { createServerClient } from "@supabase/ssr";
import {
  getChatUsernameFromPathname,
  hasAcceptedConnection,
} from "@/lib/chat-access";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy runs on every matched request to:
 * 1. Refresh the Supabase auth session (keeps tokens alive)
 * 2. Redirect unauthenticated users away from protected routes
 * 3. Redirect authenticated users away from auth pages
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Create a Supabase client that can read/write cookies in middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookie changes to both the request and response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Step 1: Refresh expired tokens — IMPORTANT: do not remove.
  // getSession() checks the JWT expiry and triggers a refresh_token grant
  // if the access token has expired. This updates the cookies via setAll()
  // so the rest of the request pipeline sees fresh tokens.
  await supabase.auth.getSession();

  // Step 2: Validate the (now-refreshed) session with the Supabase Auth API.
  // getUser() makes a network call to verify the access token is legitimate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Define route groups
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/chat");
  const chatUsername = getChatUsernameFromPathname(pathname);

  // Redirect unauthenticated users trying to access protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Chat route guard: only accepted contacts can access `/chat/[username]`
  if (user && chatUsername) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/dashboard";
    deniedUrl.searchParams.set("error", "chat_access_denied");

    const { data: peerProfile, error: peerError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", chatUsername)
      .maybeSingle();

    if (peerError || !peerProfile) {
      return NextResponse.redirect(deniedUrl);
    }

    try {
      const allowed = await hasAcceptedConnection(supabase, user.id, peerProfile.id);
      if (!allowed) {
        return NextResponse.redirect(deniedUrl);
      }
    } catch {
      return NextResponse.redirect(deniedUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

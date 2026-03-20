import type { SupabaseClient } from "@supabase/supabase-js";

const CHAT_ROUTE_PREFIX = "/chat/";

/**
 * Builds the OR-filter to match accepted connections in either direction.
 */
export function buildAcceptedConnectionFilter(
  userIdA: string,
  userIdB: string
): string {
  return `and(requester_id.eq.${userIdA},receiver_id.eq.${userIdB}),and(requester_id.eq.${userIdB},receiver_id.eq.${userIdA})`;
}

/**
 * Returns true only when two users are connected with an accepted relationship.
 */
export async function hasAcceptedConnection(
  supabase: SupabaseClient,
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  if (!userIdA || !userIdB) return false;
  if (userIdA === userIdB) return false;

  const { data, error } = await supabase
    .from("connections")
    .select("id")
    .eq("status", "accepted")
    .or(buildAcceptedConnectionFilter(userIdA, userIdB))
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data && data.length > 0);
}

/**
 * Extracts the username segment for `/chat/[username]` routes.
 * Returns null when the pathname does not represent an exact chat room route.
 */
export function getChatUsernameFromPathname(pathname: string): string | null {
  if (!pathname.startsWith(CHAT_ROUTE_PREFIX)) return null;

  const raw = pathname.slice(CHAT_ROUTE_PREFIX.length);
  if (!raw || raw.includes("/")) return null;

  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

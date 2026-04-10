import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string;
  ip: string;
}

/**
 * Deduplicate sessions by (user_agent + ip), keeping only the most recent one.
 * Supabase creates a new session row on every sign-in, so the same device
 * can appear multiple times. We coalesce them into a single entry per device.
 */
function deduplicateSessions(sessions: Session[]): Session[] {
  const sessionMap = new Map<string, Session>();

  for (const session of sessions) {
    // Composite key — same browser on the same network = same "device"
    const key = `${session.user_agent}::${session.ip}`;
    const existing = sessionMap.get(key);

    // Keep the session with the most recent updated_at timestamp
    if (!existing || new Date(session.updated_at) > new Date(existing.updated_at)) {
      sessionMap.set(key, session);
    }
  }

  return Array.from(sessionMap.values());
}

export function useUserSessions() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["userSessions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_sessions");
      if (error) {
        throw error;
      }
      return deduplicateSessions(data as Session[]);
    },
  });
}

export function useCurrentSessionId() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["currentSessionId"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      try {
        const base64Url = session.access_token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const payload = JSON.parse(jsonPayload);
        return payload.session_id as string;
      } catch {
        return null;
      }
    },
  });
}

export function useDeleteSession() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("delete_user_session", {
        session_id: sessionId,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSessions"] });
    },
  });
}
